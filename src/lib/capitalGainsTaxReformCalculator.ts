/**
 * 주택 양도소득세 "2026년 세제개편안" 미리보기 계산 모듈.
 *
 * ======================== ⚠️ 이 모듈은 법령이 아닙니다 ========================
 * 재정경제부(구 기획재정부)가 2026-08-03 발표한 "2026년 세제개편안"의 양도소득세
 * 개편 방향을 미리 계산해보는 시뮬레이션입니다. 이 개편안은 아직 입법예고·
 * 국무회의·국회 통과를 거치지 않았으며, 국회 심의 과정에서 내용이 달라지거나
 * 폐기될 수 있습니다. 개편 관련 상수(장기거주소득공제·기본공제 확대·중과
 * 한시완화)는 law.go.kr이 아니라 재정경제부 "2026년 세제개편안" 상세본(조문
 * 대비표, mofe.go.kr)을 근거로 하며, 이는 LEGAL_REFERENCES.md의 "공식 출처만
 * 인용" 원칙에 대한 예외입니다. 다만 기본세율표(소득세법 제55조)는 이번 개편과
 * 무관한 안정적 현행 법령이라 law.go.kr을 그대로 인용합니다.
 * ============================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 양도세 개편안 미리보기 계산기". 개편안이 국회를 통과해 정식
 *    조문이 확정되면 이 모듈과 그 문서를 law.go.kr 인용으로 교체해야 합니다.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의 클라이언트
 * 스크립트에서 import 하여 사용합니다.
 */

import { progressiveTax, type TaxBracket } from './propertyTaxCalculator';

// ============================================================
// 개편 시행 연도. 항목마다 시행일이 달라 연도별로 적용되는 조항이 다르다.
//  - 2026년: 전부 현행법(개편안 미적용)
//  - 2027년: 기본공제 확대(§103)·다주택 중과 한시완화(§104⑦) 시행. 장기보유
//    특별공제 개편(§95②·⑥)은 아직 미적용(2028.1.1.부터).
//  - 2028년: 장기보유특별공제 개편 1단계 + 공제한도 신설. 중과완화 폭 축소.
//  - 2029년: 장기보유특별공제 최종(거주공제만). 공제한도 축소. 중과완화 종료
//    (현행 수준으로 복귀).
// ============================================================

export type CgtReformYear = 2026 | 2027 | 2028 | 2029;

/** 양도소득세 맥락의 주택 수 — '1주택'은 1세대1주택자(비과세·특례 대상)를 뜻한다. */
export type CgtHouseCount = '1주택' | '2주택' | '3주택이상';

// ============================================================
// 상수
// ============================================================

/** 1세대1주택 비과세 기준 — 양도가액 12억원 이하분은 전액 비과세(소득법 §89①). 개편 대상 아님. */
const SINGLE_HOUSE_EXEMPT_SALE_VALUE = 1_200_000_000;

/** 양도소득 기본공제(연 250만원, 소득법 §103, 현행·전 연도 공통). */
const BASIC_DEDUCTION_DEFAULT = 2_500_000;
/** 장기거주 1주택 기본공제 확대(연 2,500만원, 2027.1.1.~) 요건: 거주기간·양도가액 상한. */
const BASIC_DEDUCTION_LONG_RESIDENCE = 25_000_000;
const BASIC_DEDUCTION_MIN_RESIDENCY_YEARS = 10;
const BASIC_DEDUCTION_MAX_SALE_VALUE = 3_000_000_000;

/** 장기보유특별공제(장기거주소득공제) 최소 요건. */
const MIN_HOLDING_YEARS = 3;
const MIN_RESIDENCY_YEARS_FOR_CREDIT = 2;

/** 공제한도(2028.1.1.~ 신설) — 물건별 한도만 반영(인별 연간 한도는 다른 양도건 합산 정보가 없어 미반영). */
const DEDUCTION_CAP_2028 = 2_000_000_000;
const DEDUCTION_CAP_2029 = 1_000_000_000;

/** 다주택자 조정대상지역 중과 가산율 — 연도별(현행/한시완화). */
const SURCHARGE_2HOUSE: Record<CgtReformYear, number> = { 2026: 0.2, 2027: 0.05, 2028: 0.1, 2029: 0.2 };
const SURCHARGE_3HOUSE: Record<CgtReformYear, number> = { 2026: 0.3, 2027: 0.1, 2028: 0.15, 2029: 0.3 };
/** 중과 적용 최소 보유기간(년). */
const SURCHARGE_MIN_HOLDING_YEARS = 2;

/** 지방소득세율 — 양도소득세 산출세액의 10%(지방세법, 개편 대상 아님). */
const LOCAL_INCOME_TAX_RATE = 0.1;

/**
 * 현행 소득세 기본세율표(소득세법 제55조, 종합·양도소득 공통 누진세율).
 * 이번 부동산 세제개편과 무관한 안정적 현행 법령이라 law.go.kr을 그대로
 * 인용할 수 있다 — LEGAL_REFERENCES.md "공식 출처만 인용" 예외 대상이 아니다.
 */
