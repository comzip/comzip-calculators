/**
 * 상속세 계산 모듈. 상속재산가액·상속인 구성을 입력하면 상속공제(기초·인적·
 * 배우자·금융재산·동거주택)·누진세율·신고세액공제를 반영한 결정세액을
 * 계산합니다.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 아래 항목은 스코프 밖입니다:
 *  - **상속인 구성은 배우자·직계비속(자녀) 중심 3가지 케이스만 지원**합니다
 *    (배우자+자녀, 자녀만, 배우자단독). 직계비속도 배우자도 없어 직계존속·
 *    형제자매가 상속인이 되는 경우는 법정상속분 산정 자체가 이 계산기의
 *    범위 밖입니다(민법 제1009조는 상속인 조합마다 배분 방식이 달라짐).
 *  - 상속재산의 시가 평가, 공과금, 상속인이 아닌 자에게 유증한 재산(제24조
 *    공제한도 계산에서 0으로 가정)은 다루지 않습니다.
 *  - 장애인 기대여명연수는 보험개발원 경험생명표 기반 통계라 계산기가
 *    자동 산정하지 않고 사용자가 직접 입력합니다.
 *  - 배우자상속공제 계산 시, 사전증여재산 중 배우자에게 증여된 부분을
 *    분리하지 않고 전액 직계비속 몫으로 가정합니다(근사).
 *
 * 법령 근거:
 *  - 상속세 과세가액·사전증여재산 합산: 상속세및증여세법 제13조(상속인
 *    10년 이내, 상속인 아닌 자 5년 이내)
 *  - 기초공제(2억원): 제18조제1항
 *  - 그 밖의 인적공제(자녀·미성년자·연로자·장애인): 제20조제1항
 *  - 일괄공제(5억원, 배우자 단독상속 시 적용 배제): 제21조
 *  - 배우자상속공제(min(실제상속액, 법정상속분가액, 30억원), 하한 5억원):
 *    제19조. 법정상속분은 민법 제1009조(배우자는 직계비속 몫의 5할 가산)
 *  - 금융재산상속공제(순금융재산 20%, 2천만원~2억원): 제22조
 *  - 동거주택상속공제(상속주택가액의 100%, 한도 6억원): 제23조의2
 *  - 공제 적용 한도: 제24조
 *  - 상속세율(누진, 증여세와 동일 브래킷): 제26조(제56조가 준용하는 표와
 *    동일 — `giftTaxCalculator.ts`의 `GIFT_TAX_BRACKETS` 재사용)
 *  - 세대생략 할증과세(30%, 미성년자+20억원 초과 40%, 대습상속 제외):
 *    제27조
 *  - 증여세액공제(이중과세 조정): 제28조
 *  - 신고세액공제(3%): 제69조제1항 (증여세 제69조제2항과 동일 세율 —
 *    `giftTaxCalculator.ts`의 `FILING_TAX_CREDIT_RATE` 재사용)
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md → "생활 > 상속세
 *    계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의 클라이언트
 * 스크립트에서 import 하여 사용합니다.
 */

import { progressiveTax } from './propertyTaxCalculator';
import {
  GIFT_TAX_BRACKETS,
  FILING_TAX_CREDIT_RATE,
  GENERATION_SKIP_SURCHARGE_RATE,
  GENERATION_SKIP_SURCHARGE_RATE_MINOR_HIGH_VALUE,
  GENERATION_SKIP_MINOR_HIGH_VALUE_THRESHOLD,
} from './giftTaxCalculator';

