/**
 * 해외직구 관부가세(관세·부가세·주세 등) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 세액은 품목의 정확한 HS 품목분류,
 * 통관 시점 관세청 고시환율, 자가사용인정기준 초과 여부 등에 따라
 * 달라질 수 있습니다. 아래 품목별 관세율은 각 카테고리의 대표적인 HS
 * 관세율을 참고한 근사치이며(정확한 세율은 물품의 정확한 HS 코드에 따라
 * 다름), 실제 통관 시엔 다른 세율이 적용될 수 있습니다.
 *
 * 이전 버전은 관세법 시행령 별표2의 "간이세율"(여행자휴대품·우편물용
 * 합산세율, 예: 섬유제품 18%)을 사용했으나, 다수의 실제 해외직구
 * 관부가세 계산기(gwanse.kr, taxcalc.co.kr 등)와 비교 검증한 결과 시장에서
 * 통용되는 방식은 품목별 개별 관세율(예: 의류 13%)을 관세로 먼저 적용하고
 * 그 위에 부가세 10%를 순차 적용하는 방식이었다. 두 방식은 결과가 크게
 * 다르며(동일 조건에서 간이세율 방식이 시장 통용 방식보다 낮게 나옴),
 * 이용자가 다른 계산기와 비교했을 때 혼란이 없도록 시장 통용 방식으로
 * 전환했다.
 *
 * 법령 근거:
 *  - 관세법 제241조(수입신고), 「수입통관 사무처리에 관한 고시」:
 *    목록통관(수입신고 생략) 면세기준 미화 150달러(미국 발송 특송화물은
 *    200달러) 이하. 기준을 단 $1이라도 초과하면 전체 금액이 과세대상.
 *  - 「수입통관 사무처리에 관한 고시」 별표11(자가사용인정기준): 의약품·
 *    건강기능식품·화장품(기능성)·주류·담배·농림축수산물 등은 목록통관
 *    배제대상으로, 국가 구분 없이 150달러 기준이 적용되고 원칙적으로
 *    정식 수입신고 대상.
 *  - 관세법 제30조(과세가격 결정): 면세기준(150달러) 이하 판정 시에는
 *    국제배송비·보험료를 제외하고 판정하되, 기준을 초과해 과세되는
 *    경우에는 국제배송비·보험료까지 포함한 금액이 과세가격이 됨(CIF).
 *  - 관세법 별표 관세율표: 품목별 관세율 — ⚠️ 아래 표는 대표 HS 코드
 *    기준 근사치이며 정확한 세율은 물품마다 다를 수 있어 재검증 필요.
 *  - 부가가치세법 제27조: 부가세 = (과세가격 + 관세) × 10%.
 *  - 개별소비세법 제1조: 보석·귀금속·고급시계·고급가방·모피 등 사치품은
 *    과세가격 200만원 초과분에 개별소비세 20% + 교육세(개별소비세의
 *    30%)가 별도 부과(이 계산기는 자동계산하지 않고 안내만 함).
 *  - 주세법(제7조 세율), 교육세법 제5조: 맥주는 리터당 정액 주세(2024년
 *    기준 885.7원) + 교육세(주세액의 30%). 탁주는 리터당 정액 주세
 *    (44.4원), 교육세는 면제. 맥주·탁주는 150달러 이하이면 관세·부가세는
 *    면제되지만 주세·교육세는 별도로 부과됨.
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "생활 > 관부가세 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export type CustomsCategory =
  | '의류·신발·가방'
  | '전자제품'
  | '화장품'
  | '향수'
  | '식품·간식'
  | '완구·취미'
  | '서적'
  | '스포츠·아웃도어'
  | '주얼리·액세서리'
  | '기타'
  | '맥주'
  | '탁주'
  | '기능성화장품'
  | '건강기능식품'
  | '기타주류'
  | '담배';

/** 목록통관 배제대상 — 계산 없이 "정식통관 필요" 안내만 표시. */
const EXCLUDED_CATEGORIES: readonly CustomsCategory[] = [
  '기능성화장품',
  '건강기능식품',
  '기타주류',
  '담배',
];

/** 품목별 대표 관세율(종가세, 근사치). */
const TARIFF_RATE: Partial<Record<CustomsCategory, number>> = {
  '의류·신발·가방': 0.13,
  전자제품: 0,
  화장품: 0.065,
  향수: 0.07,
  '식품·간식': 0.08,
  '완구·취미': 0.08,
  서적: 0,
  '스포츠·아웃도어': 0.08,
  '주얼리·액세서리': 0.08,
  기타: 0.08,
};

/** 리터당 정액 주세(원, 2024년 기준). */
const LIQUOR_TAX_PER_LITER: Record<'맥주' | '탁주', number> = {
  맥주: 885.7,
  탁주: 44.4,
};

/** 개별소비세 안내 기준(원) — 이 금액 초과분부터 사치품에 개별소비세가 붙을 수 있음. */
const LUXURY_EXCISE_THRESHOLD_KRW = 2_000_000;

