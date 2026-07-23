// Single source of truth for the calculator hub.
//
// To add a new calculator:
//   1. Add one entry to the `calculators` array below (Korean + English copy).
//   2. Create a matching page at `src/pages/calculators/<slug>.astro` (Korean)
//      and `src/pages/en/calculators/<slug>.astro` (English).
// The home page and any navigation are generated from this array, so there is
// no separate hardcoded list to keep in sync.

export type CalculatorCategory = '급여' | '부동산' | '생활';

export interface Calculator {
  /** URL slug; the page lives at `src/pages/calculators/<slug>.astro`. */
  slug: string;
  /** Display title (Korean). */
  title: string;
  /** Display title (English). */
  titleEn: string;
  /** Grouping category shown on the home page. */
  category: CalculatorCategory;
  /** Short description used on cards and meta tags (Korean). */
  description: string;
  /** Short description used on cards and meta tags (English). */
  descriptionEn: string;
}

// The order categories appear in on the home page. Add new categories here as
// they are introduced so grouping stays deterministic.
export const categoryOrder: CalculatorCategory[] = ['급여', '부동산', '생활'];

/** Display label for each category, per locale. */
export const categoryLabels: Record<CalculatorCategory, { ko: string; en: string }> = {
  급여: { ko: '급여', en: 'Salary & Benefits' },
  부동산: { ko: '부동산', en: 'Real Estate' },
  생활: { ko: '생활', en: 'Everyday Life' },
};

