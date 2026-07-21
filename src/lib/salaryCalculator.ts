/**
 * 연봉 실수령액(월/연) 추정 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 원천징수세액은 국세청 근로소득
 * 간이세액표를 기준으로 산정되며, 아래 로직은 이를 단순화한 근사치
 * 입니다. 또한 4대보험 요율과 세율/공제 기준은 매년 변경되므로,
 * 아래 상수들은 시점에 따라 실제와 달라질 수 있습니다.
 *
 * 즉, 이 모듈의 결과는 참고용 ESTIMATE이며 공식적인 원천징수 계산이
 * 아닙니다. 실제 실수령액과 차이가 있을 수 있습니다.
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "급여 > 연봉 실수령액 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

// --- 4대보험 요율 (근로자 부담분 기준) ---
const PENSION_RATE = 0.045; // 국민연금 4.5%
const PENSION_MIN_BASE = 370_000; // 국민연금 기준소득월액 하한
const PENSION_MAX_BASE = 5_900_000; // 국민연금 기준소득월액 상한
const HEALTH_RATE = 0.03545; // 건강보험 3.545%
const LONG_TERM_CARE_RATE = 0.1295; // 장기요양보험: 건강보험료의 12.95%
const EMPLOYMENT_RATE = 0.009; // 고용보험 0.9%

const PERSONAL_DEDUCTION_PER_DEPENDENT = 1_500_000; // 인적공제(기본공제) 1인당

/** 값을 [min, max] 범위로 제한합니다. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 근로소득공제 (연간, 연봉 기준).
 * 구간별 누진 방식.
 */
export function earnedIncomeDeduction(annualSalary: number): number {
  if (annualSalary <= 5_000_000) {
    return annualSalary * 0.7;
  }
  if (annualSalary <= 15_000_000) {
    return 3_500_000 + (annualSalary - 5_000_000) * 0.15;
  }
  if (annualSalary <= 45_000_000) {
    return 7_500_000 + (annualSalary - 15_000_000) * 0.05;
  }
  if (annualSalary <= 100_000_000) {
    return 12_000_000 + (annualSalary - 45_000_000) * 0.02;
  }
  return 14_750_000 + (annualSalary - 100_000_000) * 0.02;
}

/**
 * 기본세율(누진공제 방식)로 산출세액을 계산합니다.
 * 산출세액 = 과세표준 * rate - 누진공제, 0 미만이면 0.
 */
export function calculateIncomeTax(taxBase: number): number {
  let rate: number;
  let deduction: number;

  if (taxBase <= 14_000_000) {
    rate = 0.06;
    deduction = 0;
  } else if (taxBase <= 50_000_000) {
    rate = 0.15;
    deduction = 1_260_000;
  } else if (taxBase <= 88_000_000) {
    rate = 0.24;
    deduction = 5_760_000;
  } else if (taxBase <= 150_000_000) {
    rate = 0.35;
    deduction = 15_440_000;
  } else if (taxBase <= 300_000_000) {
    rate = 0.38;
    deduction = 19_940_000;
  } else if (taxBase <= 500_000_000) {
    rate = 0.4;
    deduction = 25_940_000;
  } else if (taxBase <= 1_000_000_000) {
    rate = 0.42;
    deduction = 35_940_000;
  } else {
    rate = 0.45;
    deduction = 65_940_000;
  }

  return Math.max(0, taxBase * rate - deduction);
}

/**
 * 근로소득세액공제 (단순화).
 * 참고: 실제 규칙은 총급여 구간에 따라 500,000 / 660,000 / 740,000의
 * 차등 한도를 두지만, 여기서는 660,000 단일 상한으로 단순화합니다.
 */
export function earnedIncomeTaxCredit(calculatedTax: number): number {
  let credit: number;
  if (calculatedTax <= 1_300_000) {
    credit = calculatedTax * 0.55;
  } else {
    credit = 715_000 + (calculatedTax - 1_300_000) * 0.3;
  }
  return Math.min(credit, 660_000);
}