const INCOME_TAX_BRACKETS: TaxBracket[] = [
  { upTo: 14_000_000, rate: 0.06 },
  { upTo: 50_000_000, rate: 0.15 },
  { upTo: 88_000_000, rate: 0.24 },
  { upTo: 150_000_000, rate: 0.35 },
  { upTo: 300_000_000, rate: 0.38 },
  { upTo: 500_000_000, rate: 0.4 },
  { upTo: 1_000_000_000, rate: 0.42 },
  { upTo: Infinity, rate: 0.45 },
];

// ============================================================
// 타입
// ============================================================

export interface CapitalGainsReformInput {
  /** 계산 기준 연도. 2026년은 현행법(개편안 미적용)으로 그대로 계산한다. */
  year: CgtReformYear;
  /** 양도가액, 원. 1세대1주택 비과세(12억원 이하)·기본공제 확대(30억원 이하) 판정에 쓰인다. */
  saleValue: number;
  /** 양도차익(양도가액 − 취득가액 − 필요경비 등, 이미 계산된 값), 원. */
  gain: number;
  /** 주택 수. '1주택'은 1세대1주택자(비과세·특례 적용)를 의미한다. */
  houseCount: CgtHouseCount;
  /** 보유기간(년). 장기보유특별공제·중과 여부 판정에 쓰인다. */
  holdingYears: number;
  /** 거주기간(년). 장기거주소득공제·기본공제 확대 판정에 쓰인다. */
  residencyYears: number;
  /** 조정대상지역 소재 여부. `houseCount !== '1주택'`일 때만 중과 여부에 반영된다. */
  isRegulatedArea?: boolean;
}

export interface CapitalGainsReformResult {
  year: CgtReformYear;
  /** 1세대1주택 비과세(양도가액 12억원 이하) 해당 여부. true면 나머지 값은 모두 0. */
  isExempt: boolean;
  /** 과세대상 양도차익 — 1세대1주택은 양도차익 × (양도가액−12억)/양도가액, 다주택자는 양도차익 전액. */
  taxableGain: number;
  /** 적용된 장기보유특별공제(장기거주소득공제) 합산 공제율(한도 적용 전 명목값). */
  longTermDeductionRate: number;
  /** 장기보유특별공제 금액(연도별 금액 한도 적용 후 최종값). */
  longTermDeductionAmount: number;
  /** 적용된 양도소득 기본공제(연 250만원 또는 장기거주 확대 연 2,500만원). */
  basicDeduction: number;
  /** 과세표준 = max(0, 과세대상 양도차익 − 장기보유특별공제 − 기본공제). */
  taxBase: number;
  /** 적용된 다주택자 중과 가산율(0이면 미적용). */
  surchargeRate: number;
  /** 산출세액 — 기본세율표(+중과 가산율)를 과세표준에 적용한 값. */
  calculatedTax: number;
  /** 지방소득세 = 산출세액 × 10%. */
  localIncomeTax: number;
  /** 산출세액 + 지방소득세. */
  totalWithSurtax: number;
}

// ============================================================
// 내부 헬퍼
// ============================================================

function resolveTaxableGain(input: CapitalGainsReformInput): { taxableGain: number; isExempt: boolean } {
  if (input.houseCount !== '1주택') {
    return { taxableGain: Math.max(0, input.gain), isExempt: false };
  }
  if (input.saleValue <= SINGLE_HOUSE_EXEMPT_SALE_VALUE) {
    return { taxableGain: 0, isExempt: true };
  }
  const taxablePortion = (input.saleValue - SINGLE_HOUSE_EXEMPT_SALE_VALUE) / input.saleValue;
  return { taxableGain: Math.max(0, input.gain) * taxablePortion, isExempt: false };
}

function resolveBasicDeduction(input: CapitalGainsReformInput): number {
  const longResidenceEligible =
    input.year >= 2027 &&
    input.houseCount === '1주택' &&
    input.residencyYears >= BASIC_DEDUCTION_MIN_RESIDENCY_YEARS &&
    input.saleValue <= BASIC_DEDUCTION_MAX_SALE_VALUE;
  return longResidenceEligible ? BASIC_DEDUCTION_LONG_RESIDENCE : BASIC_DEDUCTION_DEFAULT;
}

/** 정률(연 N%, 최대 M%) 공제율 — Math.min으로 상한을 적용하는 흔한 패턴을 하나로 묶는다. */
function annualRate(years: number, perYear: number, cap: number): number {
  return Math.min(cap, Math.max(0, years) * perYear);
}

