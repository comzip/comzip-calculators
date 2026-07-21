/**
 * 기초대사량(BMR)·활동대사량(TDEE) 계산 모듈.
 *
 * Mifflin-St Jeor 공식을 사용합니다. 체지방률을 반영하지 않는 대신
 * 입력이 간단하고, 여러 검증 연구에서 다른 공식(Harris-Benedict 등)보다
 * 정확도가 높다고 평가받아 널리 쓰입니다.
 *
 * BMR(남) = 10×체중(kg) + 6.25×신장(cm) − 5×나이 + 5
 * BMR(여) = 10×체중(kg) + 6.25×신장(cm) − 5×나이 − 161
 * TDEE = BMR × 활동계수
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export type Sex = '남성' | '여성';

export type ActivityLevel =
  | '거의 안함'
  | '가벼운 활동'
  | '보통 활동'
  | '활발한 활동'
  | '매우 활발함';

/** 활동수준별 활동계수. */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  '거의 안함': 1.2, // 좌식 생활, 운동 거의 안 함
  '가벼운 활동': 1.375, // 주 1~3회 가벼운 운동
  '보통 활동': 1.55, // 주 3~5회 보통 강도 운동
  '활발한 활동': 1.725, // 주 6~7회 활발한 운동
  '매우 활발함': 1.9, // 매일 고강도 운동 또는 육체노동
};

export interface TdeeInput {
  sex: Sex;
  /** 나이(만 나이, 세). */
  age: number;
  /** 신장(cm). */
  heightCm: number;
  /** 체중(kg). */
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface TdeeResult {
  /** 기초대사량(kcal/일). */
  bmr: number;
  /** 활동대사량, 즉 유지 칼로리(kcal/일). */
  tdee: number;
  /** 감량 목표(kcal/일) = TDEE − 500. */
  cuttingCalories: number;
  /** 증량 목표(kcal/일) = TDEE + 500. */
  bulkingCalories: number;
}

/** BMR·TDEE와 감량/증량 목표 칼로리를 계산합니다. */
export function calculateTdee(input: TdeeInput): TdeeResult {
  const age = Math.max(0, input.age || 0);
  const heightCm = Math.max(0, input.heightCm || 0);
  const weightKg = Math.max(0, input.weightKg || 0);

  const sexOffset = input.sex === '남성' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;

  const tdee = bmr * ACTIVITY_FACTORS[input.activityLevel];

  return {
    bmr,
    tdee,
    cuttingCalories: Math.max(0, tdee - 500),
    bulkingCalories: tdee + 500,
  };
}
