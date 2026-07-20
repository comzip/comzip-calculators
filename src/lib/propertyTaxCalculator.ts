/**
 * 보유세(재산세 + 종합부동산세) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 부과세액은 각 지방자치단체·국세청이
 * 시행령·조례, 세액공제, 세부담상한 등을 적용하여 산정하며, 아래 로직은
 * 이를 단순화한 근사치입니다. 또한 공정시장가액비율·세율·공제금액 등은
 * 법령 개정으로 바뀔 수 있으므로, 아래 상수들은 시점에 따라 실제와
 * 달라질 수 있습니다.
 *
 * 즉, 이 모듈의 결과는 참고용 ESTIMATE이며 공식적인 세액 계산이
 * 아닙니다. 실제 고지세액과 차이가 있을 수 있습니다.
 *
 * 법령 근거(2026-07-20 기준):
 *  - 재산세: 지방세법 제110조(과세표준), 제111조·제111조의2(세율),
 *            제112조(도시지역분), 제151조(지방교육세)
 *  - 종합부동산세: 종합부동산세법 제7~9조(주택에 대한 과세표준과 세율),
 *                 제9조제3항(재산세액공제, 근사식으로만 반영),
 *                 제9조제5~8항(고령자·장기보유 세액공제, 1세대1주택 한정)
 *  - 농어촌특별세: 농어촌특별세법 제5조(종합부동산세액의 20%)
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

// ============================================================
// 공용 헬퍼: 누진 구간(초과분 과세) 방식의 세액 계산
// ============================================================

/**
 * 누진세율 한 구간.
 * `upTo`는 이 구간의 상한(원, 이하)이며, 최상단 구간은 Infinity 입니다.
 * `rate`는 이 구간에 속하는 과세표준 부분에 곱해지는 한계세율입니다.
 */
export interface TaxBracket {
  /** 이 구간의 상한(원, 이하). 최상단 구간은 Infinity. */
  upTo: number;
  /** 이 구간에 적용되는 한계세율(소수, 예: 0.001 = 0.1%). */
  rate: number;
}

/**
 * 과세표준을 구간별로 쪼개어, 각 구간에 속하는 부분에 그 구간의 한계세율을
 * 곱한 값을 누적하는 "초과분 과세(cumulative marginal)" 방식으로 세액을
 * 계산합니다.
 *
 * 법령/세율표에 흔히 등장하는 "누진공제" 방식(과세표준 × 세율 - 공제액)의
 * 상수들을 블랙박스로 하드코딩하지 않고, 구간 경계와 한계세율만으로
 * 수학적으로 동등한 결과를 얻습니다. 이렇게 하면 공제상수 전사(轉寫)
 * 과정에서의 오류 위험이 사라집니다.
 *
 * 예) 주택 표준세율표의 과세표준 6,000만원에서:
 *     6,000만원 × 0.1% = 60,000원 (세율표의 경계 금액과 일치).
 */
export function progressiveTax(taxBase: number, brackets: TaxBracket[]): number {
  if (taxBase <= 0) return 0;

  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    if (taxBase <= lower) break;
    const upper = Math.min(taxBase, bracket.upTo);
    tax += (upper - lower) * bracket.rate;
    lower = bracket.upTo;
  }
  return tax;
}

// ============================================================
// 재산세 세율표 (지방세법 제111조·제111조의2제1항)
// ============================================================

/** 주택 표준세율 (지방세법 제111조제1항제3호). */
const HOUSE_STANDARD_BRACKETS: TaxBracket[] = [
  { upTo: 60_000_000, rate: 0.001 }, // 6천만원 이하 0.1%
  { upTo: 150_000_000, rate: 0.0015 }, // ~1억5천만원 0.15%
  { upTo: 300_000_000, rate: 0.0025 }, // ~3억원 0.25%
  { upTo: Infinity, rate: 0.004 }, // 3억원 초과 0.4%
];

/** 주택 1세대1주택 특례세율 (지방세법 제111조의2제1항, 시가표준액 9억원 이하). */
const HOUSE_SPECIAL_BRACKETS: TaxBracket[] = [
  { upTo: 60_000_000, rate: 0.0005 }, // 6천만원 이하 0.05%
  { upTo: 150_000_000, rate: 0.001 }, // ~1억5천만원 0.1%
  { upTo: 300_000_000, rate: 0.002 }, // ~3억원 0.2%
  { upTo: Infinity, rate: 0.0035 }, // 3억원 초과 0.35%
];

