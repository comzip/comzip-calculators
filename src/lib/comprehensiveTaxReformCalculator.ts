/**
 * 종합부동산세 "2026년 세제개편안" 미리보기 계산 모듈.
 *
 * ======================== ⚠️ 이 모듈은 법령이 아닙니다 ========================
 * 기획재정부(현 재정경제부)가 2026-08-03 발표한 "2026년 세제개편안"의
 * 종합부동산세 개편 방향을 미리 계산해보는 시뮬레이션입니다. 이 개편안은
 * 아직 입법예고·국무회의·국회 통과를 거치지 않았으며, 국회 심의 과정에서
 * 내용이 달라지거나 폐기될 수 있습니다. 아래 상수는 law.go.kr이 아니라
 * 재정경제부 공식 발표 자료(보도자료·인포그래픽, mofe.go.kr)를 근거로 하며,
 * 이는 LEGAL_REFERENCES.md의 "공식 출처만 인용" 원칙에 대한 유일한 예외입니다.
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
/** 2·3주택 이상 기본공제 — 기본액 4억원(2027년부터). 거주비중에 따라 최대 9억원까지 가산된다. */
const DEDUCTION_MULTI_BASE = 400_000_000;
/** 2·3주택 이상 기본공제 — 거주비중 100%일 때 가산되는 최대 금액(5억원). */
const DEDUCTION_MULTI_RESIDENCE_MAX = 500_000_000;

/** 2027년 공정시장가액비율 — 주택수·지역 구분 없이 70% 단일. */
const FMV_2027_FLAT = 0.7;
/** 2028년 이후 트랙 A(1주택·비조정대상 2주택) 공정시장가액비율. */
const FMV_TRACK_A_2028 = 0.7;
/** 2028년 이후 트랙 B(조정대상 2주택·3주택 이상) 공정시장가액비율. */
const FMV_TRACK_B_2028 = 0.8;

/** 농어촌특별세율 — 종부세액의 20%. propertyTaxCalculator.ts와 동일, 개편 대상 아님. */
const RURAL_SPECIAL_TAX_RATE = 0.2;

// ------------------------------------------------------------
// 재산세액공제(이중과세 조정, 종부세법 §9③)용 재산세 상수.
// 개편안의 종부세 개정 대상 조문은 §7①·§8①·§9①②·§9⑤⑧⑨·§10·§15·§20의2로,
// §9③은 포함되지 않는다 — 즉 재산세액공제는 개편 후에도 그대로 유지된다.
// 아래 값은 지방세법·시행령(재산세)에서 오며 이번 개편과 무관하다.
// ------------------------------------------------------------

/** 재산세 주택분 공정시장가액비율 — 다주택(일반). */
const PROPERTY_TAX_FMV_DEFAULT = 0.6;
/** 재산세 주택 표준세율 최고구간(3억원 초과) 0.4% — 근사식의 한계세율로 쓴다. */
const PROPERTY_TAX_TOP_RATE = 0.004;

/** 재산세 1세대1주택 특례 공정시장가액비율(공시가격 구간별 43~45%). */
function propertyTaxSingleHouseFmvRatio(publicPrice: number): number {
  if (publicPrice <= 300_000_000) return 0.43;
  if (publicPrice <= 600_000_000) return 0.44;
  return 0.45;
}

/**
 * 고령자 세액공제율(60/65/70세 20/30/40%) — propertyTaxCalculator.ts의
 * 비공개 함수와 값이 같지만, 원본 파일을 변경하지 않기 위해 의도적으로
 * 이 파일에 다시 선언한다. 개편안에서도 전 연도 동일하게 유지된다
 * (재정경제부 발표자료 박스5).
 */
function seniorCreditRate(age: number): number {
  if (age >= 70) return 0.4;
  if (age >= 65) return 0.3;
  if (age >= 60) return 0.2;
  return 0;
}

/** 1세대1주택 세액공제 합산 상한(연령+보유/거주공제) — 현행과 동일 80%. */
const CREDIT_RATE_CAP = 0.8;
/** 1세대1주택 세액공제 금액 상한 — 2027년 800만원. */
const CREDIT_AMOUNT_CAP_2027 = 8_000_000;
/** 1세대1주택 세액공제 금액 상한 — 2028년 이후 600만원. */
const CREDIT_AMOUNT_CAP_2028 = 6_000_000;

