/**
 * 해외직구 관부가세(관세·개별소비세·주세·교육세·부가세) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 관세청 "해외직구물품 예상세액 조회"(공식 계산기)의 로직을
 * 그대로 재현한 것입니다. 세율은 물품의 정확한 HS 품목분류에 따라
 * 달라질 수 있고, 통관 시점 관세청 고시환율이 실제 적용됩니다.
 *
 * 관세청 공식 계산기와의 검증: 컴퓨터부품(id223, 기본관세), 신발(id40,
 * 기본관세/한미FTA 비교), 와인(id29, 면세기준 이하), 고급손목시계(id44,
 * 200만원 초과 사치품) 5개 케이스를 실제 관세청 라이브 계산기에 동일
 * 입력값으로 넣어 원 단위까지 정확히 일치함을 확인했습니다(2026-07-25).
 *
 * 관세청 공식 계산기 자체의 특이사항(그대로 재현):
 *  - 면세기준은 국가·구입처와 무관하게 항상 "미화 150달러 상당의 원화"
 *    단일 기준입니다. 일부 언론·사설 계산기가 언급하는 "미국 발송
 *    특송화물 200달러" 특례는 관세청의 이 공식 계산기 로직에는 반영되어
 *    있지 않습니다(배송 방법을 입력받지 않기 때문으로 추정).
 *  - 고급핸드백(id37)·고급손목시계(id44)는 과세가격이 200만원을 초과하는
 *    경우에만 계산 가능하며, 개별소비세는 200만원 "초과분"에만 부과됩니다.
 *  - 와인/위스키/사케/브랜디는 면세기준 이하여도 주세는 항상 부과됩니다
 *    (관세·부가세만 면제).
 *
 * 법령 근거:
 *  - 관세법 제241조(수입신고), 「수입통관 사무처리에 관한 고시」: 목록통관
 *    면세기준 미화 150달러 이하. 기준을 단 $1이라도 초과하면 전체 금액이
 *    과세대상.
 *  - 관세법 별표 관세율표, FTA 협정별 양허세율: 품목별 관세율(관세청
 *    공식 데이터, `customsDutyData.ts` 참고).
 *  - 개별소비세법 제1조: 고급핸드백·고급손목시계는 과세가격(물품가격+관세)
 *    200만원 초과분에 개별소비세 20%.
 *  - 교육세법 제5조: 개별소비세액 또는 주세액의 10~30%(품목별 상이).
 *  - 농어촌특별세법: 개별소비세액의 10%(향수만 해당, 다만 향수는
 *    개별소비세율 자체가 0이라 실질적으로 0원).
 *  - 주세법: 와인/사케 30%, 위스키/브랜디 72%. 부가가치세법 제27조:
 *    (과세가격+관세+개별소비세+교육세+주세+농특세) × 10%.
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "생활 > 관부가세 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

import {
  CUSTOMS_ITEMS_DATA,
  TARIFF_RATE_TABLE_DATA,
  CONSUMPTION_TAX_RATE_DATA,
  EDUCATION_TAX_RATE_DATA,
  AGRICULTURE_TAX_RATE_DATA,
  LIQUOR_TAX_RATE_DATA,
} from './customsDutyData';

export type TariffKind = 1 | 4 | 5; // 1=기본관세, 4=한·EU FTA, 5=한·미 FTA

export interface CustomsItem {
  id: number;
  category: string;
  name: string;
}

export const CUSTOMS_ITEMS: CustomsItem[] = CUSTOMS_ITEMS_DATA;

/** 고급핸드백, 고급손목시계 — 과세가격 200만원 초과 시에만 계산 가능, 개별소비세는 초과분에만 부과. */
const LUXURY_ITEM_IDS = new Set([37, 44]);
/** 와인, 위스키, 사케, 브랜디 — 면세기준 이하여도 주세는 항상 부과. */
const ALCOHOL_ITEM_IDS = new Set([29, 30, 128, 129]);

const LUXURY_EXCISE_BASE_KRW = 2_000_000;

/** 품목·관세율구분(kind)에 대한 관세율(%)을 반환합니다. 명시적 항목이 없으면 기본값(FTA 0% / 기본관세 8%)을 적용합니다. */
export function getTariffRate(itemId: number, kind: TariffKind): number {
  const explicit = TARIFF_RATE_TABLE_DATA[itemId]?.[kind];
  if (explicit !== undefined) return explicit;
  return kind === 4 || kind === 5 ? 0 : 8;
}

export interface CustomsDutyInput {
  itemId: number;
  tariffKind: TariffKind;
  /** 물품가격(미화). */
  priceUsd: number;
  /** 적용 환율(원/달러). */
  exchangeRate: number;
}

