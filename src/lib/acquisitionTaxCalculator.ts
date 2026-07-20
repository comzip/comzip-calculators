/**
 * 주택 취득세(유상거래) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 일시적 2주택 특례, 생애최초 특례감면,
 * 고급주택(사치성재산) 추가 중과(+8%p), 무상취득(상속·증여) 등은
 * 반영하지 않았습니다. 조정대상지역 지정 현황은 지역·시점마다 달라
 * 반드시 최신 고시를 확인해야 합니다.
 *
 * 즉, 이 모듈의 결과는 참고용 ESTIMATE이며 공식적인 세액 계산이
 * 아닙니다. 실제 고지세액과 차이가 있을 수 있습니다.
 *
 * 법령 근거:
 *  - 취득세율: 지방세법 제11조(부동산 취득의 세율), 제13조의2(주택 유상
 *    거래 취득 등 중과세율)
 *  - 지방교육세: 지방세법 제151조
 *  - 농어촌특별세: 농어촌특별세법 제5조
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 주택 수 구분(취득 대상 주택 포함, 1세대 기준). */
export type HouseCountForAcquisition = '1주택' | '2주택' | '3주택' | '4주택이상또는법인';

export interface AcquisitionTaxInput {
  /** 취득가액(매매가, 원). */
  price: number;
  /** 주택 수(이번에 취득하는 주택 포함). */
  houseCount: HouseCountForAcquisition;
  /** 조정대상지역 여부 (2주택·3주택 구간에서만 세율에 영향). */
  isRegulatedArea: boolean;
  /** 전용면적 85㎡ 초과 여부 (농어촌특별세 과세 여부 결정). */
  isOver85Sqm: boolean;
}

export interface AcquisitionTaxResult {
  /** 적용된 취득세율(소수, 예: 0.01 = 1%). */
  rate: number;
  /** 중과세율(8%/12%) 적용 여부. */
  isHeavyRate: boolean;
  /** 취득세 본세. */
  acquisitionTax: number;
  /** 지방교육세. */
  localEducationTax: number;
  /** 농어촌특별세(85㎡ 이하이면 0). */
  ruralSpecialTax: number;
  /** 합계. */
  total: number;
}

/**
 * 1주택(또는 일반세율 적용) 유상취득 표준세율.
 *  - 6억원 이하: 1%
 *  - 6억원 초과 ~ 9억원 이하: (취득가액(억원) × 2/3 − 3)%, 선형 구간
 *  - 9억원 초과: 3%
 */
function standardRate(price: number): number {
  const eok = price / 100_000_000; // 억원 단위
  if (price <= 600_000_000) return 0.01;
  if (price <= 900_000_000) return (eok * (2 / 3) - 3) / 100;
  return 0.03;
}

/**
 * 주택 수·조정대상지역 여부에 따라 취득세율과 중과 여부를 결정합니다.
 */
function resolveRate(
  price: number,
  houseCount: HouseCountForAcquisition,
  isRegulatedArea: boolean,
): { rate: number; isHeavyRate: boolean } {
  if (houseCount === '1주택') {
    return { rate: standardRate(price), isHeavyRate: false };
  }
  if (houseCount === '2주택') {
    return isRegulatedArea
      ? { rate: 0.08, isHeavyRate: true }
      : { rate: standardRate(price), isHeavyRate: false };
  }
  if (houseCount === '3주택') {
    return isRegulatedArea
      ? { rate: 0.12, isHeavyRate: true }
      : { rate: 0.08, isHeavyRate: true };
  }
  // 4주택 이상 또는 법인: 조정대상지역 여부와 무관하게 12%.
  return { rate: 0.12, isHeavyRate: true };
}

/** 취득세·지방교육세·농어촌특별세를 계산합니다. */
export function calculateAcquisitionTax(input: AcquisitionTaxInput): AcquisitionTaxResult {
  const price = Math.max(0, input.price || 0);
  const { rate, isHeavyRate } = resolveRate(price, input.houseCount, input.isRegulatedArea);

  const acquisitionTax = price * rate;

  // 지방교육세: 일반세율(1~3%)이면 세율의 10%, 중과세율(8%/12%)이면
  // 세율과 무관하게 0.4% 일괄 적용.
  const localEducationTax = isHeavyRate ? price * 0.004 : price * rate * 0.1;

  // 농어촌특별세: 전용면적 85㎡ 이하이면 비과세. 초과 시 일반세율은
  // 0.2%, 중과 8%는 0.6%, 중과 12%는 1.0%.
  let ruralSpecialTax = 0;
  if (input.isOver85Sqm) {
    if (!isHeavyRate) ruralSpecialTax = price * 0.002;
    else if (rate === 0.08) ruralSpecialTax = price * 0.006;
    else ruralSpecialTax = price * 0.01;
  }

  const total = acquisitionTax + localEducationTax + ruralSpecialTax;

  return { rate, isHeavyRate, acquisitionTax, localEducationTax, ruralSpecialTax, total };
}
