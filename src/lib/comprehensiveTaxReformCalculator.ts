/**
 * 종합부동산세 "2026년 세제개편안" 미리보기 계산 모듈.
 *
 * ======================== ⚠️ 이 모듈은 법령이 아닙니다 ========================
 * 기획재정부가 2026-08-03 발표한 "2026년 세제개편안"의 종합부동산세 개편
 * 방향을 미리 계산해보는 시뮬레이션입니다. 이 개편안은 아직 입법예고·
 * 국무회의·국회 통과를 거치지 않았으며, 국회 심의 과정에서 내용이 달라지거나
 * 폐기될 수 있습니다. 아래 상수는 law.go.kr이 아니라 언론 보도(복수 매체
 * 교차확인)를 근거로 하며, 이는 LEGAL_REFERENCES.md의 "공식 출처만 인용"
 * 원칙에 대한 유일한 예외입니다.
 *
 * 재산세(지방세) 변경 근거는 발견되지 않아 이 모듈은 종합부동산세만 다룹니다.
 * 재산세·현행 종부세는 `propertyTaxCalculator.ts`(변경하지 않음)를 그대로
 * 이용하세요 — 이 모듈은 그 파일의 공개 export(`progressiveTax`, `TaxBracket`,
 * `HouseCount`, `calculateComprehensiveTax`)만 재사용합니다.
 * ============================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 종부세 개편안 미리보기 계산기". 개편안이 국회를 통과해 정식
 *    조문이 확정되면 이 모듈과 그 문서를 law.go.kr 인용으로 교체해야 합니다.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의 클라이언트
 * 스크립트에서 import 하여 사용합니다.
 */

import {
  progressiveTax,
  calculateComprehensiveTax,
  type TaxBracket,
  type HouseCount,
} from './propertyTaxCalculator';

// ============================================================
// 개편 시행 연도 (2026년은 미적용 = 현행법 그대로)
// ============================================================

export type ReformYear = 2026 | 2027 | 2028 | 2029;

/** 실거주 여부. `houseCount === '1주택'`일 때만 공제금액에 영향을 준다. */
export type ResidencyStatus = '실거주' | '비거주';

// ============================================================
// 상수 (Tier 1 — 복수 언론사 교차확인된 값만 반영)
// ============================================================

/** 2026년(현행법) 종부세 공정시장가액비율. propertyTaxCalculator.ts와 동일. */
const CURRENT_FMV_RATIO = 0.6;

/** 1세대1주택 기본공제 — 실거주 14억원 (2027년부터). */
const DEDUCTION_SINGLE_RESIDING = 1_400_000_000;
/** 1세대1주택 기본공제 — 비거주 9억원 (2027년부터). */
const DEDUCTION_SINGLE_NONRESIDING = 900_000_000;
/** 2·3주택 이상 기본공제 — 9억원(현행 유지, 변경 여부 미확인). */
const DEDUCTION_MULTI_HOUSE = 900_000_000;

/** 2027년 공정시장가액비율 — 주택수·지역 구분 없이 70% 단일. */
const FMV_2027_FLAT = 0.7;
/** 2028년 이후 트랙 A(1주택·비조정대상 2주택) 공정시장가액비율. */
const FMV_TRACK_A_2028 = 0.7;
/** 2028년 이후 트랙 B(조정대상 2주택·3주택 이상) 공정시장가액비율. */
const FMV_TRACK_B_2028 = 0.8;

/** 농어촌특별세율 — 종부세액의 20%. propertyTaxCalculator.ts와 동일, 개편 대상 아님. */
const RURAL_SPECIAL_TAX_RATE = 0.2;

/**
 * 고령자 세액공제율(60/65/70세 20/30/40%) — propertyTaxCalculator.ts의
 * 비공개 함수와 값이 같지만, 원본 파일을 변경하지 않기 위해 의도적으로
 * 이 파일에 다시 선언한다. 개편안에서도 유지된다는 보도가 있어 전 연도
 * 공통 적용한다(장기보유·거주기간 공제는 아래 참고처럼 별도로 미반영).
 */
function seniorCreditRate(age: number): number {
  if (age >= 70) return 0.4;
  if (age >= 65) return 0.3;
  if (age >= 60) return 0.2;
  return 0;
}

/**
 * 2027~2029년 공통: 과세표준 0~12억원 구간(주택수 구분 없이 일원화됨,
 * 경인일보·뉴스핌 교차확인).
 */
const REFORM_LOW_BRACKETS: TaxBracket[] = [
  { upTo: 300_000_000, rate: 0.005 }, // 3억원 이하 0.5%
  { upTo: 600_000_000, rate: 0.007 }, // ~6억원 0.7%
  { upTo: 1_200_000_000, rate: 0.013 }, // ~12억원 1.3%
];