/** 종합합산과세대상 토지 세율 (지방세법 제111조제1항제1호 가목). */
const LAND_GENERAL_BRACKETS: TaxBracket[] = [
  { upTo: 50_000_000, rate: 0.002 }, // 5천만원 이하 0.2%
  { upTo: 100_000_000, rate: 0.003 }, // ~1억원 0.3%
  { upTo: Infinity, rate: 0.005 }, // 1억원 초과 0.5%
];

/** 별도합산과세대상 토지 세율 (지방세법 제111조제1항제1호 나목). */
const LAND_SPECIAL_AGG_BRACKETS: TaxBracket[] = [
  { upTo: 200_000_000, rate: 0.002 }, // 2억원 이하 0.2%
  { upTo: 1_000_000_000, rate: 0.003 }, // ~10억원 0.3%
  { upTo: Infinity, rate: 0.004 }, // 10억원 초과 0.4%
];

/** 분리과세대상(농지·임야 등) 토지 단일세율 (지방세법 제111조제1항제1호 다목). */
const LAND_SEPARATE_RATE = 0.0007; // 0.07%

/** 건축물 용도별 단일세율 (지방세법 제111조제1항제2호). */
const BUILDING_RATES = {
  기타: 0.0025, // 기타 건축물(일반) 0.25%
  '골프장·고급오락장': 0.04, // 골프장·고급오락장용 4%
  특정지역공장: 0.005, // 특정지역 공장용 0.5%
} as const;

// ============================================================
// 공정시장가액비율 (재산세, 지방세법 시행령)
// ============================================================

/** 주택 외(다주택/특례 미적용) 공정시장가액비율. */
const HOUSE_DEFAULT_FMV_RATIO = 0.6; // 60%
/** 토지·건축물 공정시장가액비율. */
const LAND_BUILDING_FMV_RATIO = 0.7; // 70%
/** 1세대1주택 특례가 적용되는 주택의 공시가격 상한(시가표준액 9억원). */
const HOUSE_SPECIAL_PRICE_CAP = 900_000_000;

/**
 * 1세대1주택 특례 적용 시 공시가격에 따른 공정시장가액비율.
 *  - 3억원 이하: 43%
 *  - 3억원 초과 ~ 6억원 이하: 44%
 *  - 6억원 초과: 45%
 */
function houseSpecialFmvRatio(publicPrice: number): number {
  if (publicPrice <= 300_000_000) return 0.43;
  if (publicPrice <= 600_000_000) return 0.44;
  return 0.45;
}

// ============================================================
// 재산세 후처리 상수 (지방세법 제112조·제151조)
// ============================================================

/** 지방교육세율: 재산세 본세의 20% (지방세법 제151조제1항제6호). */
const LOCAL_EDUCATION_TAX_RATE = 0.2;
/** 도시지역분 세율: 과세표준의 0.14% (지방세법 제112조). */
const URBAN_AREA_TAX_RATE = 0.0014;

// ============================================================
// 재산세(Part A) 타입 정의
// ============================================================

/** 재산세 과세대상 유형. */
export type PropertyAssetType = '주택' | '토지' | '건축물';
/** 토지 분류. */
export type LandType = '종합합산' | '별도합산' | '분리과세';
/** 건축물 용도. */
export type BuildingType = keyof typeof BUILDING_RATES;

export interface PropertyTaxInput {
  /** 과세대상 유형. */
  assetType: PropertyAssetType;
  /** 공시가격(주택) 또는 시가표준액(토지·건축물), 원. */
  baseValue: number;
  /** [주택] 1세대 1주택 특례 적용 여부. */
  singleHouseholdSpecial?: boolean;
  /** [토지] 토지 분류. */
  landType?: LandType;
  /** [건축물] 건축물 용도. */
  buildingType?: BuildingType;
  /** 도시지역 내 소재 여부(도시지역분 부과 대상). */
  urbanArea?: boolean;
}

export interface PropertyTaxResult {
  /** 적용된 공정시장가액비율(소수, 예: 0.6). */
  fairMarketRatio: number;
  /** 과세표준 = baseValue × 공정시장가액비율. */
  taxBase: number;
  /** 재산세 본세(산출세액). */
  propertyTax: number;
  /** 지방교육세(재산세 본세 × 20%). */
  localEducationTax: number;
  /** 도시지역분(과세표준 × 0.14%). 미적용 시 0. */
  urbanAreaTax: number;
  /** 합계 = 재산세 본세 + 지방교육세 + 도시지역분. */
  total: number;
  /**
   * [주택] 1세대1주택 특례를 체크했으나 공시가격이 9억원을 초과하여
   * 특례세율 대신 표준세율이 적용된 경우 true.
   */
  specialRateNotApplied: boolean;
  /**
   * 이 계산에 실제로 적용된 최고구간 한계세율(누진구간 중 가장 높은
   * 구간의 세율, 분리과세·건축물처럼 단일세율인 경우 그 세율 자체).
   * 종합부동산세의 재산세액공제(이중과세 조정) 근사 계산에 재사용한다.
   */
  topMarginalRate: number;
}

