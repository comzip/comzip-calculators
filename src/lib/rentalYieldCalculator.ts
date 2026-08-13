/**
 * 부동산 월세 수익률 계산 모듈. 매매가·보증금·월세에 취득세를 반영한
 * 실투자금 기준 세전·세후 수익률을 계산합니다.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 취득세 계산은 `acquisitionTaxCalculator.ts`를
 * 그대로 재사용합니다(재구현하지 않음) — 일시적 2주택 특례, 생애최초 특례감면
 * 등 그 모듈이 반영하지 않는 항목은 이 계산기에도 동일하게 반영되지 않습니다.
 *
 * 주택임대소득세는 **분리과세 기준으로만** 계산합니다(종합과세 비교 없음):
 *  - 1세대 1주택이고 기준시가(공시가격, 매매가와 다름) 12억원 이하면 비과세.
 *  - 연간 월세수입이 2,000만원을 초과하면 분리과세 선택 자체가 불가능해
 *    종합과세(다른 소득과 합산한 누진세율) 의무가 되는데, 이 계산기는
 *    종합과세 세액을 계산하지 않고 안내만 합니다.
 *  - 그 외(2주택 이상, 1주택 고가주택, 오피스텔)는 분리과세 산식을 적용합니다.
 *  - **3주택 이상 보유자의 보증금(전세) 간주임대료는 계산하지 않습니다** —
 *    이는 스코프 선호가 아니라 구조적 한계입니다: 간주임대료는 "보유한 모든
 *    주택의 보증금 합계"가 기준인데, 이 계산기는 물건 1건의 보증금만 입력받아
 *    계산 자체가 불가능합니다.
 *  - 오피스텔은 취득세 계산기와 마찬가지로 주택수 개념이 없어 1주택 비과세
 *    판정을 하지 않고, **사실상 주거용으로 임대한다고 가정**해 분리과세
 *    산식을 그대로 적용합니다. 실제로 업무용으로 임대 중이라면 결과가 다를
 *    수 있습니다.
 *
 * 법령 근거:
 *  - 취득세: acquisitionTaxCalculator.ts 참고(재사용, 이 파일에서 재정의 안 함)
 *  - 분리과세 세율·필요경비율·기본공제: 소득세법 제64조의2제1항제2호가목·제2항
 *  - 분리과세 선택 가능 상한(연 2천만원): 소득세법 제14조제3항제7호
 *  - 1주택 임대소득 비과세(기준시가 12억원): 소득세법 제12조제2호나목
 *  - 개인지방소득세(산출세액의 10%): 지방세법 제92조(종합소득 개인지방소득세
 *    — 분리과세 주택임대소득은 소득세법 §64-2①에 따라 "종합소득 결정세액"의
 *    일부이므로 신고납부 구조인 이 조를 따른다. 예적금 이자소득세가 쓰는
 *    지방세법 §103의13(원천징수 특별징수)과는 다른 조항이니 혼동 주의 —
 *    savingsInterestCalculator.ts 참고)
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 월세 수익률 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

import {
  calculateAcquisitionTax,
  type PropertyType,
  type HouseCountForAcquisition,
  type AcquisitionTaxResult,
} from './acquisitionTaxCalculator';

export type { PropertyType, HouseCountForAcquisition };

/** 임대사업자 등록 여부 — 필요경비율·기본공제에 영향. */
export type RentalRegistrationStatus = '미등록' | '등록임대';

/** 분리과세 선택 가능 상한(연 주택임대 총수입금액). 소득세법 제14조제3항제7호. */
export const SEPARATE_TAXATION_INCOME_CAP = 20_000_000;
/** 1주택 임대소득 비과세 기준시가. 소득세법 제12조제2호나목. */
export const HIGH_VALUE_HOUSE_THRESHOLD = 1_200_000_000;
/** 분리과세 세율. 소득세법 제64조의2제1항제2호가목. */
export const RENTAL_INCOME_TAX_RATE = 0.14;
/** 개인지방소득세율(소득세의 10%). 지방세법 제92조. */
export const LOCAL_INCOME_TAX_RATE = 0.1;

