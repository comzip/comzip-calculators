/**
 * 증여세 계산 모듈. 증여재산가액과 증여자-수증자 관계를 입력하면 증여재산공제·
 * 누진세율·신고세액공제를 반영한 결정세액을 계산합니다.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 증여재산의 시가 평가(부동산·비상장주식 등)는
 * 다루지 않으며, 사용자가 입력한 증여재산가액을 그대로 과세가액 산정에
 * 사용합니다. 부담부증여(채무 인수분 차감), 비거주자 특례, 공익법인 출연 등은
 * 반영하지 않습니다.
 *
 * 법령 근거:
 *  - 증여재산공제: 상속세및증여세법 제53조(배우자 6억원, 직계존속 5천만원·
 *    미성년자 2천만원, 직계비속 5천만원, 기타친족 1천만원 — 10년간 합산 한도)
 *  - 혼인·출산 증여재산공제: 상속세및증여세법 제53조의2(직계존속으로부터 증여
 *    받는 경우에 한해 최대 1억원, 제53조 공제와 별도)
 *  - 10년 이내 동일인 증여재산 합산과세: 상속세및증여세법 제47조제2항
 *    (직계존속인 경우 그 배우자 포함, 합계 1천만원 이상이면 합산)
 *  - 증여세율(누진): 상속세및증여세법 제56조(제26조 준용) — 1억원 이하 10%,
 *    5억원 이하 20%, 10억원 이하 30%, 30억원 이하 40%, 30억원 초과 50%
 *  - 세대생략 할증과세: 상속세및증여세법 제57조(30%, 미성년자+20억원 초과
 *    40% — 증여자의 최근친 직계비속 사망으로 인한 대습증여는 제외)
 *  - 기납부세액공제(이중과세 조정): 상속세및증여세법 제58조
 *  - 신고세액공제: 상속세및증여세법 제69조제2항(3%, 법정신고기한 내 신고 시)
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 증여세 계산기"는 아니고 "생활" 또는 신설 섹션 참고 —
 *    실제 위치는 LEGAL_REFERENCES.md 참고. 값을 갱신하면 그 문서도 함께
 *    갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의 클라이언트
 * 스크립트에서 import 하여 사용합니다.
 */

import { progressiveTax, type TaxBracket } from './propertyTaxCalculator';

/** 증여자-수증자 관계. 상속세및증여세법 제53조 각 호. */
export type GiftRelationship = '배우자' | '직계존속' | '직계비속' | '기타친족' | '기타';

/** 증여재산공제 한도(원). 상속세및증여세법 제53조. */
export const SPOUSE_DEDUCTION = 600_000_000;
export const ANCESTOR_DEDUCTION_ADULT = 50_000_000;
export const ANCESTOR_DEDUCTION_MINOR = 20_000_000;
export const DESCENDANT_DEDUCTION = 50_000_000;
export const OTHER_RELATIVE_DEDUCTION = 10_000_000;

/** 혼인·출산 증여재산공제 한도(원). 상속세및증여세법 제53조의2. 직계존속→수증자 방향만 해당. */
export const MARRIAGE_CHILDBIRTH_DEDUCTION = 100_000_000;

/** 증여세율표. 상속세및증여세법 제56조(제26조 준용). */
export const GIFT_TAX_BRACKETS: TaxBracket[] = [
  { upTo: 100_000_000, rate: 0.1 }, // 1억원 이하 10%
  { upTo: 500_000_000, rate: 0.2 }, // ~5억원 20%
  { upTo: 1_000_000_000, rate: 0.3 }, // ~10억원 30%
  { upTo: 3_000_000_000, rate: 0.4 }, // ~30억원 40%
  { upTo: Infinity, rate: 0.5 }, // 30억원 초과 50%
];

/** 세대생략 할증률. 상속세및증여세법 제57조제1항. */
export const GENERATION_SKIP_SURCHARGE_RATE = 0.3;
export const GENERATION_SKIP_SURCHARGE_RATE_MINOR_HIGH_VALUE = 0.4;
export const GENERATION_SKIP_MINOR_HIGH_VALUE_THRESHOLD = 2_000_000_000;

/** 신고세액공제율. 상속세및증여세법 제69조제2항. */
export const FILING_TAX_CREDIT_RATE = 0.03;

/** 10년 합산과세 대상 최소 금액. 상속세및증여세법 제47조제2항. */
export const AGGREGATION_MINIMUM = 10_000_000;

export interface GiftTaxInput {
  /** 이번 증여재산가액(원). */
  giftAmount: number;
  /** 증여자-수증자 관계. */
  relationship: GiftRelationship;
  /** 수증자가 미성년자인지(직계존속으로부터 증여받는 경우에만 공제액에 영향). */
  isMinor: boolean;
  /** 혼인·출산 증여재산공제 적용 여부(직계존속으로부터 증여받는 경우만 가능). */
  applyMarriageChildbirthDeduction: boolean;
  /** 세대를 건너뛴 증여(예: 조부모→손자녀)인지. */
  isGenerationSkipping: boolean;
  /** 세대생략이지만 증여자의 최근친 직계비속 사망으로 인한 대습증여라 할증 제외 대상인지. */
  isGenerationSkipSurchargeExempt: boolean;
  /** 법정신고기한(증여일이 속한 달의 말일부터 3개월) 이내에 신고하는지. */
  filedOnTime: boolean;
  /** 10년 이내 동일인(직계존속이면 그 배우자 포함)에게 받은 기증여재산가액 합계(원). */
  priorGiftAmount: number;
  /** 그 기증여에서 이미 사용한 증여재산공제 합계(원). */
  priorDeductionUsed: number;
  /** 그 기증여에 대해 이미 납부(결정)된 증여세액(원) — 기납부세액공제용. */
  priorTaxPaid: number;
}