/**
 * 2027년 전용 보유공제율(5/10/15년 이상 10/20/25%) — 거주공제와 둘 중
 * 유리한 쪽을 선택 적용한다(재정경제부 발표자료 박스5, '27년 "보유/거주
 * 공제중선택"). 2028년부터는 보유공제 자체가 폐지되고 거주공제만 인정된다.
 */
function holdingCreditRate2027(holdingYears: number): number {
  if (holdingYears >= 15) return 0.25;
  if (holdingYears >= 10) return 0.2;
  if (holdingYears >= 5) return 0.1;
  return 0;
}

/**
 * 거주공제율(5/10/15년 이상 20/40/50%) — 2027년엔 보유공제와 선택 적용,
 * 2028년부터는 이 공제만 인정된다. 세율 자체는 현행 장기보유공제와 같은
 * 20/40/50%이지만 기준이 "보유기간"에서 "거주기간"으로 바뀐다.
 */
function residenceCreditRate(residencyYears: number): number {
  if (residencyYears >= 15) return 0.5;
  if (residencyYears >= 10) return 0.4;
  if (residencyYears >= 5) return 0.2;
  return 0;
}

/**
 * 2027~2029년 공통: 과세표준 0~12억원 구간(주택수 구분 없이 이미 일원화됨,
 * 경인일보·뉴스핌·세계일보 등 교차확인).
 */
const REFORM_LOW_BRACKETS: TaxBracket[] = [
  { upTo: 300_000_000, rate: 0.005 }, // 3억원 이하 0.5%
  { upTo: 600_000_000, rate: 0.007 }, // ~6억원 0.7%
  { upTo: 1_200_000_000, rate: 0.013 }, // ~12억원 1.3%
];

/**
 * 2027년 1·2주택 전용, 과세표준 12억원 초과 구간(뉴스핌·MTN·세계일보·
 * 세계타임즈 교차확인 — "0.5~3.5%"로만 알려졌던 범위의 정확한 구간표).
 * 2028년부터는 이 구간도 REFORM_HIGH_BRACKETS_2028로 대체된다.
 */
const REFORM_2027_HIGH_BRACKETS: TaxBracket[] = [
  { upTo: 2_500_000_000, rate: 0.015 }, // ~25억원 1.5%
  { upTo: 5_000_000_000, rate: 0.02 }, // ~50억원 2.0%
  { upTo: 9_400_000_000, rate: 0.027 }, // ~94억원 2.7%
  { upTo: Infinity, rate: 0.035 }, // 94억원 초과 3.5%
];

/** 2027년 1·2주택 전체 세율표(0~12억 공통 구간 + 12억 초과 2027 전용 구간). */
const REFORM_2027_LOW_HOUSE_BRACKETS: TaxBracket[] = [...REFORM_LOW_BRACKETS, ...REFORM_2027_HIGH_BRACKETS];

/**
 * 2027년 3주택이상 전용 — 재정경제부 "2026년 세제개편안" 상세본(조문 대비표)
 * 원문 확인: 주택수 구분은 2027년에도 유지되고 2028년에야 사라지지만, 과세표준
 * 6~12억원 구간만큼은 2027년에 1·2주택과 동일하게 1.3%로 함께 오른다(현행
 * 1.0%). 12억원 초과 구간은 현행법(propertyTaxCalculator.ts의 비공개
 * COMPREHENSIVE_HIGH_BRACKETS와 완전히 동일 — 원본이 비공개 export라 재사용할
 * 수 없어 값만 다시 선언)을 그대로 유지한다. 상세본에는 12억 초과 구간이
 * 25/50/94억 3단계(2.0/3.0/4.0%)로 나뉘어 있음이 명시돼 있다 — 이 파일이 처음
 * 작성될 때는 propertyTaxCalculator.ts의 (당시 50~94억 구간이 누락돼 있던) 값을
 * 그대로 베껴 94억 이하를 전부 5.0%로 잘못 처리했으나, 이후 원본 버그를 고치며
 * 이 표도 함께 수정했다.
 */