/**
 * 재산세(본세 + 지방교육세 + 선택 시 도시지역분)를 계산합니다.
 */
export function calculatePropertyTax(input: PropertyTaxInput): PropertyTaxResult {
  const baseValue = Math.max(0, input.baseValue || 0);

  let fairMarketRatio: number;
  let propertyTax: number;
  let specialRateNotApplied = false;

  if (input.assetType === '주택') {
    const useSpecial = Boolean(input.singleHouseholdSpecial);
    // 1세대1주택 공정시장가액비율(43~45%) 특례는 가격 상한 없이 모든
    // 1세대1주택에 적용된다(지방세법 시행령). 반면 특례세율(0.05~0.35%)은
    // 지방세법 제111조의2에 따라 시가표준액 9억원 이하 주택에만 적용되며,
    // 초과 시 표준세율로 회귀한다 — 두 특례는 서로 다른 가격 요건을 가진
    // 별개의 규정이므로 여기서 분리해서 적용한다.
    const rateSpecialApplies = useSpecial && baseValue <= HOUSE_SPECIAL_PRICE_CAP;
    specialRateNotApplied = useSpecial && !rateSpecialApplies;

    fairMarketRatio = useSpecial
      ? houseSpecialFmvRatio(baseValue)
      : HOUSE_DEFAULT_FMV_RATIO;
    const taxBase = baseValue * fairMarketRatio;
    const houseBrackets = rateSpecialApplies ? HOUSE_SPECIAL_BRACKETS : HOUSE_STANDARD_BRACKETS;
    propertyTax = progressiveTax(taxBase, houseBrackets);
    const topMarginalRate = houseBrackets[houseBrackets.length - 1].rate;
    return finalize(
      taxBase,
      fairMarketRatio,
      propertyTax,
      input.urbanArea,
      specialRateNotApplied,
      topMarginalRate,
    );
  }

  if (input.assetType === '토지') {
    fairMarketRatio = LAND_BUILDING_FMV_RATIO;
    const taxBase = baseValue * fairMarketRatio;
    const landType = input.landType ?? '종합합산';
    let topMarginalRate: number;
    if (landType === '분리과세') {
      propertyTax = taxBase * LAND_SEPARATE_RATE;
      topMarginalRate = LAND_SEPARATE_RATE;
    } else {
      const brackets =
        landType === '별도합산' ? LAND_SPECIAL_AGG_BRACKETS : LAND_GENERAL_BRACKETS;
      propertyTax = progressiveTax(taxBase, brackets);
      topMarginalRate = brackets[brackets.length - 1].rate;
    }
    return finalize(taxBase, fairMarketRatio, propertyTax, input.urbanArea, false, topMarginalRate);
  }

  // 건축물
  fairMarketRatio = LAND_BUILDING_FMV_RATIO;
  const taxBase = baseValue * fairMarketRatio;
  const buildingType = input.buildingType ?? '기타';
  const buildingRate = BUILDING_RATES[buildingType];
  propertyTax = taxBase * buildingRate;
  return finalize(taxBase, fairMarketRatio, propertyTax, input.urbanArea, false, buildingRate);
}

/**
 * 재산세 본세로부터 지방교육세·도시지역분·합계를 산출하여 결과를 만듭니다.
 * (세 가지 과세대상 유형에 공통으로 적용되는 후처리.)
 */
function finalize(
  taxBase: number,
  fairMarketRatio: number,
  propertyTax: number,
  urbanArea: boolean | undefined,
  specialRateNotApplied: boolean,
  topMarginalRate: number,
): PropertyTaxResult {
  // 지방교육세는 도시지역분을 제외한 재산세 본세를 과세표준으로 한다.
  const localEducationTax = propertyTax * LOCAL_EDUCATION_TAX_RATE;
  const urbanAreaTax = urbanArea ? taxBase * URBAN_AREA_TAX_RATE : 0;
  const total = propertyTax + localEducationTax + urbanAreaTax;
  return {
    fairMarketRatio,
    taxBase,
    propertyTax,
    localEducationTax,
    urbanAreaTax,
    total,
    specialRateNotApplied,
    topMarginalRate,
  };
}

// ============================================================
// 종합부동산세(Part B) — 주택분 (종합부동산세법 제7~9조)
// ============================================================