/** 기초공제. 상속세및증여세법 제18조제1항. */
export const BASIC_DEDUCTION = 200_000_000;
/** 자녀공제(1인당). 제20조제1항제1호. */
export const CHILD_DEDUCTION_PER_PERSON = 50_000_000;
/** 미성년자공제(19세까지 잔여연수 1년당). 제20조제1항제2호. */
export const MINOR_DEDUCTION_PER_YEAR = 10_000_000;
/** 연로자공제(65세 이상, 1인당). 제20조제1항제3호. */
export const ELDERLY_DEDUCTION_PER_PERSON = 50_000_000;
/** 장애인공제(기대여명 1년당). 제20조제1항제4호. */
export const DISABLED_DEDUCTION_PER_YEAR = 10_000_000;
/** 일괄공제. 제21조제1항. */
export const LUMP_SUM_DEDUCTION = 500_000_000;
/** 배우자상속공제 하한. 제19조제4항. */
export const SPOUSE_DEDUCTION_MIN = 500_000_000;
/** 배우자상속공제 상한. 제19조제1항. */
export const SPOUSE_DEDUCTION_MAX = 3_000_000_000;
/** 금융재산상속공제 상한. 제22조제1항. */
export const FINANCIAL_ASSET_DEDUCTION_CAP = 200_000_000;
/** 금융재산상속공제 정액구간 기준. 제22조제1항. */
export const FINANCIAL_ASSET_DEDUCTION_FLAT_THRESHOLD = 20_000_000;
/** 동거주택상속공제 상한. 제23조의2제1항. */
export const RESIDENCE_DEDUCTION_CAP = 600_000_000;

export type HeirComposition = '배우자와_자녀' | '자녀만' | '배우자단독';

export interface InheritanceTaxInput {
  /** 총 상속재산가액(원). */
  grossEstate: number;
  /** 채무(원). */
  debts: number;
  /** 장례비용(원). */
  funeralExpenses: number;
  hasSpouse: boolean;
  /** 배우자가 실제 상속받는 금액(원, 배우자가 있을 때만 의미). */
  spouseActualInheritance: number;
  /** 자녀(직계비속) 수. */
  childCount: number;
  /** 미성년 자녀들의 만19세까지 잔여연수 합계. */
  minorChildRemainingYearsTotal: number;
  /** 65세 이상 상속인 수(배우자 제외). */
  elderlyHeirCount: number;
  /** 장애인 상속인 수. */
  disabledHeirCount: number;
  /** 장애인 상속인들의 기대여명연수 합계. */
  disabledLifeExpectancyYearsTotal: number;
  /** 금융재산상속공제 적용 여부. */
  applyFinancialAssetDeduction: boolean;
  /** 순금융재산가액(금융재산 - 금융채무, 원). */
  netFinancialAssets: number;
  /** 동거주택상속공제 적용 여부(요건 충족을 사용자가 확인). */
  applyResidenceDeduction: boolean;
  /** 동거주택가액(원). */
  inheritedHouseValue: number;
  /** 세대생략 상속(피상속인의 자녀가 아닌 직계비속이 상속) 여부. */
  isGenerationSkipping: boolean;
  /** 세대생략 상속인이 받는 재산가액(원). */
  generationSkippingAmount: number;
  /** 세대생략 상속인이 미성년자인지(할증률 40% 판정용). */
  isGenerationSkippingHeirMinor: boolean;
  /** 대습상속이라 세대생략 할증이 배제되는지. */
  isGenerationSkipSurchargeExempt: boolean;
  /** 법정신고기한(상속개시일이 속한 달의 말일부터 6개월) 내 신고 여부. */
  filedOnTime: boolean;
  /** 사전증여재산 합산 대상이 있는지. */
  hasPriorGifts: boolean;
  /** 상속개시일 전 10년 이내 상속인에게 사전증여한 재산가액 합계. */
  priorGiftToHeirs: number;
  /** 상속개시일 전 5년 이내 상속인이 아닌 자에게 사전증여한 재산가액 합계. */
  priorGiftToNonHeirs: number;
  /** 그 사전증여재산들에서 이미 사용한 증여재산공제 합계(공제한도 계산용). */
  priorGiftDeductionUsed: number;
  /** 그 사전증여재산들에 대해 이미 납부(결정)된 증여세액 합계(증여세액공제용). */
  priorGiftTaxPaid: number;
}

