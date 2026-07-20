/**
 * 퇴직금 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 평균임금 산정은 임금 항목의 포함/제외
 * 여부(상여금·연차수당의 비례 배분 등)와 통상임금과의 비교(평균임금이
 * 통상임금보다 낮으면 통상임금을 적용) 등 세부 규칙이 있어, 아래 로직은
 * 이를 단순화한 근사치입니다. 실제 퇴직금과 차이가 있을 수 있습니다.
 *
 * 법령 근거:
 *  - 근로자퇴직급여 보장법 제8조(퇴직금제도의 설정 등): 퇴직금 = 평균임금
 *    × 30일분 × (계속근로기간/365)
 *  - 근로기준법 제2조(정의): 평균임금 = 산정사유발생일 이전 3개월간 임금
 *    총액 / 그 3개월간의 총일수(역일수). 상여금은 연간 총액의 3개월분을
 *    포함하여 계산.
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export interface SeveranceInput {
  /** 입사일 (YYYY-MM-DD). */
  hireDate: string;
  /** 퇴사일 (YYYY-MM-DD). */
  resignDate: string;
  /** 퇴사일 이전 3개월간 지급된 임금 총액(세전, 기본급+제수당, 원). */
  threeMonthWage: number;
  /** 연간 상여금 총액(선택, 원). 3개월분(1/4)만 평균임금 산정에 포함됩니다. */
  annualBonus?: number;
  /** 재직 중 지급받은 연차수당의 연간 총액(선택, 원). 3개월분(1/4)만 포함됩니다. */
  annualLeaveAllowance?: number;
}

export interface SeveranceResult {
  /** 재직일수(역일수, 입사일~퇴사일). */
  workDays: number;
  /** 평균임금 산정 기간의 총일수(퇴사일 이전 3개월의 역일수, 보통 89~92일). */
  periodDays: number;
  /** 1일 평균임금. */
  averageDailyWage: number;
  /** 퇴직금 = 평균임금 × 30 × (재직일수/365). */
  severancePay: number;
  /** 재직일수가 365일 이상이어야 법정 지급 대상입니다(근로자퇴직급여 보장법 제4조). */
  eligible: boolean;
}

/** 날짜에서 time-of-day를 제거해 로컬 자정 기준 Date로 정규화합니다. */
function toLocalMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `YYYY-MM-DD` 문자열을 로컬 자정 Date로 파싱합니다. */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const MS_PER_DAY = 86_400_000;

/**
 * 퇴직금을 계산합니다.
 *
 * @throws 입사일이 퇴사일보다 늦으면 Error를 던집니다.
 */
export function calculateSeverance(input: SeveranceInput): SeveranceResult {
  const hireDate = toLocalMidnight(parseDate(input.hireDate));
  const resignDate = toLocalMidnight(parseDate(input.resignDate));

  if (hireDate.getTime() > resignDate.getTime()) {
    throw new Error('입사일은 퇴사일보다 늦을 수 없습니다.');
  }

  const workDays = Math.round((resignDate.getTime() - hireDate.getTime()) / MS_PER_DAY);

  // 평균임금 산정 기간: 퇴사일 이전 3개월(역일수).
  const threeMonthsAgo = new Date(resignDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const periodDays = Math.round(
    (resignDate.getTime() - threeMonthsAgo.getTime()) / MS_PER_DAY,
  );

  const threeMonthWage = Math.max(0, input.threeMonthWage || 0);
  const annualBonus = Math.max(0, input.annualBonus || 0);
  const annualLeaveAllowance = Math.max(0, input.annualLeaveAllowance || 0);

  const wageTotal = threeMonthWage + (annualBonus + annualLeaveAllowance) * (3 / 12);
  const averageDailyWage = periodDays > 0 ? wageTotal / periodDays : 0;

  const severancePay = averageDailyWage * 30 * (workDays / 365);

  return {
    workDays,
    periodDays,
    averageDailyWage,
    severancePay,
    eligible: workDays >= 365,
  };
}
