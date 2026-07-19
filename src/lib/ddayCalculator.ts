/**
 * D-Day(디데이) 계산 모듈.
 *
 * 목표 날짜와 기준 날짜(기본값: 오늘) 사이의 남은/지난 일수를 계산하고,
 * 한국식 D-day 표기(D-100 / D-DAY / D+50)와 요일 정보를 함께 제공합니다.
 *
 * 시간대(timezone)/DST로 인한 하루 오차를 피하기 위해, 두 날짜 모두
 * 로컬 자정(time-of-day 제거) 기준으로 정규화한 뒤 일수를 계산합니다.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 요일 인덱스(0=일 ~ 6=토)에 대응하는 한국어 요일. */
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface DdayResult {
  /** 기준일(자정)에서 목표일(자정)까지의 일수. 미래면 양수, 과거면 음수. */
  diffDays: number;
  /** 한국식 D-day 표기: `D-100`(미래) / `D-DAY`(당일) / `D+50`(과거). */
  label: string;
  /** 목표 날짜의 한국어 요일 (월/화/수/목/금/토/일). */
  weekday: string;
}

/** 하루를 밀리초로 나타낸 값. */
const MS_PER_DAY = 86_400_000;

/** 날짜에서 time-of-day를 제거해 로컬 자정 기준 Date로 정규화합니다. */
function toLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 목표 날짜까지의 D-day를 계산합니다.
 *
 * @param targetDateStr `YYYY-MM-DD` 형식의 목표 날짜 문자열(예: `<input type="date">` 값).
 * @param referenceDate 기준 날짜. 기본값은 현재 시각(오늘). 테스트를 위해 주입 가능.
 * @returns `diffDays`, `label`, `weekday`를 담은 결과 객체.
 * @throws 목표 날짜 문자열이 유효하지 않으면 Error를 던집니다.
 */
export function calculateDday(
  targetDateStr: string,
  referenceDate: Date = new Date(),
): DdayResult {
  const parts = targetDateStr.split('-').map(Number);
  const [ty, tm, td] = parts;

  if (
    parts.length !== 3 ||
    parts.some((n) => Number.isNaN(n)) ||
    tm < 1 ||
    tm > 12 ||
    td < 1 ||
    td > 31
  ) {
    throw new Error('올바른 날짜 형식(YYYY-MM-DD)이 아닙니다.');
  }

  const target = new Date(ty, tm - 1, td);
  // 파싱된 값과 실제 Date가 일치하지 않으면(예: 2월 30일) 무효 처리.
  if (
    target.getFullYear() !== ty ||
    target.getMonth() !== tm - 1 ||
    target.getDate() !== td
  ) {
    throw new Error('존재하지 않는 날짜입니다.');
  }

  const targetMidnight = toLocalMidnight(target);
  const todayMidnight = toLocalMidnight(referenceDate);

  const diffDays = Math.round(
    (targetMidnight.getTime() - todayMidnight.getTime()) / MS_PER_DAY,
  );

  let label: string;
  if (diffDays > 0) {
    label = `D-${diffDays}`;
  } else if (diffDays === 0) {
    label = 'D-DAY';
  } else {
    label = `D+${Math.abs(diffDays)}`;
  }

  const weekday = WEEKDAYS_KO[targetMidnight.getDay()];

  return { diffDays, label, weekday };
}