export interface CustomsDutyResult {
  /** 고급핸드백·고급손목시계인데 과세가격이 200만원 이하라 계산할 수 없는 경우. */
  error?: string;
  /** 과세가격(원화, 소수점 버림). */
  priceKrw: number;
  /** 적용된 관세율(%). */
  tariffRate: number;
  /** 관세. */
  tariff: number;
  /** 개별소비세. */
  consumptionTax: number;
  /** 주세. */
  liquorTax: number;
  /** 농어촌특별세. */
  agricultureTax: number;
  /** 교육세. */
  educationTax: number;
  /** 부가가치세. */
  vat: number;
  /** 세목 합계(면세 여부 반영 전). */
  total: number;
  /** 면세기준(150달러 상당 원화) 이하인지 여부. */
  isBelowExemption: boolean;
  /** 면세기준(원화). */
  exemptionThresholdKrw: number;
  /** 주류(와인·위스키·사케·브랜디) 여부. */
  isAlcohol: boolean;
  /** 실제로 안내해야 할 총액 — 면세기준 이하면 0(주류는 주세만) 처리. */
  displayTotal: number;
}

/** 해외직구 물품의 예상 관세·부가세 등을 계산합니다(관세청 공식 계산기 로직 재현). */
export function calculateCustomsDuty(input: CustomsDutyInput): CustomsDutyResult {
  const priceKrw = Math.floor(input.priceUsd * input.exchangeRate);
  const exemptionThresholdKrw = Math.floor(150 * input.exchangeRate);

  const isLuxury = LUXURY_ITEM_IDS.has(input.itemId);
  if (isLuxury && priceKrw <= LUXURY_EXCISE_BASE_KRW) {
    return {
      error: '이 품목은 과세가격(물품가격 원화 환산액)이 200만원을 초과해야 계산할 수 있습니다.',
      priceKrw,
      tariffRate: 0,
      tariff: 0,
      consumptionTax: 0,
      liquorTax: 0,
      agricultureTax: 0,
      educationTax: 0,
      vat: 0,
      total: 0,
      isBelowExemption: priceKrw <= exemptionThresholdKrw,
      exemptionThresholdKrw,
      isAlcohol: false,
      displayTotal: 0,
    };
  }

  const tariffRate = getTariffRate(input.itemId, input.tariffKind);
  const tariff = Math.floor((priceKrw * tariffRate) / 100);

  const consumptionTaxRate = CONSUMPTION_TAX_RATE_DATA[input.itemId] ?? 0;
  const consumptionTax = isLuxury
    ? Math.floor(((priceKrw + tariff - LUXURY_EXCISE_BASE_KRW) * consumptionTaxRate) / 100)
    : Math.floor(((priceKrw + tariff) * consumptionTaxRate) / 100);

  const liquorTaxRate = LIQUOR_TAX_RATE_DATA[input.itemId] ?? 0;
  const liquorTax = Math.floor(((priceKrw + tariff) * liquorTaxRate) / 100);

  const agricultureTaxRate = AGRICULTURE_TAX_RATE_DATA[input.itemId] ?? 0;
  const agricultureTax = Math.floor((consumptionTax * agricultureTaxRate) / 100);

  const educationTaxRate = EDUCATION_TAX_RATE_DATA[input.itemId] ?? 0;
  // 주세가 있는 품목(주류)은 주세 기준, 없으면 개별소비세 기준으로 교육세를 계산합니다.
  const educationTax =
    liquorTax > 0
      ? Math.floor((educationTaxRate * liquorTax) / 100)
      : Math.floor((consumptionTax * educationTaxRate) / 100);

  const vat = Math.floor(
    ((priceKrw + tariff + consumptionTax + educationTax + liquorTax + agricultureTax) * 10) / 100,
  );

  const total = tariff + consumptionTax + educationTax + agricultureTax + liquorTax + vat;

  const isAlcohol = ALCOHOL_ITEM_IDS.has(input.itemId);
  const isBelowExemption = priceKrw <= exemptionThresholdKrw;
  // 면세기준 이하면 0원이 원칙이나, 주류는 관세·부가세만 면제되고 주세는
  // 항상 부과되므로(관세청 공식 계산기와 동일) 주세액만 안내합니다.
  const displayTotal = isBelowExemption ? (isAlcohol ? liquorTax : 0) : total;

  return {
    priceKrw,
    tariffRate,
    tariff,
    consumptionTax,
    liquorTax,
    agricultureTax,
    educationTax,
    vat,
    total,
    isBelowExemption,
    exemptionThresholdKrw,
    isAlcohol,
    displayTotal,
  };
}
