/**
 * 해외직구 관부가세(관세·부가세·주세 등) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 세액은 품목의 정확한 HS 품목분류,
 * 통관 시점 관세청 고시환율, 자가사용인정기준 초과 여부 등에 따라
 * 달라질 수 있습니다. 아래 간이세율(18%/19%/15%/20%)은 관세법 제81조·
 * 시행령 제96조에 따른 여행자휴대품·우편물·특송물품용 간이세율의
 * 일반적인 적용 구간이며, 실제 통관 시엔 정식 HS 품목분류에 따른 세율이
 * 적용될 수도 있습니다.
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
 *  - 관세법 제81조, 관세법 시행령 제96조·별표2(간이세율): 모피의류·제품
 *    19%, 가죽제 의류·신발류 등 섬유제품 18%, 그 외 일반품목 15%,
 *    보석·귀금속·고급시계·고급가방 등 20%.
 *  - WTO 정보기술협정(ITA): 스마트폰·노트북·태블릿 등 IT제품은 관세 0%.
 *  - 부가가치세법 제27조: 부가세 = (과세가격 + 관세 + 개별소비세 등) × 10%.
 *  - 개별소비세법 제1조: 보석·귀금속·고급시계·고급가방·모피 등 사치품은
 *    과세가격 200만원 초과분에 개별소비세 20% + 교육세(개별소비세의
 *    30%)가 별도 부과(이 계산기는 자동계산하지 않고 안내만 함).
 *  - 주세법(제7조 세율), 교육세법 제5조: 맥주는 리터당 정액 주세(2024년
 *    기준 885.7원) + 교육세(주세액의 30%). 탁주는 리터당 정액 주세
 *    (44.4원), 교육세는 면제. 맥주·탁주는 150달러 이하이면 관세·부가세는
 *    면제되지만 주세·교육세는 별도로 부과됨.
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 관부가세 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export type CustomsCategory =
  | '의류·신발'
  | '모피'
  | 'IT기기'
  | '일반품목'
  | '사치품'
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

/** 간이세율(관세+부가세 등을 합산한 단일 세율)이 적용되는 카테고리. */
const SIMPLIFIED_RATE: Partial<Record<CustomsCategory, number>> = {
  '의류·신발': 0.18,
  모피: 0.19,
  일반품목: 0.15,
  사치품: 0.2,
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
  /** 관세. */
  tariff: number;
  /** 간이세율 적용 시의 합산 세액(관세+부가세 등을 분리하지 않음). */
  simplifiedTax?: number;
  /** 주세(맥주·탁주만). */
  liquorTax?: number;
  /** 교육세(맥주만, 주세액의 30%). */
  educationTax?: number;
  /** 부가가치세. */
  vat: number;
  /** 예상 총 세액. */
  totalTax: number;
  /** 사치품이고 과세가격이 200만원을 초과해 개별소비세 안내가 필요한지 여부. */
  luxuryExciseAdvisory: boolean;
}

/** 해외직구 물품의 예상 관부가세를 계산합니다. */
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
      tariff,
      liquorTax,
      educationTax,
      vat,
      totalTax: tariff + liquorTax + educationTax + vat,
      luxuryExciseAdvisory: false,
    };
  }

  if (isExempt) {
    return {
      isExcludedCategory: false,
      exemptionThresholdUsd,
      isExempt: true,
      taxablePriceKrw: 0,
      tariff: 0,
      vat: 0,
      totalTax: 0,
      luxuryExciseAdvisory: false,
    };
  }

  if (input.category === 'IT기기') {
    const tariff = 0;
    const vat = taxablePriceKrw * 0.1;
    return {
      isExcludedCategory: false,
      exemptionThresholdUsd,
      isExempt: false,
      taxablePriceKrw,
      tariff,
      vat,
      totalTax: tariff + vat,
      luxuryExciseAdvisory: false,
    };
  }

  const rate = SIMPLIFIED_RATE[input.category] ?? 0;
  const simplifiedTax = taxablePriceKrw * rate;
  const luxuryExciseAdvisory =
    input.category === '사치품' && taxablePriceKrw > LUXURY_EXCISE_THRESHOLD_KRW;

  return {
    isExcludedCategory: false,
    exemptionThresholdUsd,
    isExempt: false,
    taxablePriceKrw,
    tariff: 0,
    simplifiedTax,
    vat: 0,
    totalTax: simplifiedTax,
    luxuryExciseAdvisory,
  };
}
