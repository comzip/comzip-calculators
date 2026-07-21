/**
 * 주휴수당 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 주휴수당은 "1주 소정근로일을 개근"했을 때 발생합니다. 이 계산기는
 * 개근을 전제로 한 금액만 계산하며, 실제 결근·지각 등 개별 사정은
 * 반영하지 않습니다.
 *
 * 법령 근거: 근로기준법 제55조(휴일), 제18조제3항(단시간근로자),
 * 근로기준법 시행령 제30조
 *  - 지급 요건: 4주 평균 1주 소정근로시간 15시간 이상 + 소정근로일 개근
 *  - 통상근로자(주 40시간, 1일 8시간) 기준 주휴수당 = 8시간분 시급
 *  - 단시간근로자는 (1주 소정근로시간 ÷ 40) 비율로 비례 계산
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 지급 요건이 되는 최소 주 소정근로시간(시간). */
const MIN_WEEKLY_HOURS_FOR_ELIGIBILITY = 15;
/** 통상근로자 기준 주 소정근로시간(시간) — 비례 계산의 분모. */
const STANDARD_WEEKLY_HOURS = 40;
/** 통상근로자 1일 소정근로시간(시간) — 주휴수당의 기준 시간. */
const STANDARD_DAILY_HOURS = 8;

export interface WeeklyHolidayPayInput {
  /** 시급(원). */
  hourlyWage: number;
  /** 4주 평균 1주 소정근로시간(시간). */
  weeklyHours: number;
}

export interface WeeklyHolidayPayResult {
  /** 지급 요건(주 15시간 이상) 충족 여부. */
  eligible: boolean;
  /** 주휴수당 산정에 쓰이는 시간(시간). 최대 8시간으로 상한. */
  payableHours: number;
  /** 주휴수당(원). 지급 요건 미충족 시 0. */
  weeklyHolidayPay: number;
}

/** 주휴수당을 계산합니다. */
export function calculateWeeklyHolidayPay(
  input: WeeklyHolidayPayInput,
): WeeklyHolidayPayResult {
  const hourlyWage = Math.max(0, input.hourlyWage || 0);
  const weeklyHours = Math.max(0, input.weeklyHours || 0);

  const eligible = weeklyHours >= MIN_WEEKLY_HOURS_FOR_ELIGIBILITY;
  if (!eligible) {
    return { eligible, payableHours: 0, weeklyHolidayPay: 0 };
  }

  // 통상근로자(주 40시간)를 초과해도 주휴수당은 1일(8시간)분이 상한.
  const ratio = Math.min(weeklyHours, STANDARD_WEEKLY_HOURS) / STANDARD_WEEKLY_HOURS;
  const payableHours = STANDARD_DAILY_HOURS * ratio;
  const weeklyHolidayPay = payableHours * hourlyWage;

  return { eligible, payableHours, weeklyHolidayPay };
}