/**
 * 2028년 이후: 과세표준 12억원 초과 구간. 2027년은 이 구간의 정확한
 * 세율표가 보도되지 않아("0.5~3.5%" 범위만 확인) 사용하지 않는다.
 */
const REFORM_HIGH_BRACKETS_2028: TaxBracket[] = [
  { upTo: 2_500_000_000, rate: 0.02 }, // ~25억원 2.0%
  { upTo: 5_000_000_000, rate: 0.03 }, // ~50억원 3.0%
  { upTo: 9_400_000_000, rate: 0.04 }, // ~94억원 4.0%
  { upTo: Infinity, rate: 0.05 }, // 94억원 초과 5.0%
];

/** 2028~2029년 전체 세율표(주택수 구분 폐지, 단일 가액 기준). */
const REFORM_FULL_BRACKETS_2028: TaxBracket[] = [...REFORM_LOW_BRACKETS, ...REFORM_HIGH_BRACKETS_2028];

// ============================================================
// 타입
// ============================================================

export interface ReformTaxInput {
  /** 계산 기준 연도. 2026년은 현행법(개편안 미적용)으로 그대로 계산한다. */
  year: ReformYear;
  /** 보유 주택 공시가격 합계, 원. */
  totalPublicPrice: number;
  /** 주택 수. */
  houseCount: HouseCount;
  /** 실거주 여부. `houseCount === '1주택'`일 때만 공제금액에 반영된다. */
  residency?: ResidencyStatus;
  /** 조정대상지역 여부. `houseCount === '2주택'`일 때만(2028년 이후) 공정시장가액비율 트랙에 반영된다. */
  isRegulatedArea?: boolean;
  /**
   * 고령자 세액공제용 나이(1주택자만 적용). `holdingYears`는 2026년(현행법
   * 위임 경로)에만 장기보유공제 계산에 쓰이고, 2027년 이후는 장기보유·
   * 거주기간 공제 개편 내용이 단일 출처로만 보도돼 반영하지 않으므로 무시된다.
   */
  ageAndHolding?: { age: number; holdingYears: number };
}

/**
 * 세율 적용 결과의 세 가지 상태. 이 값을 UI에 어떻게 설명할지(문구, 배지 등)는
 * 각 로케일 페이지가 직접 담당한다 — 이 모듈은 propertyTaxCalculator.ts와
 * 같은 관례를 따라 숫자·상태값만 반환하고 언어가 있는 문구는 만들지 않는다
 * (ko/en 페이지가 그대로 재사용하면 번역이 깨지기 때문).
 */
export type BracketOutcome =
  | { status: 'computed'; calculatedTax: number }
  | { status: 'computed-floor'; calculatedTax: number }
  | { status: 'delegated'; calculatedTax: number };

export interface ReformTaxResult {
  year: ReformYear;
  /** 적용된 기본공제금액. */
  deduction: number;
  /** 적용된 공정시장가액비율. */
  fairMarketRatio: number;
  /** 적용된 공정시장가액비율 트랙(2026·2027은 트랙 구분이 없어 null). */
  fmvTrack: 'A' | 'B' | null;
  /** 과세표준 = max(0, 공시가격합계 − 공제금액) × 공정시장가액비율. */
  taxBase: number;
  /** 세율 적용 결과(확정/최소값/현행법 위임). */
  bracket: BracketOutcome;
  /** 적용된 세액공제율(고령자 공제만; 장기보유·거주기간 공제는 개편 연도에 미반영). */
  creditRate: number;
  /** 세액공제 금액. */
  creditAmount: number;
  /** 결정세액 = max(0, 산출세액 − 세액공제). 2027년 초과구간 미확정 시 최솟값. */
  finalTax: number;
  /** 농어촌특별세 = 결정세액 × 20%. */
  ruralSpecialTax: number;
  /** 결정세액 + 농어촌특별세. */
  totalWithSurtax: number;
}

// ============================================================
// 내부 헬퍼
// ============================================================

function resolveDeduction(houseCount: HouseCount, residency: ResidencyStatus | undefined): number {
  if (houseCount === '1주택') {
    return residency === '비거주' ? DEDUCTION_SINGLE_NONRESIDING : DEDUCTION_SINGLE_RESIDING;
  }
  // 다주택자 기본공제 개편 방식(예: "4억원 + 거주비중별 최대 5억원 가산")은 단일
  // 매체 보도만 확인되어 교차검증 전까지 반영하지 않는다 — 현행과 동일한 9억원을
  // 적용한다. (UI 안내 문구는 각 로케일 페이지의 정적 disclaimer가 담당한다.)
  return DEDUCTION_MULTI_HOUSE;
}

