/**
 * 예금(거치식)·적금(적립식) 이자 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 상품별 이자 계산 방식(월복리·연복리
 * 여부, 중도해지이율 등)은 금융회사·상품마다 다를 수 있으며, 이 계산기는
 * 만기까지 정상 유지한다고 가정한 세전·세후 이자만 다룹니다.
 *
 *  - 예금(거치식) 단리: 원금 × 연이율 × (개월수/12)
 *  - 예금(거치식) 복리: 월복리로 고정 가정(분기·연복리 상품과는 다를 수 있음)
 *  - 적금(적립식)은 은행 업계 관행에 따라 회차별 단리로 계산합니다 — 1회차
 *    납입분은 만기까지 개월수 전체(= 개월수)만큼, 마지막 회차 납입분은
 *    1개월만큼 이자가 붙는다고 가정합니다. 법정 세율표가 아니라 업계
 *    관행이므로, 실제 은행 계산기와 대조 검증한 값입니다(LEGAL_REFERENCES.md
 *    참고).
 *  - 이자소득세는 14%(소득세법 제129조제1항제1호라목 — "그 밖의 이자소득")
 *    + 개인지방소득세 1.4%p(지방세법 제103조의13제1항, 원천징수 소득세의
 *    10%)를 합산한 15.4% 단일세율만 반영합니다. 비과세종합저축·세금우대
 *    저축 등 감면 상품은 반영하지 않습니다.
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "예적금 이자 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export type SavingsProductType = '예금' | '적금';
export type DepositInterestMethod = '단리' | '복리';

/** 이자소득세 원천징수세율(%): 소득세 14% + 개인지방소득세 1.4%p = 15.4%. */
export const INTEREST_INCOME_TAX_RATE_PERCENT = 15.4;

export interface SavingsInterestInput {
  productType: SavingsProductType;
  /** [예금] 예치 원금, 원. */
  principal?: number;
  /** [적금] 월 납입액, 원. */
  monthlyDeposit?: number;
  /** 예치/납입 개월수. */
  months: number;
  /** 연 이자율(%, 세전 표면금리). */
  annualRatePercent: number;
  /** [예금 전용] 단리/복리(월복리). 적금은 관행상 단리로 고정 계산되어 무시됩니다. */
  interestMethod?: DepositInterestMethod;
}

export interface SavingsInterestScheduleRow {
  /** 회차(1부터 시작). */
  period: number;
  /** 이 회차 납입액. */
  amount: number;
  /** 이 납입분이 만기까지 이자가 붙는 개월수. */
  monthsHeld: number;
  /** 이 회차분에서 발생하는 세전 이자. */
  interest: number;
}

export interface SavingsInterestResult {
  /** 원금 합계(예금: 예치 원금 그대로 / 적금: 월 납입액 × 개월수). */
  totalPrincipal: number;
  preTaxInterest: number;
  interestTaxRatePercent: number;
  interestTax: number;
  postTaxInterest: number;
  /** 세전 기준 만기 수령액 = 원금 합계 + 세전 이자. */
  totalPayoutPreTax: number;
  /** 세후 기준 만기 수령액 = 원금 합계 + 세후 이자. */
  totalPayoutPostTax: number;
  /** 세후 이자를 원금 합계 대비 연 환산한 단순(비복리) 실효수익률(%). */
  effectiveAnnualReturnPercent: number;
  /** [적금 전용] 회차별 납입·이자 내역. 예금은 빈 배열. */
  schedule: SavingsInterestScheduleRow[];
}

/** 적금(적립식) 회차별 내역을 계산합니다 — 헤드라인 숫자가 아니라 표시용입니다. */
function buildInstallmentSchedule(
  monthlyDeposit: number,
  months: number,
  annualRatePercent: number,
): SavingsInterestScheduleRow[] {
  const schedule: SavingsInterestScheduleRow[] = [];
  for (let period = 1; period <= months; period += 1) {
    const monthsHeld = months - period + 1;
    const interest = monthlyDeposit * (annualRatePercent / 1200) * monthsHeld;
    schedule.push({ period, amount: monthlyDeposit, monthsHeld, interest });
  }
  return schedule;
}

/** 예금·적금의 세전·세후 이자와 만기 수령액을 계산합니다. */
export function calculateSavingsInterest(input: SavingsInterestInput): SavingsInterestResult {
  const months = Math.max(0, Math.floor(input.months || 0));
  const annualRatePercent = Math.max(0, input.annualRatePercent || 0);

  let totalPrincipal: number;
  let preTaxInterest: number;
  let schedule: SavingsInterestScheduleRow[] = [];

  if (input.productType === '예금') {
    const principal = Math.max(0, input.principal || 0);
    totalPrincipal = principal;
    if (input.interestMethod === '복리') {
      const monthlyRate = annualRatePercent / 1200;
      preTaxInterest = principal * (Math.pow(1 + monthlyRate, months) - 1);
    } else {
      preTaxInterest = principal * (annualRatePercent / 100) * (months / 12);
    }
  } else {
    const monthlyDeposit = Math.max(0, input.monthlyDeposit || 0);
    totalPrincipal = monthlyDeposit * months;
    // 닫힌 형태(가우스 합): 1회차는 개월수만큼, 마지막 회차는 1개월만큼
    // 이자가 붙는다 — 월별 루프와 수학적으로 동일하되 O(1)이고 부동소수점
    // 누적 오차가 없다. 실제 은행 적금 계산기와 대조 검증됨(LEGAL_REFERENCES.md).
    preTaxInterest =
      monthlyDeposit * ((months * (months + 1)) / 2) * (annualRatePercent / 1200);
    schedule = buildInstallmentSchedule(monthlyDeposit, months, annualRatePercent);
  }

  const interestTax = preTaxInterest * (INTEREST_INCOME_TAX_RATE_PERCENT / 100);
  const postTaxInterest = preTaxInterest - interestTax;
  const totalPayoutPreTax = totalPrincipal + preTaxInterest;
  const totalPayoutPostTax = totalPrincipal + postTaxInterest;
  const effectiveAnnualReturnPercent =
    totalPrincipal > 0 && months > 0
      ? (postTaxInterest / totalPrincipal) * (12 / months) * 100
      : 0;

  return {
    totalPrincipal,
    preTaxInterest,
    interestTaxRatePercent: INTEREST_INCOME_TAX_RATE_PERCENT,
    interestTax,
    postTaxInterest,
    totalPayoutPreTax,
    totalPayoutPostTax,
    effectiveAnnualReturnPercent,
    schedule,
  };
}