export interface RentalYieldInput {
  /** 매매가, 원. */
  purchasePrice: number;
  /** 보증금, 원. */
  deposit: number;
  /** 월세, 원. */
  monthlyRent: number;
  /** 물건 종류. */
  propertyType: PropertyType;
  /** [주택] 주택 수(취득세 중과 판정과 1주택 비과세 판정에 함께 쓰임). */
  houseCount?: HouseCountForAcquisition;
  /** [주택] 조정대상지역 여부(취득세 중과 판정용). */
  isRegulatedArea?: boolean;
  /** [주택] 전용면적 85㎡ 초과 여부(취득세 농특세 판정용). */
  isOver85Sqm?: boolean;
  /** [주택, 1주택일 때만 의미] 기준시가(공시가격) 12억원 초과(고가주택) 여부. */
  isHighValueHouse?: boolean;
  /** 임대사업자 등록 여부. */
  registrationStatus: RentalRegistrationStatus;
  /** 이 임대소득을 제외한 해당 과세기간 종합소득금액이 2천만원 이하인지. */
  otherIncomeUnder20M: boolean;
}

export type RentalTaxability =
  | { kind: '비과세' }
  | { kind: '분리과세불가_종합과세' }
  | {
      kind: '분리과세';
      necessaryExpenseRatio: number;
      necessaryExpense: number;
      basicDeduction: number;
      businessIncome: number;
      incomeTax: number;
      localIncomeTax: number;
      totalRentalTax: number;
      /** 3주택 이상 보유 시 보증금 간주임대료가 이 계산에 반영되지 않았음을 알리는 플래그. */
      depositImputedIncomeExcluded: boolean;
    };

export interface RentalYieldResult {
  acquisitionTax: AcquisitionTaxResult;
  /** 실투자금 = 매매가 − 보증금 + 취득세등 합계. */
  netCapitalInvested: number;
  /** 연간 월세수입 = 월세 × 12. */
  annualRentIncome: number;
  /** 세전 수익률(%). netCapitalInvested가 0 이하이면 계산 불가(null). */
  preTaxYieldPercent: number | null;
  taxability: RentalTaxability;
  /** 세후 수익률(%). netCapitalInvested가 0 이하이면 계산 불가(null). */
  postTaxYieldPercent: number | null;
}

/** 매매가·보증금·월세·취득세를 반영한 임대 수익률과 분리과세 임대소득세를 계산합니다. */
export function calculateRentalYield(input: RentalYieldInput): RentalYieldResult {
  const purchasePrice = Math.max(0, input.purchasePrice || 0);
  const deposit = Math.max(0, input.deposit || 0);
  const monthlyRent = Math.max(0, input.monthlyRent || 0);
  const houseCount = input.houseCount ?? '1주택';

  const acquisitionTax = calculateAcquisitionTax({
    propertyType: input.propertyType,
    price: purchasePrice,
    houseCount,
    isRegulatedArea: input.isRegulatedArea,
    isOver85Sqm: input.isOver85Sqm,
  });

  const netCapitalInvested = purchasePrice - deposit + acquisitionTax.total;
  const annualRentIncome = monthlyRent * 12;
  const preTaxYieldPercent =
    netCapitalInvested > 0 ? (annualRentIncome / netCapitalInvested) * 100 : null;

  let taxability: RentalTaxability;

  const isOneHouseExempt =
    input.propertyType === '주택' && houseCount === '1주택' && !input.isHighValueHouse;

  if (isOneHouseExempt) {
    taxability = { kind: '비과세' };
  } else if (annualRentIncome > SEPARATE_TAXATION_INCOME_CAP) {
    taxability = { kind: '분리과세불가_종합과세' };
  } else {
    const necessaryExpenseRatio = input.registrationStatus === '등록임대' ? 0.6 : 0.5;
    const necessaryExpense = annualRentIncome * necessaryExpenseRatio;
    const basicDeduction = input.otherIncomeUnder20M
      ? input.registrationStatus === '등록임대'
        ? 4_000_000
        : 2_000_000
      : 0;
    const businessIncome = Math.max(0, annualRentIncome - necessaryExpense - basicDeduction);
    const incomeTax = businessIncome * RENTAL_INCOME_TAX_RATE;
    const localIncomeTax = incomeTax * LOCAL_INCOME_TAX_RATE;

    taxability = {
      kind: '분리과세',
      necessaryExpenseRatio,
      necessaryExpense,
      basicDeduction,
      businessIncome,
      incomeTax,
      localIncomeTax,
      totalRentalTax: incomeTax + localIncomeTax,
      depositImputedIncomeExcluded: houseCount === '3주택' || houseCount === '4주택이상또는법인',
    };
  }

  const totalRentalTax = taxability.kind === '분리과세' ? taxability.totalRentalTax : 0;
  const postTaxYieldPercent =
    netCapitalInvested > 0
      ? ((annualRentIncome - totalRentalTax) / netCapitalInvested) * 100
      : null;

  return {
    acquisitionTax,
    netCapitalInvested,
    annualRentIncome,
    preTaxYieldPercent,
    taxability,
    postTaxYieldPercent,
  };
}