const REFORM_2027_HIGH_HOUSE_BRACKETS: TaxBracket[] = [
  { upTo: 300_000_000, rate: 0.005 }, // 3억원 이하 0.5% (현행 유지)
  { upTo: 600_000_000, rate: 0.007 }, // ~6억원 0.7% (현행 유지)
  { upTo: 1_200_000_000, rate: 0.013 }, // ~12억원 1.3% (현행 1.0%→2027년 상향, 1·2주택과 동일)
  { upTo: 2_500_000_000, rate: 0.02 }, // ~25억원 2.0% (현행 유지)
  { upTo: 5_000_000_000, rate: 0.03 }, // ~50억원 3.0% (현행 유지)
  { upTo: 9_400_000_000, rate: 0.04 }, // ~94억원 4.0% (현행 유지)
  { upTo: Infinity, rate: 0.05 }, // 94억원 초과 5.0% (현행 유지)
];

/**
 * 2028년 이후: 과세표준 12억원 초과 구간(모든 주택수 공통 — 2028년부터는
 * 주택수 구분 자체가 사라진다).
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
   * 다주택(2·3주택) 중 실거주하는 주택의 공시가격. `houseCount !== '1주택'`이고
   * 2027년 이후일 때만 기본공제 계산(4억원 + 5억원 × 이 값/공시가격합계)에
   * 쓰인다. 실거주하는 주택이 없으면 생략(공제 4억원만 적용).
   */
  residentialHomeValue?: number;
  /**
   * 고령자·보유·거주 세액공제용 나이/보유기간/거주기간(1세대1주택자만 적용).
   * `holdingYears`는 2026년(현행법 위임)과 2027년(보유공제·거주공제 중 선택)에
   * 쓰이고, `residencyYears`는 2027년(거주공제 후보)과 2028년 이후(거주공제만)에
   * 쓰인다.
   */
  ageAndHolding?: { age: number; holdingYears: number; residencyYears: number };
}

/**
 * 세율 적용 결과의 상태. 이 값을 UI에 어떻게 설명할지(문구, 배지 등)는 각
 * 로케일 페이지가 직접 담당한다 — 이 모듈은 propertyTaxCalculator.ts와 같은
 * 관례를 따라 숫자·상태값만 반환하고 언어가 있는 문구는 만들지 않는다.
 */
export type BracketOutcome =
  | { status: 'computed'; calculatedTax: number }
  | { status: 'delegated'; calculatedTax: number };

export interface ReformTaxResult {
  year: ReformYear;
  /** 적용된 기본공제금액. */
  deduction: number;
  /** 적용된 공정시장가액비율. */
  fairMarketRatio: number;
  /**
   * 적용된 공정시장가액비율 트랙. 2026년(현행법)과 2027년(트랙 구분 없이
   * 70% 단일)은 트랙 개념 자체가 없어 null — 2028년부터만 A/B 트랙이 실제로
   * 비율에 영향을 준다.
   */
  fmvTrack: 'A' | 'B' | null;
  /** 과세표준 = max(0, 공시가격합계 − 공제금액) × 공정시장가액비율. */
  taxBase: number;
  /** 세율 적용 결과(확정/현행법 위임). */
  bracket: BracketOutcome;
  /**
   * 재산세액공제(이중과세 조정, 종부세법 §9③) 근사액. 산출세액에서 이 금액을
   * 먼저 뺀 뒤 1세대1주택 세액공제를 적용한다.
   */
  propertyTaxCredit: number;
  /**
   * 적용된 세액공제율(연령공제 + 보유/거주공제, 80% 상한 적용 후 명목값).
   * 2027년 이후는 여기에 더해 연도별 금액 상한(2027년 800만원, 2028년
   * 이후 600만원)까지 적용되므로, 실제 공제액(`creditAmount`)을 이 비율로
   * 역산하면 상한이 걸린 경우 이 값과 다를 수 있다.
   */
  creditRate: number;
  /** 세액공제 금액(금액 상한 적용 후 최종값). */
  creditAmount: number;
  /** 결정세액 = max(0, 산출세액 − 세액공제). */
  finalTax: number;
  /** 농어촌특별세 = 결정세액 × 20%. */
  ruralSpecialTax: number;
  /** 결정세액 + 농어촌특별세. */
  totalWithSurtax: number;
}

