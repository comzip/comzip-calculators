/**
 * 실업급여(구직급여) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 수급 여부는 이직 사유(자발적 퇴사는
 * 원칙적으로 제외, 예외 사유 있음), 피보험단위기간(180일 이상) 등 추가
 * 요건을 충족해야 하며, 상한액·하한액은 매년 최저임금 등에 따라
 * 바뀝니다. 아래 값은 2026-07-21 기준입니다.
 *
 * 법령 근거: 고용보험법 제46조(구직급여일액), 제48조(소정급여일수),
 * 같은 법 별표 1
 *  - 구직급여일액 = 이직 전 평균임금 × 60%
 *  - 상한액 68,100원 / 하한액 66,048원 (2026.1.1. 이후 이직자, 매년 변경)
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "급여 > 실업급여(구직급여) 계산기". 값을 갱신하면 그 문서도 함께
 *    갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 구직급여일액 지급률. */
const BENEFIT_RATE = 0.6;
/** 구직급여일액 상한액(원, 2026년 기준). */
const DAILY_UPPER_LIMIT = 68_100;
/** 구직급여일액 하한액(원, 2026년 기준). */
const DAILY_LOWER_LIMIT = 66_048;

export type AgeGroup = '50세 미만' | '50세 이상 또는 장애인';
export type InsuredPeriod = '1년 미만' | '1~3년' | '3~5년' | '5~10년' | '10년 이상';

/** 소정급여일수표(고용보험법 별표 1). [연령구분][가입기간] = 일수. */
const BENEFIT_DAYS_TABLE: Record<AgeGroup, Record<InsuredPeriod, number>> = {
  '50세 미만': {
    '1년 미만': 120,
    '1~3년': 150,
    '3~5년': 180,
    '5~10년': 210,
    '10년 이상': 240,
  },
  '50세 이상 또는 장애인': {
    '1년 미만': 120,
    '1~3년': 180,
    '3~5년': 210,
    '5~10년': 240,
    '10년 이상': 270,
  },
};

export interface UnemploymentBenefitInput {
  /** 이직 전 3개월간 지급된 임금 총액(원). */
  threeMonthWage: number;
  /** 이직일(퇴사일, YYYY-MM-DD). 평균임금 산정 기간(3개월 역일수) 계산에 쓰입니다. */
  resignDate: string;
  ageGroup: AgeGroup;
  insuredPeriod: InsuredPeriod;
}

export interface UnemploymentBenefitResult {
  /** 평균임금 산정기간의 총일수(이직일 이전 3개월 역일수). */
  periodDays: number;
  /** 이직 전 평균임금(1일). */
  averageDailyWage: number;
  /** 구직급여일액(상하한 적용 전). */
  rawDailyBenefit: number;
  /** 구직급여일액(상하한 적용 후, 실제 지급액). */
  dailyBenefit: number;
  /** 소정급여일수. */
  benefitDays: number;
  /** 총 예상 수급액 = 구직급여일액 × 소정급여일수. */
  totalBenefit: number;
  /** 하한액이 적용됐는지 여부. */
  clampedToLower: boolean;
  /** 상한액이 적용됐는지 여부. */
  clampedToUpper: boolean;
}

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` 문자열을 로컬 자정 Date로 파싱합니다. */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 이직일 이전 3개월의 총일수(역일수)를 계산합니다. */
function threeMonthPeriodDays(resignDate: Date): number {
  const threeMonthsAgo = new Date(resignDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return Math.round((resignDate.getTime() - threeMonthsAgo.getTime()) / MS_PER_DAY);
}

/** 실업급여(구직급여) 예상 수급액을 계산합니다. */
export function calculateUnemploymentBenefit(
  input: UnemploymentBenefitInput,
): UnemploymentBenefitResult {
  const threeMonthWage = Math.max(0, input.threeMonthWage || 0);
  const periodDays = threeMonthPeriodDays(parseDate(input.resignDate));

  const averageDailyWage = threeMonthWage / periodDays;
  const rawDailyBenefit = averageDailyWage * BENEFIT_RATE;

  const dailyBenefit = Math.min(
    DAILY_UPPER_LIMIT,
    Math.max(DAILY_LOWER_LIMIT, rawDailyBenefit),
  );

  const benefitDays = BENEFIT_DAYS_TABLE[input.ageGroup][input.insuredPeriod];
  const totalBenefit = dailyBenefit * benefitDays;

  return {
    periodDays,
    averageDailyWage,
    rawDailyBenefit,
    dailyBenefit,
    benefitDays,
    totalBenefit,
    clampedToLower: rawDailyBenefit < DAILY_LOWER_LIMIT,
    clampedToUpper: rawDailyBenefit > DAILY_UPPER_LIMIT,
  };
}
