/**
 * 체질량지수(BMI) 계산 모듈.
 *
 * BMI = 체중(kg) / 신장(m)^2
 *
 * 비만도 분류는 대한비만학회(2018 비만진료지침) 기준을 사용합니다. 이는
 * 아시아인 체형을 고려한 기준으로, WHO 국제 기준(25 이상부터 과체중,
 * 30 이상부터 비만)과는 구간이 다릅니다.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export type BmiCategory =
  | '저체중'
  | '정상'
  | '비만전단계'
  | '1단계 비만'
  | '2단계 비만'
  | '3단계 비만';

export interface BmiInput {
  /** 신장 (cm). */
  heightCm: number;
  /** 체중 (kg). */
  weightKg: number;
}

export interface BmiResult {
  /** 체질량지수. */
  bmi: number;
  /** 대한비만학회 기준 비만도 분류. */
  category: BmiCategory;
  /** 표준체중(kg) = 22 × 신장(m)^2. */
  standardWeightKg: number;
  /** 현재 체중 - 표준체중(kg). 양수면 표준체중보다 많이 나가는 것. */
  weightDiffKg: number;
}

/** 대한비만학회 기준(2018 비만진료지침)으로 BMI 값을 분류합니다. */
function classify(bmi: number): BmiCategory {
  if (bmi < 18.5) return '저체중';
  if (bmi < 23) return '정상';
  if (bmi < 25) return '비만전단계';
  if (bmi < 30) return '1단계 비만';
  if (bmi < 35) return '2단계 비만';
  return '3단계 비만';
}

/** 신장·체중으로 BMI, 비만도 분류, 표준체중을 계산합니다. */
export function calculateBmi(input: BmiInput): BmiResult {
  const heightCm = Math.max(0, input.heightCm || 0);
  const weightKg = Math.max(0, input.weightKg || 0);
  const heightM = heightCm / 100;

  const bmi = heightM > 0 ? weightKg / (heightM * heightM) : 0;
  const standardWeightKg = 22 * heightM * heightM;

  return {
    bmi,
    category: classify(bmi),
    standardWeightKg,
    weightDiffKg: weightKg - standardWeightKg,
  };
}