// ============================================================
// 내부 헬퍼
// ============================================================

function resolveDeduction(
  houseCount: HouseCount,
  residency: ResidencyStatus | undefined,
  totalPublicPrice: number,
  residentialHomeValue: number | undefined,
): number {
  if (houseCount === '1주택') {
    return residency === '비거주' ? DEDUCTION_SINGLE_NONRESIDING : DEDUCTION_SINGLE_RESIDING;
  }
  // 다주택자 기본공제 = 4억원 + 5억원 × (거주용주택가액 ÷ 주택가액합계액).
  // 거주하는 주택이 없으면(입력 생략) 비율 0으로 처리해 4억원만 적용된다.
  const residenceRatio =
    totalPublicPrice > 0 ? Math.min(1, Math.max(0, (residentialHomeValue ?? 0) / totalPublicPrice)) : 0;
  return DEDUCTION_MULTI_BASE + DEDUCTION_MULTI_RESIDENCE_MAX * residenceRatio;
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

function resolveBracketOutcome(year: 2027 | 2028 | 2029, taxBase: number, houseCount: HouseCount): BracketOutcome {
  if (year === 2027) {
    // 주택수 구분은 2027년에도 유지되고 2028년에야 사라진다 — 3주택이상은
    // 2027년에도 현행법 세율표(6~12억 구간만 1.3%로 상향)를 적용받는다.
    const brackets = houseCount === '3주택이상' ? REFORM_2027_HIGH_HOUSE_BRACKETS : REFORM_2027_LOW_HOUSE_BRACKETS;
    return { status: 'computed', calculatedTax: progressiveTax(taxBase, brackets) };
  }
  return { status: 'computed', calculatedTax: progressiveTax(taxBase, REFORM_FULL_BRACKETS_2028) };
}

/**
 * 재산세액공제(이중과세 조정, 종부세법 §9③) 근사액.
 *
 * 근사식: 종부세 과세표준 × 재산세 공정시장가액비율 × 재산세 최고구간세율.
 * `propertyTaxCalculator.ts`가 쓰는 것과 같은 근사식으로(그쪽 주석 참고 — 실제
 * 사례와 대조 검증됨), 정식 법령 산식(주택별 다단계 안분)은 아니다. 이 계산기는
 * 주택별 공시가격이 아니라 합계만 입력받으므로 실제 납부 재산세를 상한으로
 * 씌우는 캡은 적용하지 못한다 — 다만 통상 근사액이 실제 재산세보다 훨씬 작아
 * 캡이 걸리는 경우는 드물다.
 *
 * 이 공제를 빼먹으면 산출세액을 18~32%가량 과대계상하게 되어(실측) 무시할 수
 * 없다.
 */
function resolvePropertyTaxCredit(taxBase: number, totalPublicPrice: number, houseCount: HouseCount): number {
  const fmvRatio =
    houseCount === '1주택' ? propertyTaxSingleHouseFmvRatio(totalPublicPrice) : PROPERTY_TAX_FMV_DEFAULT;
  return Math.max(0, taxBase * fmvRatio * PROPERTY_TAX_TOP_RATE);
}

/**
 * 1세대1주택 세액공제(연령공제 + 보유/거주공제) 결과. `rate`는 80% 상한을
 * 적용한 명목 공제율, `amount`는 여기에 연도별 금액 상한(2027년 800만원,
 * 2028년 이후 600만원)까지 적용한 최종 공제액이다 — 금액 상한이 걸리면
 * `amount / calculatedTax`의 실효 공제율은 `rate`보다 낮아질 수 있다.
 */
function resolveCredit(
  year: 2027 | 2028 | 2029,
  houseCount: HouseCount,
  calculatedTax: number,
  ageAndHolding: { age: number; holdingYears: number; residencyYears: number } | undefined,
): { rate: number; amount: number } {
  if (houseCount !== '1주택' || !ageAndHolding) return { rate: 0, amount: 0 };

  const { age, holdingYears, residencyYears } = ageAndHolding;
  const holdingOrResidenceRate =
    year === 2027
      ? Math.max(holdingCreditRate2027(holdingYears), residenceCreditRate(residencyYears))
      : residenceCreditRate(residencyYears);
  const rate = Math.min(CREDIT_RATE_CAP, seniorCreditRate(age) + holdingOrResidenceRate);
  const amountCap = year === 2027 ? CREDIT_AMOUNT_CAP_2027 : CREDIT_AMOUNT_CAP_2028;
  const amount = Math.min(calculatedTax * rate, amountCap);
  return { rate, amount };
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
    // 현행법 계산은 그대로 위임하되, 재산세액공제는 이 계산기가 직접 붙인다 —
    // 위임 대상 함수는 주택 1건의 재산세 정보를 넘겨줘야만 공제를 계산하는데,
    // 이 계산기는 공시가격 "합계"만 받으므로 그 경로를 쓸 수 없기 때문이다.
    // 아래 2027년 이후 경로와 같은 근사식을 써서 연도 간 일관성을 유지한다.
    const base = calculateComprehensiveTax({
      totalPublicPrice,
      houseCount: input.houseCount,
      ageAndHolding: input.ageAndHolding,
    });
    const propertyTaxCredit = resolvePropertyTaxCredit(base.taxBase, totalPublicPrice, input.houseCount);
    const afterPropertyCredit = Math.max(0, base.calculatedTax - propertyTaxCredit);
    // 고령자·장기보유 세액공제는 재산세액공제를 뺀 금액에 곱한다(현행법 순서).
    const creditAmount = afterPropertyCredit * base.seniorLongTermCreditRate;
    const finalTax = Math.max(0, afterPropertyCredit - creditAmount);
    const ruralSpecialTax = finalTax * RURAL_SPECIAL_TAX_RATE;
    return {
      year: 2026,
      deduction: base.deduction,
      fairMarketRatio: CURRENT_FMV_RATIO,
      fmvTrack: null,
      taxBase: base.taxBase,
      bracket: { status: 'delegated', calculatedTax: base.calculatedTax },
      propertyTaxCredit,
      creditRate: base.seniorLongTermCreditRate,
      creditAmount,
      finalTax,
      ruralSpecialTax,
      totalWithSurtax: finalTax + ruralSpecialTax,
    };
  }

  const deduction = resolveDeduction(input.houseCount, input.residency, totalPublicPrice, input.residentialHomeValue);
  const track = resolveFmvTrack(input.houseCount, input.isRegulatedArea);
  const fairMarketRatio = resolveFmvRatio(input.year, track);
  const taxBase = Math.max(0, totalPublicPrice - deduction) * fairMarketRatio;
  const bracket = resolveBracketOutcome(input.year, taxBase, input.houseCount);

  // 재산세액공제(이중과세 조정)를 먼저 뺀 뒤, 남은 금액에 1세대1주택 세액공제를
  // 적용한다(현행법 §9의 계산 순서를 그대로 따른다).
  const propertyTaxCredit = resolvePropertyTaxCredit(taxBase, totalPublicPrice, input.houseCount);
  const afterPropertyCredit = Math.max(0, bracket.calculatedTax - propertyTaxCredit);
  const { rate: creditRate, amount: creditAmount } = resolveCredit(
    input.year,
    input.houseCount,
    afterPropertyCredit,
    input.ageAndHolding,
  );
  const finalTax = Math.max(0, afterPropertyCredit - creditAmount);
  const ruralSpecialTax = finalTax * RURAL_SPECIAL_TAX_RATE;
  const totalWithSurtax = finalTax + ruralSpecialTax;

  return {
    year: input.year,
    deduction,
    fairMarketRatio,
    // 2027년은 FMV 비율이 트랙과 무관하게 70% 단일이라(resolveFmvRatio 참고)
    // 트랙 자체가 의미 없으므로 null로 보고한다 — resolveFmvTrack의 반환값을
    // 그대로 노출하면 "2027은 트랙 구분 없음"이라는 위 문서 주석과 어긋난다.
    fmvTrack: input.year === 2027 ? null : track,
    taxBase,
    bracket,
    propertyTaxCredit,
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