export interface CustomsDutyInput {
  category: CustomsCategory;
  /** 구입국가가 미국인지 여부 (면세기준 150/200달러 분기). */
  isFromUS: boolean;
  /** 물품가격(미화, 배송비 제외). */
  priceUsd: number;
  /** 국제배송비(미화, 선택). */
  shippingUsd?: number;
  /** 적용 환율(원/달러). */
  exchangeRate: number;
  /** 맥주·탁주 카테고리일 때만 사용하는 용량(리터). */
  volumeLiters?: number;
}

export interface CustomsDutyResult {
  /** 목록통관 배제대상이라 계산 없이 안내만 표시해야 하는지 여부. */
  isExcludedCategory: boolean;
  /** 적용된 면세기준(미화). */
  exemptionThresholdUsd: number;
  /** 관세·부가세 면제 여부 (맥주·탁주는 면제되어도 주세·교육세는 별도 부과). */
  isExempt: boolean;
  /** 과세가격(원화 환산, 관세·부가세 계산의 기준액). */
  taxablePriceKrw: number;
  /** 적용된 관세율(참고용, 표시에 사용). */
  tariffRate: number;
  /** 관세 = 과세가격 × 관세율. */
  tariff: number;
  /** 주세(맥주·탁주만). */
  liquorTax?: number;
  /** 교육세(맥주만, 주세액의 30%). */
  educationTax?: number;
  /** 부가가치세 = (과세가격 + 관세 + 주세 + 교육세) × 10%. */
  vat: number;
  /** 예상 총 세액 = 관세 + (주세 + 교육세) + 부가세. */
  totalTax: number;
  /** 과세가격이 200만원을 초과하는 주얼리·액세서리라 개별소비세 안내가 필요한지 여부. */
  luxuryExciseAdvisory: boolean;
}

/** 해외직구 물품의 예상 관세·부가세를 계산합니다. */
export function calculateCustomsDuty(input: CustomsDutyInput): CustomsDutyResult {
  const priceUsd = Math.max(0, input.priceUsd || 0);
  const shippingUsd = Math.max(0, input.shippingUsd || 0);
  const exchangeRate = Math.max(0, input.exchangeRate || 0);
  const volumeLiters = Math.max(0, input.volumeLiters || 0);

  const isExcludedCategory = EXCLUDED_CATEGORIES.includes(input.category);
  const isAlcohol = input.category === '맥주' || input.category === '탁주';

  // 목록통관 배제대상은 국가 구분 없이 150달러, 그 외는 미국 200달러/기타 150달러.
  const exemptionThresholdUsd = isExcludedCategory ? 150 : input.isFromUS ? 200 : 150;
  const isExempt = priceUsd <= exemptionThresholdUsd;

  const taxablePriceUsd = isExempt ? 0 : priceUsd + shippingUsd;
  const taxablePriceKrw = taxablePriceUsd * exchangeRate;

  if (isExcludedCategory) {
    return {
      isExcludedCategory: true,
      exemptionThresholdUsd,
      isExempt,
      taxablePriceKrw,
      tariffRate: 0,
      tariff: 0,
      vat: 0,
      totalTax: 0,
      luxuryExciseAdvisory: false,
    };
  }

  if (isAlcohol) {
    // 주세·교육세는 관세·부가세 면제 여부와 무관하게 항상 부과된다.
    const literRate = LIQUOR_TAX_PER_LITER[input.category as '맥주' | '탁주'];
    const liquorTax = volumeLiters * literRate;
    const educationTax = input.category === '맥주' ? liquorTax * 0.3 : 0;

    if (isExempt) {
      return {
        isExcludedCategory: false,
        exemptionThresholdUsd,
        isExempt: true,
        taxablePriceKrw: 0,
        tariffRate: 0,
        tariff: 0,
        liquorTax,
        educationTax,
        vat: 0,
        totalTax: liquorTax + educationTax,
        luxuryExciseAdvisory: false,
      };
    }

    // 맥주·탁주 모두 WTO 협정관세율 0%.
    const tariff = 0;
    const vat = (taxablePriceKrw + tariff + liquorTax + educationTax) * 0.1;
    return {
      isExcludedCategory: false,
      exemptionThresholdUsd,
      isExempt: false,
      taxablePriceKrw,
      tariffRate: 0,
      tariff,
      liquorTax,
      educationTax,
      vat,
      totalTax: tariff + liquorTax + educationTax + vat,
      luxuryExciseAdvisory: false,
    };
  }

  const tariffRate = TARIFF_RATE[input.category] ?? 0;

  if (isExempt) {
    return {
      isExcludedCategory: false,
      exemptionThresholdUsd,
      isExempt: true,
      taxablePriceKrw: 0,
      tariffRate,
      tariff: 0,
      vat: 0,
      totalTax: 0,
      luxuryExciseAdvisory: false,
    };
  }

  const tariff = taxablePriceKrw * tariffRate;
  const vat = (taxablePriceKrw + tariff) * 0.1;
  const luxuryExciseAdvisory =
    input.category === '주얼리·액세서리' && taxablePriceKrw > LUXURY_EXCISE_THRESHOLD_KRW;

  return {
    isExcludedCategory: false,
    exemptionThresholdUsd,
    isExempt: false,
    taxablePriceKrw,
    tariffRate,
    tariff,
    vat,
    totalTax: tariff + vat,
    luxuryExciseAdvisory,
  };
}
