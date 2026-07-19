/**
 * 대출이자(원리금균등/원금균등) 상환 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "단순화된 추정"입니다. 실제 대출 상품은 중도상환수수료,
 * 변동금리(금리 변동), 이자 계산 방식(일할 계산 등)이나 원 단위
 * 반올림 규칙이 서로 달라, 실제 상환액과 차이가 있을 수 있습니다.
 *
 * 즉, 이 모듈의 결과는 참고용 ESTIMATE이며 특정 금융상품의 실제
 * 상환 스케줄이 아닙니다.
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 상환방식. */
export type LoanMethod = '원리금균등' | '원금균등';

/** 상환 스케줄 한 회차(월)의 내역. */
export interface LoanScheduleRow {
  /** 회차 (1..n). */
  month: number;
  /** 해당 월의 총 상환액 (납입원금 + 납입이자). */
  payment: number;
  /** 해당 월의 납입원금. */
  principalPortion: number;
  /** 해당 월의 납입이자. */
  interestPortion: number;
  /** 해당 월 상환 후 남은 대출잔액. */
  remainingBalance: number;
}

export interface LoanInput {
  /** 대출원금 (원). */
  principal: number;
  /** 연이자율 (%, 예: 4.5). */
  annualRatePercent: number;
  /** 대출기간 (개월). */
  months: number;
  /** 상환방식. */
  method: LoanMethod;
}

export interface LoanResult {
  /** 월별 상환 스케줄 (길이 n). */
  schedule: LoanScheduleRow[];
  /** 총 상환금액 (스케줄의 payment 합계). */
  totalPayment: number;
  /** 총 이자 (총 상환금액 - 원금). */
  totalInterest: number;
  /**
   * 매월 고정 상환액. 원리금균등에서만 의미가 있으며,
   * 원금균등에서는 매월 달라지므로 undefined 입니다.
   */
  monthlyPayment?: number;
}

/**
 * 원리금균등상환(amortized) 스케줄을 계산합니다.
 * 매월 상환액이 일정하며, 초기에는 이자 비중이 크고 후기로 갈수록
 * 원금 비중이 커집니다.
 */
function calculateEqualInstallment(
  principal: number,
  monthlyRate: number,
  months: number,
): LoanResult {
  // 이자율이 0이면 원금을 회차수로 균등 분할합니다.
  const monthlyPayment =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
        (Math.pow(1 + monthlyRate, months) - 1);

  const schedule: LoanScheduleRow[] = [];
  let remainingBalance = principal;

  for (let i = 1; i <= months; i++) {
    const interestPortion = remainingBalance * monthlyRate;
    const principalPortion = monthlyPayment - interestPortion;
    remainingBalance -= principalPortion;
    schedule.push({
      month: i,
      payment: monthlyPayment,
      principalPortion,
      interestPortion,
      // 마지막 회차의 미세한 부동소수 오차를 0으로 보정합니다.
      remainingBalance: i === months ? 0 : remainingBalance,
    });
  }

  // 반올림 누적 오차를 피하기 위해 스케줄 합계를 사용합니다.
  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0);
  const totalInterest = totalPayment - principal;

  return { schedule, totalPayment, totalInterest, monthlyPayment };
}

/**
 * 원금균등상환 스케줄을 계산합니다.
 * 매월 납입원금이 일정하고 이자는 잔액에 비례하므로, 첫 달 상환액이
 * 가장 크고 마지막 달 상환액이 가장 작습니다.
 */
function calculateEqualPrincipal(
  principal: number,
  monthlyRate: number,
  months: number,
): LoanResult {
  const monthlyPrincipal = principal / months;

  const schedule: LoanScheduleRow[] = [];
  let remainingBalance = principal;

  for (let i = 1; i <= months; i++) {
    const interestPortion = remainingBalance * monthlyRate;
    const payment = monthlyPrincipal + interestPortion;
    remainingBalance -= monthlyPrincipal;
    schedule.push({
      month: i,
      payment,
      principalPortion: monthlyPrincipal,
      interestPortion,
      remainingBalance: i === months ? 0 : remainingBalance,
    });
  }

  const totalInterest = schedule.reduce(
    (sum, row) => sum + row.interestPortion,
    0,
  );
  const totalPayment = principal + totalInterest;

  return { schedule, totalPayment, totalInterest };
}

/**
 * 대출 상환 스케줄과 총 이자/총 상환금액을 계산합니다.
 *
 * r = 연이자율 / 100 / 12 (월 이자율), n = 대출기간(개월),
 * P = 대출원금.
 */
export function calculateLoan(input: LoanInput): LoanResult {
  const principal = Math.max(0, input.principal || 0);
  const annualRatePercent = Math.max(0, input.annualRatePercent || 0);
  const months = Math.max(1, Math.floor(input.months || 0));

  const monthlyRate = annualRatePercent / 100 / 12;

  if (input.method === '원금균등') {
    return calculateEqualPrincipal(principal, monthlyRate, months);
  }
  return calculateEqualInstallment(principal, monthlyRate, months);
}