function resolveLongTermDeductionRate(input: CapitalGainsReformInput): number {
  const { year, houseCount, holdingYears, residencyYears } = input;
  if (holdingYears < MIN_HOLDING_YEARS) return 0;

  if (houseCount === '1주택') {
    // 1세대1주택은 거주요건(2년 이상)도 충족해야 공제 자체가 시작된다.
    if (residencyYears < MIN_RESIDENCY_YEARS_FOR_CREDIT) return 0;
    if (year <= 2027) {
      // 현행: 거주 연4%(최대40%) + 보유 연4%(최대40%), 합산 최대 80%.
      return annualRate(residencyYears, 0.04, 0.4) + annualRate(holdingYears, 0.04, 0.4);
    }
    if (year === 2028) {
      // 1단계: 거주 연6%(최대60%) + 보유 연2%(최대20%).
      return annualRate(residencyYears, 0.06, 0.6) + annualRate(holdingYears, 0.02, 0.2);
    }
    // 2029년~: 거주공제만 연8%(최대80%), 보유공제 폐지.
    return annualRate(residencyYears, 0.08, 0.8);
  }

  // 다주택자(2·3주택)
  if (year <= 2027) {
    // 현행: 보유공제만 연2%(최대30%), 거주공제 없음.
    return annualRate(holdingYears, 0.02, 0.3);
  }
  const holdingRate = annualRate(holdingYears, 0.01, 0.15);
  const residenceRate = residencyYears >= MIN_RESIDENCY_YEARS_FOR_CREDIT ? annualRate(residencyYears, 0.02, 0.3) : 0;
  if (year === 2028) {
    // 2단계: 거주공제(연2%, 최대30%)와 보유공제(연1%, 최대15%) 중 유리한 쪽.
    return Math.max(holdingRate, residenceRate);
  }
  // 2029년~: 거주공제만 연2%(최대30%), 2년 미만 거주 시 0.
  return residenceRate;
}

function resolveDeductionCap(year: CgtReformYear): number {
  if (year === 2028) return DEDUCTION_CAP_2028;
  if (year === 2029) return DEDUCTION_CAP_2029;
  return Infinity; // 2026·2027년은 공제한도 자체가 없다(§95⑥은 2028.1.1. 시행).
}

function resolveSurchargeRate(input: CapitalGainsReformInput): number {
  if (input.houseCount === '1주택' || !input.isRegulatedArea) return 0;
  if (input.holdingYears < SURCHARGE_MIN_HOLDING_YEARS) return 0;
  const table = input.houseCount === '2주택' ? SURCHARGE_2HOUSE : SURCHARGE_3HOUSE;
  return table[input.year];
}

// ============================================================
// 메인 진입점
// ============================================================

/** 연도별 양도소득세(개편안 기준)를 계산합니다. */
export function calculateCapitalGainsReformTax(input: CapitalGainsReformInput): CapitalGainsReformResult {
  const { taxableGain, isExempt } = resolveTaxableGain(input);

  if (isExempt) {
    return {
      year: input.year,
      isExempt: true,
      taxableGain: 0,
      longTermDeductionRate: 0,
      longTermDeductionAmount: 0,
      basicDeduction: 0,
      taxBase: 0,
      surchargeRate: 0,
      calculatedTax: 0,
      localIncomeTax: 0,
      totalWithSurtax: 0,
    };
  }

  const longTermDeductionRate = resolveLongTermDeductionRate(input);
  const deductionCap = resolveDeductionCap(input.year);
  const longTermDeductionAmount = Math.min(taxableGain * longTermDeductionRate, deductionCap);
  const basicDeduction = resolveBasicDeduction(input);
  const taxBase = Math.max(0, taxableGain - longTermDeductionAmount - basicDeduction);

  const surchargeRate = resolveSurchargeRate(input);
  const brackets =
    surchargeRate > 0
      ? INCOME_TAX_BRACKETS.map((bracket) => ({ upTo: bracket.upTo, rate: bracket.rate + surchargeRate }))
      : INCOME_TAX_BRACKETS;
  const calculatedTax = progressiveTax(taxBase, brackets);

  const localIncomeTax = calculatedTax * LOCAL_INCOME_TAX_RATE;
  const totalWithSurtax = calculatedTax + localIncomeTax;

  return {
    year: input.year,
    isExempt: false,
    taxableGain,
    longTermDeductionRate,
    longTermDeductionAmount,
    basicDeduction,
    taxBase,
    surchargeRate,
    calculatedTax,
    localIncomeTax,
    totalWithSurtax,
  };
}

/** 동일 입력으로 2026~2029년 4개 연도를 한 번에 계산합니다(연도별 비교 UI용). */
export function calculateCapitalGainsReformTaxAllYears(
  input: Omit<CapitalGainsReformInput, 'year'>,
): Record<CgtReformYear, CapitalGainsReformResult> {
  return {
    2026: calculateCapitalGainsReformTax({ ...input, year: 2026 }),
    2027: calculateCapitalGainsReformTax({ ...input, year: 2027 }),
    2028: calculateCapitalGainsReformTax({ ...input, year: 2028 }),
    2029: calculateCapitalGainsReformTax({ ...input, year: 2029 }),
  };
}