export const calculators: Calculator[] = [
  {
    slug: 'age-calculator',
    title: '만나이 계산기',
    titleEn: 'Korean Age Calculator',
    category: '생활',
    description:
      '생년월일로 만나이, 연나이, 세는나이를 한 번에 계산합니다. 2023년부터 법적 기준이 된 만나이를 바로 확인하세요.',
    descriptionEn:
      'Enter a birth date to calculate Korean international age (man-nai), year age, and counting age all at once. Man-nai has been the legal standard age in Korea since 2023.',
  },
  {
    slug: 'salary-calculator',
    title: '연봉 실수령액 계산기',
    titleEn: 'Korea Salary Take-Home Pay Calculator',
    category: '급여',
    description:
      '연봉과 부양가족수를 입력하면 4대보험과 세금을 제외한 월 실수령액과 연 실수령액을 추정합니다.',
    descriptionEn:
      'Enter your annual salary and number of dependents to estimate your monthly and annual take-home pay after Korea’s 4 major social insurances and income tax.',
  },
  {
    slug: 'severance-calculator',
    title: '퇴직금 계산기',
    titleEn: 'Korea Severance Pay Calculator',
    category: '급여',
    description:
      '입사일·퇴사일과 최근 3개월 급여를 입력하면 평균임금과 예상 퇴직금을 추정합니다.',
    descriptionEn:
      'Enter your hire date, resignation date, and last 3 months of pay to estimate your average wage and expected severance pay under Korean law.',
  },
  {
    slug: 'weekly-holiday-pay-calculator',
    title: '주휴수당 계산기',
    titleEn: 'Korea Weekly Holiday Pay Calculator',
    category: '급여',
    description:
      '시급과 1주 소정근로시간을 입력하면 주휴수당을 계산합니다. 아르바이트·단시간근로자도 지급 조건과 금액을 바로 확인하세요.',
    descriptionEn:
      'Enter your hourly wage and weekly scheduled work hours to calculate Korea’s weekly paid holiday allowance (ju-hyu-su-dang) — including for part-time workers.',
  },
  {
    slug: 'unemployment-benefit-calculator',
    title: '실업급여(구직급여) 계산기',
    titleEn: 'Korea Unemployment Benefit Calculator',
    category: '급여',
    description:
      '이직일과 이직 전 3개월 급여, 나이·고용보험 가입기간을 입력하면 실업급여 예상 수급액과 소정급여일수를 계산합니다.',
    descriptionEn:
      'Enter your separation date, last 3 months of pay, age, and employment insurance enrollment period to estimate your Korean unemployment benefit (job-seeking benefit) amount and payment days.',
  },
  {
    slug: 'annual-leave-calculator',
    title: '연차수당·연차개수 계산기',
    titleEn: 'Korea Annual Leave Calculator',
    category: '급여',
    description:
      '입사일을 입력하면 현재까지 발생한 연차 개수를 계산합니다. 1일 통상임금을 입력하면 연차수당까지 바로 확인할 수 있습니다.',
    descriptionEn:
      'Enter your hire date to calculate accrued annual paid leave days under Korean labor law. Add your daily ordinary wage to also see your annual leave allowance.',
  },
  {
    slug: 'loan-calculator',
    title: '대출이자 계산기',
    titleEn: 'Loan Interest & Repayment Calculator',
    category: '부동산',
    description:
      '대출원금·연이자율·기간을 입력하면 원리금균등/원금균등/만기일시상환 방식별 월 상환액, 총 이자, 총 상환금액과 상환 스케줄을 계산합니다.',
    descriptionEn:
      'Enter loan principal, annual interest rate, and term to calculate monthly payments, total interest, total repayment, and a full amortization schedule for equal payment, equal principal, or bullet repayment methods.',
  },
  {
    slug: 'acquisition-tax-calculator',
    title: '취득세 계산기',
    titleEn: 'Korea Property Acquisition Tax Calculator',
    category: '부동산',
    description:
      '매매가를 입력하면 취득세·지방교육세·농어촌특별세를 함께 추정합니다. 주택(다주택자 중과세율 8%·12% 포함)과 오피스텔을 구분해서 계산합니다.',
    descriptionEn:
      'Enter a purchase price to estimate Korea’s acquisition tax, local education tax, and special rural development tax — for both houses (including the 8%/12% multi-home surtax rates) and officetels.',
  },
  {
    slug: 'brokerage-fee-calculator',
    title: '부동산 중개수수료 계산기',
    titleEn: 'Korea Real Estate Brokerage Fee Calculator',
    category: '부동산',
    description:
      '거래금액을 입력하면 매매·전세·월세별 부동산 중개보수(중개수수료) 상한액을 계산합니다. (서울특별시 조례 기준)',
    descriptionEn:
      'Enter a transaction amount to calculate the maximum real estate brokerage fee for sales, jeonse, and monthly-rent deals (based on the Seoul Metropolitan Government ordinance).',
  },
  {
    slug: 'jeonse-conversion-calculator',
    title: '전월세 전환율 계산기',
    titleEn: 'Korea Jeonse-to-Monthly-Rent Conversion Calculator',
    category: '부동산',
    description:
      '전세보증금을 월세로 전환할 때의 월세와 법정 상한 전환율(주택임대차보호법)을 함께 계산합니다.',
    descriptionEn:
      'Calculate the monthly rent when converting a jeonse deposit to monthly rent, along with the statutory maximum conversion rate under Korea’s Housing Lease Protection Act.',
  },
  {
    slug: 'property-tax-calculator',
    title: '보유세 계산기 (재산세·종합부동산세)',
    titleEn: 'Korea Property Holding Tax Calculator (Property Tax & Comprehensive Real Estate Tax)',
    category: '부동산',
    description:
      '공시가격을 입력하면 재산세(주택·토지·건축물)와 종합부동산세를 함께 추정합니다. 공정시장가액비율·누진세율·지방교육세·도시지역분까지 반영한 간이 보유세 계산기입니다.',
    descriptionEn:
      'Enter the officially assessed value to estimate property tax (housing, land, buildings) and comprehensive real estate tax together — accounting for the fair market value ratio, progressive rates, local education tax, and urban area tax.',
  },
  {
    slug: 'bmi-calculator',
    title: 'BMI 계산기',
    titleEn: 'BMI Calculator',
    category: '생활',
    description:
      '신장과 체중을 입력하면 체질량지수(BMI)와 대한비만학회 기준 비만도 분류, 표준체중을 계산합니다.',
    descriptionEn:
      'Enter your height and weight to calculate your BMI, obesity classification per Korean Society for the Study of Obesity criteria, and standard body weight.',
  },
  {
    slug: 'tdee-calculator',
    title: 'TDEE·칼로리 계산기',
    titleEn: 'TDEE & Calorie Calculator',
    category: '생활',
    description:
      '성별·나이·신장·체중·활동량을 입력하면 기초대사량(BMR)과 유지 칼로리(TDEE), 감량·증량 목표 칼로리를 계산합니다.',
    descriptionEn:
      'Enter your sex, age, height, weight, and activity level to calculate your basal metabolic rate (BMR), maintenance calories (TDEE), and target calories for weight loss or gain.',
  },
  {
    slug: 'dday-calculator',
    title: 'D-Day 계산기',
    titleEn: 'D-Day Countdown Calculator',
    category: '생활',
    description:
      '목표 날짜를 설정하면 오늘 기준으로 며칠 남았는지(D-100) 또는 며칠 지났는지(D+50)를 계산합니다. 수능·시험·결혼기념일 등 어떤 날짜든 카운트다운하세요.',
    descriptionEn:
      'Set a target date to see how many days remain (D-100) or have passed (D+50) from today. Count down to exams, anniversaries, or any date that matters to you.',
  },
];

/** Returns the calculators belonging to a given category. */
export function calculatorsByCategory(category: CalculatorCategory): Calculator[] {
  return calculators.filter((c) => c.category === category);
}