export interface InheritanceTaxResult {
  heirComposition: HeirComposition | null;
  /** 상속세 과세가액 = 총상속재산 − 채무 − 장례비용 + 사전증여재산가산액. */
  taxableValue: number;
  priorGiftAmount: number;
  spouseStatutoryShare: number;
  basicDeduction: number;
  childDeduction: number;
  minorDeduction: number;
  elderlyDeduction: number;
  disabledDeduction: number;
  personalDeductionTotal: number;
  /** 일괄공제 적용 여부(배우자 단독상속이면 불가). */
  useLumpSum: boolean;
  /** 기초공제+인적공제 vs 일괄공제 중 적용된 금액. */
  basicAndPersonalDeduction: number;
  spouseDeduction: number;
  financialAssetDeduction: number;
  residenceDeduction: number;
  /** 공제 적용 한도(제24조) 적용 전 공제 합계 신청액. */
  deductionRequested: number;
  /** 공제 적용 한도. */
  deductionLimit: number;
  /** 공제 적용 한도 반영 후 실제 적용 공제 합계. */
  totalDeductionApplied: number;
  taxBase: number;
  calculatedTax: number;
  generationSkipSurcharge: number;
  taxAfterSurcharge: number;
  giftTaxCredit: number;
  taxAfterGiftCredit: number;
  filingTaxCredit: number;
  finalTax: number;
}

function heirComposition(hasSpouse: boolean, childCount: number): HeirComposition | null {
  if (hasSpouse && childCount > 0) return '배우자와_자녀';
  if (!hasSpouse && childCount > 0) return '자녀만';
  if (hasSpouse && childCount === 0) return '배우자단독';
  return null;
}

function spouseStatutoryShareOf(hasSpouse: boolean, childCount: number): number {
  if (!hasSpouse) return 0;
  if (childCount === 0) return 1;
  return 1.5 / (1.5 + childCount);
}

