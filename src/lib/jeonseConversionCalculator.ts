/**
 * 전월세 전환율 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 법정 상한 전환율 규정(주택임대차보호법 제7조의2)은 "임대차 계약이
 * 존속하는 중" 보증금을 월차임으로 전환하거나 계약갱신요구권을 행사하는
 * 경우에 적용되는 강행규정입니다. 신규 계약(처음 임대차 계약을 맺을 때
 * 정하는 조건)에는 이 상한이 법적으로 강제되지 않습니다. 한국은행
 * 기준금리는 통화정책방향 결정에 따라 수시로 바뀌므로, 아래 기본값은
 * 참고용이며 반드시 한국은행 고시로 최신값을 확인해야 합니다.
 *
 * 법령 근거: 주택임대차보호법 제7조의2(월차임 전환 시 산정률의 제한)
 *  - 제1호: 연 1할(10%)
 *  - 제2호: 한국은행 공시 기준금리 + 연 2%
 *  - 위 두 비율 중 낮은 비율을 초과할 수 없음
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 법정 상한 배수(기준금리에 더하는 값). */
const REGULATED_MARGIN = 0.02;
/** 법정 상한 캡(연 1할). */
const REGULATED_CAP = 0.1;

export interface JeonseConversionInput {
  /** 전세보증금(원). */
  jeonseDeposit: number;
  /** 월세 전환 후 보증금(원). jeonseDeposit보다 작아야 합니다. */
  monthlyDeposit: number;
  /** 적용(협의/제안받은) 전환율(%, 예: 5). */
  appliedRatePercent: number;
  /** 한국은행 기준금리(%, 예: 2.75). 법정 상한 계산에만 사용됩니다. */
  baseRatePercent: number;
}

export interface JeonseConversionResult {
  /** 전환 대상 보증금 차액 = 전세보증금 - 월세보증금. */
  depositDiff: number;
  /** 적용 전환율로 계산한 월세. */
  monthlyRent: number;
  /** 법정 상한 전환율(소수, 예: 0.0475 = 4.75%). */
  regulatedCapRate: number;
  /** 법정 상한 전환율 기준 월세(참고용). */
  regulatedCapRent: number;
  /** 적용 전환율이 법정 상한을 초과하는지 여부. */
  exceedsCap: boolean;
}

/** 법정 상한 전환율 = min(10%, 기준금리 + 2%p). */
export function regulatedCapRate(baseRatePercent: number): number {
  const baseRate = Math.max(0, baseRatePercent || 0) / 100;
  return Math.min(REGULATED_CAP, baseRate + REGULATED_MARGIN);
}

/** 전월세 전환 결과를 계산합니다. */
export function calculateJeonseConversion(
  input: JeonseConversionInput,
): JeonseConversionResult {
  const jeonseDeposit = Math.max(0, input.jeonseDeposit || 0);
  const monthlyDeposit = Math.max(0, Math.min(input.monthlyDeposit || 0, jeonseDeposit));
  const appliedRate = Math.max(0, input.appliedRatePercent || 0) / 100;

  const depositDiff = jeonseDeposit - monthlyDeposit;
  const monthlyRent = (depositDiff * appliedRate) / 12;

  const capRate = regulatedCapRate(input.baseRatePercent);
  const regulatedCapRent = (depositDiff * capRate) / 12;

  return {
    depositDiff,
    monthlyRent,
    regulatedCapRate: capRate,
    regulatedCapRent,
    exceedsCap: appliedRate > capRate,
  };
}
