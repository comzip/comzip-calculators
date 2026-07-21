/**
 * 연차유급휴가 개수·연차수당 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 근속 1년 미만 구간의 "매월 1일씩"은 해당 월을 개근했다는 가정 하의
 * 근사치입니다(실제로는 결근이 있으면 그 달은 발생하지 않음). 1년 이상
 * 구간도 "직전 1년간 80% 이상 출근"을 가정합니다. 회계연도 기준으로
 * 연차를 부여하는 회사(입사일이 아닌 매년 1월 1일 기준)는 계산 방식이
 * 다를 수 있습니다.
 *
 * 법령 근거: 근로기준법 제60조(연차 유급휴가)
 *  - 계속근로 1년 미만: 1개월 개근 시 1일(최대 11일)
 *  - 계속근로 1년 이상(80% 이상 출근): 15일
 *  - 계속근로 3년 이상: 최초 1년 초과 매 2년마다 1일 가산, 총 25일 한도
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 1년 미만 근로자의 최대 연차 일수. */
const FIRST_YEAR_MAX_DAYS = 11;
/** 1년 이상 근로자의 기본 연차 일수. */
const BASE_ANNUAL_DAYS = 15;
/** 가산휴가를 포함한 총 연차 일수 한도. */
const MAX_ANNUAL_DAYS = 25;

export interface AnnualLeaveInput {
  /** 입사일(YYYY-MM-DD). */
  hireDate: string;
  /** 연차 개수를 산정할 기준일(YYYY-MM-DD). 보통 오늘. */
  asOfDate: string;
  /** 1일 통상임금(원, 선택). 연차수당 계산에 사용됩니다. */
  dailyWage?: number;
}

export interface AnnualLeaveResult {
  /** 근속 개월수(만, 기준일까지 완료된 개월). */
  totalMonths: number;
  /** 근속 연수(만, floor). */
  years: number;
  /** 입사 1년 미만인지 여부. */
  isFirstYear: boolean;
  /** 가산휴가 일수(1년 이상인 경우). */
  bonusDays: number;
  /** 총 연차 일수. */
  totalDays: number;
  /** 연차수당(원). dailyWage가 주어졌을 때만 계산됩니다. */
  annualLeavePay?: number;
}

/** 로컬 자정 기준으로 두 날짜 사이의 완료된 개월수를 계산합니다. */
function monthsBetween(start: Date, end: Date): number {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/** `YYYY-MM-DD` 문자열을 로컬 자정 Date로 파싱합니다. */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 연차 개수와(선택 시) 연차수당을 계산합니다. */
export function calculateAnnualLeave(input: AnnualLeaveInput): AnnualLeaveResult {
  const hireDate = parseDate(input.hireDate);
  const asOfDate = parseDate(input.asOfDate);

  const totalMonths = monthsBetween(hireDate, asOfDate);
  const years = Math.floor(totalMonths / 12);
  const isFirstYear = years < 1;

  let totalDays: number;
  let bonusDays = 0;

  if (isFirstYear) {
    totalDays = Math.min(FIRST_YEAR_MAX_DAYS, totalMonths);
  } else {
    bonusDays = Math.min(MAX_ANNUAL_DAYS - BASE_ANNUAL_DAYS, Math.floor((years - 1) / 2));
    totalDays = BASE_ANNUAL_DAYS + bonusDays;
  }

  const result: AnnualLeaveResult = {
    totalMonths,
    years,
    isFirstYear,
    bonusDays,
    totalDays,
  };

  if (input.dailyWage !== undefined && input.dailyWage > 0) {
    result.annualLeavePay = totalDays * input.dailyWage;
  }

  return result;
}