function resolveFmvTrack(houseCount: HouseCount, isRegulatedArea: boolean | undefined): 'A' | 'B' {
  if (houseCount === '3주택이상') return 'B';
  if (houseCount === '2주택') return isRegulatedArea ? 'B' : 'A';
  return 'A';
}

function resolveFmvRatio(year: 2027 | 2028 | 2029, track: 'A' | 'B'): number {
  if (year === 2027) return FMV_2027_FLAT;
  return track === 'A' ? FMV_TRACK_A_2028 : FMV_TRACK_B_2028;
}

function resolveBracketOutcome(year: 2027 | 2028 | 2029, taxBase: number): BracketOutcome {
  if (year === 2027) {
    const floorCap = 1_200_000_000;
    if (taxBase <= floorCap) {
      return { status: 'computed', calculatedTax: progressiveTax(taxBase, REFORM_LOW_BRACKETS) };
    }
    // 과세표준 12억원 초과분에 적용될 2027년 세율 구간이 보도에서 확인되지
    // 않아, 12억원까지만 세율을 반영한 최솟값을 반환한다. UI에서는 이
    // 'computed-floor' 상태를 보고 각 로케일에 맞는 경고 문구를 직접 붙인다.
    return { status: 'computed-floor', calculatedTax: progressiveTax(floorCap, REFORM_LOW_BRACKETS) };
  }
  return { status: 'computed', calculatedTax: progressiveTax(taxBase, REFORM_FULL_BRACKETS_2028) };
}

// ============================================================
// 메인 진입점
// ============================================================

/**
 * 연도별 종부세(개편안 기준)를 계산합니다. 2026년은 개편안의 영향을 받지
 * 않는 해(6월 1일 과세기준일이 발표 이전에 지남)라 현행법 계산
 * (`calculateComprehensiveTax`)에 그대로 위임합니다.
 */
export function calculateReformTax(input: ReformTaxInput): ReformTaxResult {
  const totalPublicPrice = Math.max(0, input.totalPublicPrice || 0);

  if (input.year === 2026) {
    const base = calculateComprehensiveTax({
      totalPublicPrice,
      houseCount: input.houseCount,
      ageAndHolding: input.ageAndHolding,
    });
    return {
      year: 2026,
      deduction: base.deduction,
      fairMarketRatio: CURRENT_FMV_RATIO,
      fmvTrack: null,
      taxBase: base.taxBase,
      bracket: { status: 'delegated', calculatedTax: base.calculatedTax },
      creditRate: base.seniorLongTermCreditRate,
      creditAmount: base.seniorLongTermCredit,
      finalTax: base.finalTax,
      ruralSpecialTax: base.ruralSpecialTax,
      totalWithSurtax: base.totalWithSurtax,
    };
  }

  const deduction = resolveDeduction(input.houseCount, input.residency);
  const track = resolveFmvTrack(input.houseCount, input.isRegulatedArea);
  const fairMarketRatio = resolveFmvRatio(input.year, track);
  const taxBase = Math.max(0, totalPublicPrice - deduction) * fairMarketRatio;
  const bracket = resolveBracketOutcome(input.year, taxBase);

  const creditRate =
    input.houseCount === '1주택' && input.ageAndHolding ? seniorCreditRate(input.ageAndHolding.age) : 0;
  const creditAmount = bracket.calculatedTax * creditRate;
  const finalTax = Math.max(0, bracket.calculatedTax - creditAmount);
  const ruralSpecialTax = finalTax * RURAL_SPECIAL_TAX_RATE;
  const totalWithSurtax = finalTax + ruralSpecialTax;

  return {
    year: input.year,
    deduction,
    fairMarketRatio,
    fmvTrack: track,
    taxBase,
    bracket,
    creditRate,
    creditAmount,
    finalTax,
    ruralSpecialTax,
    totalWithSurtax,
  };
}

/** 동일 입력으로 2026~2029년 4개 연도를 한 번에 계산합니다(연도별 비교 UI용). */
export function calculateReformTaxAllYears(
  input: Omit<ReformTaxInput, 'year'>,
): Record<ReformYear, ReformTaxResult> {
  return {
    2026: calculateReformTax({ ...input, year: 2026 }),
    2027: calculateReformTax({ ...input, year: 2027 }),
    2028: calculateReformTax({ ...input, year: 2028 }),
    2029: calculateReformTax({ ...input, year: 2029 }),
  };
}
