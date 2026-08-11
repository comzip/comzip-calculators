/**
 * 주택 양도소득세(현행법) 계산 모듈.
 *
 * `capitalGainsTaxReformCalculator.ts`의 `calculateCapitalGainsReformTax`를
 * `year: 2026`(개편안 미적용, 현행법 그대로)으로 고정 호출하는 얇은 래퍼입니다.
 * 원본 파일은 건드리지 않습니다 — 그 파일의 2026년 경로는 이미
 * law.go.kr 조문(소득세법 제89조제1항제3호·제95조제2항·제103조제1항·
 * 제104조제1항~제3호·제5항·제7항, 시행령 제154조제1항)과 직접 대조 검증됐고,
 * 세율·공제 로직을 이원화하면 향후 세법 개정을 두 곳에 반영해야 하는 위험이
 * 생기기 때문입니다(`comprehensiveTaxReformCalculator.ts`가
 * `propertyTaxCalculator.ts`를 건드리지 않고 재사용하는 것과 같은 이유).
 *
 * 이 모듈이 추가로 책임지는 부분은 오직 **양도차익 계산**입니다 —
 * 개편안 계산기는 사용자가 양도차익을 직접 계산해서 입력해야 하지만, 이
 * 계산기는 취득가액·필요경비·양도가액을 입력받아 양도차익을 대신 계산합니다.
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 양도소득세 계산기(현행법)". 값을 갱신하면 그 문서도 함께
 *    갱신하세요.
 */

import {
  calculateCapitalGainsReformTax,
  type CgtHouseCount,
} from './capitalGainsTaxReformCalculator';

export type { CgtHouseCount };

export interface CapitalGainsTaxInput {
  /** 취득가액, 원. */
  acquisitionPrice: number;
  /** 필요경비(취득세·중개수수료·자본적지출 등 합계), 원. 기본값 0. */
  necessaryExpenses?: number;
  /** 양도가액, 원. 1세대1주택 비과세(12억원 이하) 판정에 쓰인다. */
  saleValue: number;
  /** 주택 수. '1주택'은 1세대1주택자(비과세·특례 적용)를 의미한다. */
  houseCount: CgtHouseCount;
  /** 보유기간(년). 장기보유특별공제·중과 여부 판정에 쓰인다. */
  holdingYears: number;
  /** 거주기간(년). 장기보유특별공제(1세대1주택 특례표) 판정에 쓰인다. */
  residencyYears: number;
  /** 조정대상지역 소재 여부(현재). `houseCount !== '1주택'`일 때만 중과 여부에 반영된다. */
  isRegulatedArea?: boolean;
  /** 취득 당시 조정대상지역이었는지. `houseCount === '1주택'`일 때만 비과세 거주요건에 반영된다. */
  wasRegulatedAreaAtAcquisition?: boolean;
}

export interface CapitalGainsTaxResult {
  /** 양도차익 = 양도가액 − 취득가액 − 필요경비 (0 미만이면 0으로 처리되어 과세대상이 없다). */
  gain: number;
  /** 1세대1주택 비과세(양도가액 12억원 이하) 해당 여부. true면 나머지 값은 모두 0. */
  isExempt: boolean;
  /** 과세대상 양도차익. */
  taxableGain: number;
  /** 적용된 장기보유특별공제 합산 공제율(명목값). */
  longTermDeductionRate: number;
  /** 장기보유특별공제 금액. */
  longTermDeductionAmount: number;
  /** 적용된 양도소득 기본공제(연 250만원). */
  basicDeduction: number;
  /** 과세표준. */
  taxBase: number;
  /** 적용된 다주택자 중과 가산율(0이면 미적용). */
  surchargeRate: number;
  /** 실제로 적용된 단기 보유 단일세율(0.7 또는 0.6). null이면 누진세율표가 적용됨. */
  appliedShortTermRate: number | null;
  /** 산출세액. */
  calculatedTax: number;
  /** 지방소득세 = 산출세액 × 10%. */
  localIncomeTax: number;
  /** 산출세액 + 지방소득세. */
  totalWithSurtax: number;
}

/** 양도소득세(현행법, 2026년 기준 — 세제개편안 미적용)를 계산합니다. */
export function calculateCapitalGainsTax(input: CapitalGainsTaxInput): CapitalGainsTaxResult {
  const gain = input.saleValue - input.acquisitionPrice - (input.necessaryExpenses ?? 0);

  const result = calculateCapitalGainsReformTax({
    year: 2026,
    saleValue: input.saleValue,
    gain,
    houseCount: input.houseCount,
    holdingYears: input.holdingYears,
    residencyYears: input.residencyYears,
    isRegulatedArea: input.isRegulatedArea,
    wasRegulatedAreaAtAcquisition: input.wasRegulatedAreaAtAcquisition,
  });

  return {
    gain,
    isExempt: result.isExempt,
    taxableGain: result.taxableGain,
    longTermDeductionRate: result.longTermDeductionRate,
    longTermDeductionAmount: result.longTermDeductionAmount,
    basicDeduction: result.basicDeduction,
    taxBase: result.taxBase,
    surchargeRate: result.surchargeRate,
    appliedShortTermRate: result.appliedShortTermRate,
    calculatedTax: result.calculatedTax,
    localIncomeTax: result.localIncomeTax,
    totalWithSurtax: result.totalWithSurtax,
  };
}