/** 종부세 공정시장가액비율: 60% (고정). */
const COMPREHENSIVE_FMV_RATIO = 0.6;
/** 1세대1주택 공제금액: 12억원. */
const DEDUCTION_SINGLE_HOUSE = 1_200_000_000;
/** 2주택 이상 공제금액: 9억원. */
const DEDUCTION_MULTI_HOUSE = 900_000_000;
/** 농어촌특별세율: 종합부동산세(산출세액)의 20% (농어촌특별세법 제5조). */
const RURAL_SPECIAL_TAX_RATE = 0.2;
/** 고령자·장기보유 세액공제 합산 상한 (종합부동산세법 제9조제8항). */
const SENIOR_LONGTERM_CREDIT_CAP = 0.8;

/** 고령자 세액공제율: 60세 이상 20%, 65세 이상 30%, 70세 이상 40%. */
function seniorCreditRate(age: number): number {
  if (age >= 70) return 0.4;
  if (age >= 65) return 0.3;
  if (age >= 60) return 0.2;
  return 0;
}

/** 장기보유 세액공제율: 5년 이상 20%, 10년 이상 40%, 15년 이상 50%. */
function longTermCreditRate(holdingYears: number): number {
  if (holdingYears >= 15) return 0.5;
  if (holdingYears >= 10) return 0.4;
  if (holdingYears >= 5) return 0.2;
  return 0;
}

/** 2주택 이하 소유(1·2주택) 세율표. */
const COMPREHENSIVE_LOW_BRACKETS: TaxBracket[] = [
  { upTo: 300_000_000, rate: 0.005 }, // 3억원 이하 0.5%
  { upTo: 600_000_000, rate: 0.007 }, // ~6억원 0.7%
  { upTo: 1_200_000_000, rate: 0.01 }, // ~12억원 1.0%
  { upTo: 2_500_000_000, rate: 0.013 }, // ~25억원 1.3%
  { upTo: 9_400_000_000, rate: 0.02 }, // ~94억원 2.0%
  { upTo: Infinity, rate: 0.027 }, // 94억원 초과 2.7%
];

/** 3주택 이상 소유 세율표. */
const COMPREHENSIVE_HIGH_BRACKETS: TaxBracket[] = [
  { upTo: 300_000_000, rate: 0.005 }, // 3억원 이하 0.5%
  { upTo: 600_000_000, rate: 0.007 }, // ~6억원 0.7%
  { upTo: 1_200_000_000, rate: 0.01 }, // ~12억원 1.0%
  { upTo: 2_500_000_000, rate: 0.02 }, // ~25억원 2.0%
  { upTo: 5_000_000_000, rate: 0.03 }, // ~50억원 3.0%
  { upTo: Infinity, rate: 0.05 }, // 50억원 초과 5.0%
];

/** 종부세 주택 수 구분. */
export type HouseCount = '1주택' | '2주택' | '3주택이상';

export interface ComprehensiveTaxInput {
  /** 보유 주택 공시가격 합계, 원. */
  totalPublicPrice: number;
  /** 주택 수. */
  houseCount: HouseCount;
  /**
   * 재산세액공제(이중과세 조정) 계산에 쓸, 위 "1. 재산세 계산"에서 넘어온
   * 단일 주택 정보. 이 계산기는 물건 1건 기준 재산세만 다루므로, 다주택을
   * 보유한 경우의 정확한 다건 안분은 반영하지 않는다 — 그런 경우 이
   * 값은 생략(undefined)하고 재산세액공제 없이 산출세액만 보여준다.
   */
  linkedPropertyTax?: {
    /** 해당 주택의 재산세 본세(실제 부과액, 공제 상한으로 사용). */
    propertyTaxPaid: number;
    /** 해당 주택 재산세 계산에 적용된 공정시장가액비율. */
    fairMarketRatio: number;
    /** 해당 주택 재산세 계산에 적용된 최고구간 한계세율. */
    topMarginalRate: number;
  };
  /**
   * 고령자·장기보유 세액공제(종합부동산세법 제9조제5~8항) 계산용.
   * 1세대1주택자(`houseCount === '1주택'`)에게만 적용되는 특례이므로,
   * 그 외에는 값을 주어도 무시된다.
   */
  ageAndHolding?: {
    /** 만 나이. */
    age: number;
    /** 보유기간(년). */
    holdingYears: number;
  };
}