/** 상속재산·상속인 구성을 반영해 상속세 결정세액을 계산합니다. */
export function calculateInheritanceTax(input: InheritanceTaxInput): InheritanceTaxResult {
  const grossEstate = Math.max(0, input.grossEstate || 0);
  const debts = Math.max(0, input.debts || 0);
  const funeralExpenses = Math.max(0, input.funeralExpenses || 0);
  const childCount = Math.max(0, Math.floor(input.childCount || 0));
  const composition = heirComposition(input.hasSpouse, childCount);

  const priorGiftAmount = input.hasPriorGifts
    ? Math.max(0, input.priorGiftToHeirs || 0) + Math.max(0, input.priorGiftToNonHeirs || 0)
    : 0;
  const priorGiftDeductionUsed = input.hasPriorGifts
    ? Math.max(0, input.priorGiftDeductionUsed || 0)
    : 0;
  const priorGiftTaxPaid = input.hasPriorGifts ? Math.max(0, input.priorGiftTaxPaid || 0) : 0;

  const taxableValue = Math.max(0, grossEstate - debts - funeralExpenses) + priorGiftAmount;

  const spouseShare = spouseStatutoryShareOf(input.hasSpouse, childCount);

  // 기초공제 + 인적공제
  const basicDeduction = BASIC_DEDUCTION;
  const childDeduction = childCount * CHILD_DEDUCTION_PER_PERSON;
  const minorDeduction =
    Math.max(0, input.minorChildRemainingYearsTotal || 0) * MINOR_DEDUCTION_PER_YEAR;
  const elderlyDeduction =
    Math.max(0, Math.floor(input.elderlyHeirCount || 0)) * ELDERLY_DEDUCTION_PER_PERSON;
  const disabledDeduction =
    Math.max(0, input.disabledLifeExpectancyYearsTotal || 0) * DISABLED_DEDUCTION_PER_YEAR;
  const personalDeductionTotal = childDeduction + minorDeduction + elderlyDeduction + disabledDeduction;

  // 일괄공제: 배우자 단독상속이면 적용 불가(기초공제+인적공제만)
  const useLumpSum = composition !== '배우자단독';
  const basicAndPersonal = useLumpSum
    ? Math.max(LUMP_SUM_DEDUCTION, basicDeduction + personalDeductionTotal)
    : basicDeduction + personalDeductionTotal;

  // 배우자상속공제 (제19조)
  let spouseDeduction = 0;
  if (input.hasSpouse) {
    const statutoryValue = taxableValue * spouseShare;
    const spouseActual = Math.max(0, input.spouseActualInheritance || 0);
    const raw = Math.min(spouseActual, statutoryValue, SPOUSE_DEDUCTION_MAX);
    spouseDeduction = Math.max(SPOUSE_DEDUCTION_MIN, raw);
  }

  // 금융재산상속공제 (제22조)
  let financialAssetDeduction = 0;
  if (input.applyFinancialAssetDeduction) {
    const net = Math.max(0, input.netFinancialAssets || 0);
    const raw =
      net <= FINANCIAL_ASSET_DEDUCTION_FLAT_THRESHOLD
        ? net
        : Math.max(net * 0.2, FINANCIAL_ASSET_DEDUCTION_FLAT_THRESHOLD);
    financialAssetDeduction = Math.min(raw, FINANCIAL_ASSET_DEDUCTION_CAP);
  }

  // 동거주택상속공제 (제23조의2)
  let residenceDeduction = 0;
  if (input.applyResidenceDeduction) {
    residenceDeduction = Math.min(
      Math.max(0, input.inheritedHouseValue || 0),
      RESIDENCE_DEDUCTION_CAP,
    );
  }

  const deductionRequested =
    basicAndPersonal + spouseDeduction + financialAssetDeduction + residenceDeduction;

  // 공제 적용 한도 (제24조): 과세가액 - 유증재산(0, 스코프아웃) - (사전증여재산 - 기사용 증여재산공제)
  const deductionLimit = Math.max(
    0,
    taxableValue - Math.max(0, priorGiftAmount - priorGiftDeductionUsed),
  );
  const totalDeductionApplied = Math.min(deductionRequested, deductionLimit);

  const taxBase = Math.max(0, taxableValue - totalDeductionApplied);
  const calculatedTax = progressiveTax(taxBase, GIFT_TAX_BRACKETS);

  let generationSkipSurcharge = 0;
  if (input.isGenerationSkipping && !input.isGenerationSkipSurchargeExempt && grossEstate > 0) {
    const amount = Math.max(0, input.generationSkippingAmount || 0);
    const ratio = Math.min(1, amount / grossEstate);
    const rate =
      input.isGenerationSkippingHeirMinor && amount > GENERATION_SKIP_MINOR_HIGH_VALUE_THRESHOLD
        ? GENERATION_SKIP_SURCHARGE_RATE_MINOR_HIGH_VALUE
        : GENERATION_SKIP_SURCHARGE_RATE;
    generationSkipSurcharge = calculatedTax * ratio * rate;
  }
  const taxAfterSurcharge = calculatedTax + generationSkipSurcharge;

  const giftTaxCredit = Math.min(priorGiftTaxPaid, taxAfterSurcharge);
  const taxAfterGiftCredit = taxAfterSurcharge - giftTaxCredit;

  const filingTaxCredit = input.filedOnTime ? taxAfterGiftCredit * FILING_TAX_CREDIT_RATE : 0;
  const finalTax = taxAfterGiftCredit - filingTaxCredit;

  return {
    heirComposition: composition,
    taxableValue,
    priorGiftAmount,
    spouseStatutoryShare: spouseShare,
    basicDeduction,
    childDeduction,
    minorDeduction,
    elderlyDeduction,
    disabledDeduction,
    personalDeductionTotal,
    useLumpSum,
    basicAndPersonalDeduction: basicAndPersonal,
    spouseDeduction,
    financialAssetDeduction,
    residenceDeduction,
    deductionRequested,
    deductionLimit,
    totalDeductionApplied,
    taxBase,
    calculatedTax,
    generationSkipSurcharge,
    taxAfterSurcharge,
    giftTaxCredit,
    taxAfterGiftCredit,
    filingTaxCredit,
    finalTax,
  };
}