export interface GiftTaxResult {
  /** 관계별 증여재산공제 한도(혼인·출산공제 제외). */
  relationshipDeductionLimit: number;
  /** 혼인·출산 증여재산공제 적용액. */
  marriageChildbirthDeduction: number;
  /** 이번 증여에 실제로 적용 가능한 공제 총액(10년간 기사용분 차감, 과세가액 한도 내). */
  appliedDeduction: number;
  /** 합산과세 여부(10년 이내 동일인 기증여재산가액이 1천만원 이상). */
  isAggregated: boolean;
  /** 증여세 과세가액 = 이번 증여재산가액 + (합산 대상이면) 기증여재산가액. */
  taxableValue: number;
  /** 증여세 과세표준 = 과세가액 − 적용 공제. */
  taxBase: number;
  /** 누진세율 적용 산출세액(합산 기준, 할증 전). */
  calculatedTax: number;
  /** 세대생략 할증세액. */
  generationSkipSurcharge: number;
  /** 할증 반영 후 산출세액. */
  taxAfterSurcharge: number;
  /** 기납부세액공제(이중과세 조정). */
  priorTaxCredit: number;
  /** 기납부세액공제 반영 후 세액. */
  taxAfterPriorCredit: number;
  /** 신고세액공제(3%). */
  filingTaxCredit: number;
  /** 최종 결정세액(자진납부할 세액). */
  finalTax: number;
}

function relationshipDeductionLimit(relationship: GiftRelationship, isMinor: boolean): number {
  switch (relationship) {
    case '배우자':
      return SPOUSE_DEDUCTION;
    case '직계존속':
      return isMinor ? ANCESTOR_DEDUCTION_MINOR : ANCESTOR_DEDUCTION_ADULT;
    case '직계비속':
      return DESCENDANT_DEDUCTION;
    case '기타친족':
      return OTHER_RELATIVE_DEDUCTION;
    case '기타':
      return 0;
  }
}

/** 증여재산가액과 증여자-수증자 관계를 반영해 증여세 결정세액을 계산합니다. */
export function calculateGiftTax(input: GiftTaxInput): GiftTaxResult {
  const giftAmount = Math.max(0, input.giftAmount || 0);
  const priorGiftAmount = Math.max(0, input.priorGiftAmount || 0);
  const priorDeductionUsed = Math.max(0, input.priorDeductionUsed || 0);
  const priorTaxPaid = Math.max(0, input.priorTaxPaid || 0);

  const isAggregated = priorGiftAmount >= AGGREGATION_MINIMUM;
  const taxableValue = giftAmount + (isAggregated ? priorGiftAmount : 0);

  const canApplyMarriageChildbirth =
    input.relationship === '직계존속' && input.applyMarriageChildbirthDeduction;
  const relLimit = relationshipDeductionLimit(input.relationship, input.isMinor);
  const marriageChildbirthDeduction = canApplyMarriageChildbirth
    ? MARRIAGE_CHILDBIRTH_DEDUCTION
    : 0;

  const deductionAvailable = Math.max(
    0,
    relLimit + marriageChildbirthDeduction - priorDeductionUsed,
  );
  const appliedDeduction = Math.min(deductionAvailable, taxableValue);

  const taxBase = Math.max(0, taxableValue - appliedDeduction);
  const calculatedTax = progressiveTax(taxBase, GIFT_TAX_BRACKETS);

  let generationSkipSurcharge = 0;
  if (input.isGenerationSkipping && !input.isGenerationSkipSurchargeExempt) {
    const rate =
      input.isMinor && giftAmount > GENERATION_SKIP_MINOR_HIGH_VALUE_THRESHOLD
        ? GENERATION_SKIP_SURCHARGE_RATE_MINOR_HIGH_VALUE
        : GENERATION_SKIP_SURCHARGE_RATE;
    generationSkipSurcharge = calculatedTax * rate;
  }
  const taxAfterSurcharge = calculatedTax + generationSkipSurcharge;

  const priorTaxCredit = Math.min(priorTaxPaid, taxAfterSurcharge);
  const taxAfterPriorCredit = taxAfterSurcharge - priorTaxCredit;

  const filingTaxCredit = input.filedOnTime ? taxAfterPriorCredit * FILING_TAX_CREDIT_RATE : 0;
  const finalTax = taxAfterPriorCredit - filingTaxCredit;

  return {
    relationshipDeductionLimit: relLimit,
    marriageChildbirthDeduction,
    appliedDeduction,
    isAggregated,
    taxableValue,
    taxBase,
    calculatedTax,
    generationSkipSurcharge,
    taxAfterSurcharge,
    priorTaxCredit,
    taxAfterPriorCredit,
    filingTaxCredit,
    finalTax,
  };
}