export interface ComprehensiveTaxResult {
  /** 적용된 공제금액(1주택 12억, 그 외 9억). */
  deduction: number;
  /** 과세표준 = max(0, 공시가격합계 − 공제금액) × 60%. */
  taxBase: number;
  /** 종합부동산세 산출세액(세액공제·세부담상한 반영 전). */
  calculatedTax: number;
  /**
   * 재산세액공제(이중과세 조정) 근사치. `linkedPropertyTax`가 주어졌을
   * 때만 계산되며, 그렇지 않으면 0.
   *
   * 근사식: 종부세 과세표준 × 재산세 공정시장가액비율 × 재산세
   * 최고구간세율 (재산세로 실제 납부한 금액을 상한으로 캡).
   * 실제 법령(종합부동산세법 제9조제3항)은 이보다 정교한 다단계
   * 재계산 방식이지만, 위 근사식은 실제 사례와 대조 검증한 값과
   * 정확히 일치했다(2026-07-20 기준, 단일 1세대1주택·최고구간 사례).
   */
  propertyTaxCredit: number;
  /**
   * 고령자·장기보유 세액공제율(합산, 최대 80%). `ageAndHolding`이
   * 주어지고 1세대1주택(`houseCount === '1주택'`)인 경우에만 0보다 큼.
   */
  seniorLongTermCreditRate: number;
  /** 고령자·장기보유 세액공제 금액 = (산출세액 − 재산세액공제) × 공제율. */
  seniorLongTermCredit: number;
  /** 종부세 결정세액 = max(0, 산출세액 − 재산세액공제 − 고령자·장기보유공제). */
  finalTax: number;
  /**
   * 농어촌특별세(농어촌특별세법 제5조) = 결정세액 × 20%.
   * 반영된 공제가 없으면 산출세액 기준(근사치)으로 계산된다.
   */
  ruralSpecialTax: number;
  /** 종부세 결정세액 + 농어촌특별세. */
  totalWithSurtax: number;
}

/**
 * 종합부동산세(주택분) 산출세액을 계산합니다.
 *
 * ⚠️ 반환값은 고령자·장기보유 세액공제, 세부담상한을 반영하기 "전"입니다.
 * `linkedPropertyTax`를 주면 재산세액공제(이중과세 조정)까지 근사
 * 반영하지만, 다주택 안분 등은 포함하지 않으므로 실제 고지세액과
 * 차이가 있을 수 있습니다.
 */
export function calculateComprehensiveTax(
  input: ComprehensiveTaxInput,
): ComprehensiveTaxResult {
  const totalPublicPrice = Math.max(0, input.totalPublicPrice || 0);
  const deduction =
    input.houseCount === '1주택' ? DEDUCTION_SINGLE_HOUSE : DEDUCTION_MULTI_HOUSE;

  const taxBase = Math.max(0, totalPublicPrice - deduction) * COMPREHENSIVE_FMV_RATIO;
  const brackets =
    input.houseCount === '3주택이상'
      ? COMPREHENSIVE_HIGH_BRACKETS
      : COMPREHENSIVE_LOW_BRACKETS;
  const calculatedTax = progressiveTax(taxBase, brackets);

  let propertyTaxCredit = 0;
  if (input.linkedPropertyTax) {
    const { propertyTaxPaid, fairMarketRatio, topMarginalRate } = input.linkedPropertyTax;
    const rawCredit = taxBase * fairMarketRatio * topMarginalRate;
    propertyTaxCredit = Math.max(0, Math.min(rawCredit, propertyTaxPaid));
  }
  const afterPropertyCredit = Math.max(0, calculatedTax - propertyTaxCredit);

  // 고령자·장기보유 세액공제는 1세대1주택자에게만 적용되며(종합부동산세법
  // 제9조제5~8항), 재산세액공제를 먼저 뺀 금액에 곱한다.
  let seniorLongTermCreditRate = 0;
  if (input.houseCount === '1주택' && input.ageAndHolding) {
    const { age, holdingYears } = input.ageAndHolding;
    seniorLongTermCreditRate = Math.min(
      SENIOR_LONGTERM_CREDIT_CAP,
      seniorCreditRate(age) + longTermCreditRate(holdingYears),
    );
  }
  const seniorLongTermCredit = afterPropertyCredit * seniorLongTermCreditRate;

  const finalTax = Math.max(0, afterPropertyCredit - seniorLongTermCredit);
  const ruralSpecialTax = finalTax * RURAL_SPECIAL_TAX_RATE;
  const totalWithSurtax = finalTax + ruralSpecialTax;

  return {
    deduction,
    taxBase,
    calculatedTax,
    propertyTaxCredit,
    seniorLongTermCreditRate,
    seniorLongTermCredit,
    finalTax,
    ruralSpecialTax,
    totalWithSurtax,
  };
}