export interface SalaryInput {
  /** 연봉 (세전, 원). */
  annualSalary: number;
  /** 월 비과세액 (원). 기본 200,000 (흔한 식대 비과세 예시). */
  monthlyNonTaxable?: number;
  /** 부양가족수 (본인 포함). 기본 1. */
  dependents?: number;
}

export interface SalaryResult {
  /** 월 과세소득. */
  monthlyTaxableIncome: number;
  // --- 월 기준 공제 항목 ---
  pension: number; // 국민연금
  healthIns: number; // 건강보험
  longTermCare: number; // 장기요양보험
  employmentIns: number; // 고용보험
  monthlyIncomeTax: number; // 월 소득세
  monthlyLocalTax: number; // 월 지방소득세
  socialInsuranceTotal: number; // 4대보험 월 합계
  monthlyDeductionTotal: number; // 월 공제총액
  // --- 실수령액 ---
  monthlyNet: number; // 월 실수령액
  annualNet: number; // 연 실수령액
  // --- 연간 세금(참고) ---
  annualIncomeTax: number; // 결정세액(연간 소득세)
  annualLocalTax: number; // 연간 지방소득세
}

/**
 * 연봉/비과세/부양가족수로 월·연 실수령액을 추정합니다.
 */
export function calculateSalary(input: SalaryInput): SalaryResult {
  const annualSalary = Math.max(0, input.annualSalary || 0);
  const monthlyNonTaxable = Math.max(0, input.monthlyNonTaxable ?? 200_000);
  const dependents = Math.max(1, input.dependents ?? 1);

  // 월 과세소득 = (연봉 / 12) - 월비과세액
  const monthlyGross = annualSalary / 12;
  const monthlyTaxableIncome = Math.max(0, monthlyGross - monthlyNonTaxable);

  // 4대보험 (월 기준)
  const pension =
    clamp(monthlyTaxableIncome, PENSION_MIN_BASE, PENSION_MAX_BASE) * PENSION_RATE;
  const healthIns = monthlyTaxableIncome * HEALTH_RATE;
  const longTermCare = healthIns * LONG_TERM_CARE_RATE;
  const employmentIns = monthlyTaxableIncome * EMPLOYMENT_RATE;
  const socialInsuranceTotal = pension + healthIns + longTermCare + employmentIns;

  // 근로소득세 (연간 기준, 간이 근사)
  const incomeDeduction = earnedIncomeDeduction(annualSalary);
  const earnedIncomeAmount = annualSalary - incomeDeduction; // 근로소득금액
  const personalDeduction = dependents * PERSONAL_DEDUCTION_PER_DEPENDENT; // 인적공제
  const taxBase = Math.max(0, earnedIncomeAmount - personalDeduction); // 과세표준(간이)
  const calculatedTax = calculateIncomeTax(taxBase); // 산출세액
  const credit = earnedIncomeTaxCredit(calculatedTax); // 근로소득세액공제
  const annualIncomeTax = Math.max(0, calculatedTax - credit); // 결정세액(연간 소득세)
  const annualLocalTax = annualIncomeTax * 0.1; // 지방소득세(연간)

  const monthlyIncomeTax = annualIncomeTax / 12;
  const monthlyLocalTax = annualLocalTax / 12;

  const monthlyDeductionTotal =
    socialInsuranceTotal + monthlyIncomeTax + monthlyLocalTax;
  const monthlyNet = monthlyGross - monthlyDeductionTotal;
  const annualNet = monthlyNet * 12;

  return {
    monthlyTaxableIncome,
    pension,
    healthIns,
    longTermCare,
    employmentIns,
    monthlyIncomeTax,
    monthlyLocalTax,
    socialInsuranceTotal,
    monthlyDeductionTotal,
    monthlyNet,
    annualNet,
    annualIncomeTax,
    annualLocalTax,
  };
}
