// Single source of truth for the calculator hub.
//
// To add a new calculator:
//   1. Add one entry to the `calculators` array below.
//   2. Create a matching page at `src/pages/calculators/<slug>.astro`.
// The home page and any navigation are generated from this array, so there is
// no separate hardcoded list to keep in sync.

export type CalculatorCategory = '급여' | '부동산' | '생활';

export interface Calculator {
  /** URL slug; the page lives at `src/pages/calculators/<slug>.astro`. */
  slug: string;
  /** Display title (Korean). */
  title: string;
  /** Grouping category shown on the home page. */
  category: CalculatorCategory;
  /** Short description used on cards and meta tags. */
  description: string;
}

// The order categories appear in on the home page. Add new categories here as
// they are introduced so grouping stays deterministic.
export const categoryOrder: CalculatorCategory[] = ['급여', '부동산', '생활'];

export const calculators: Calculator[] = [
  {
    slug: 'age-calculator',
    title: '만나이 계산기',
    category: '생활',
    description:
      '생년월일로 만나이, 연나이, 세는나이를 한 번에 계산합니다. 2023년부터 법적 기준이 된 만나이를 바로 확인하세요.',
  },
  {
    slug: 'salary-calculator',
    title: '연봉 실수령액 계산기',
    category: '급여',
    description:
      '연봉과 부양가족수를 입력하면 4대보험과 세금을 제외한 월 실수령액과 연 실수령액을 추정합니다.',
  },
  {
    slug: 'severance-calculator',
    title: '퇴직금 계산기',
    category: '급여',
    description:
      '입사일·퇴사일과 최근 3개월 급여를 입력하면 평균임금과 예상 퇴직금을 추정합니다.',
  },
  {
    slug: 'weekly-holiday-pay-calculator',
    title: '주휴수당 계산기',
    category: '급여',
    description:
      '시급과 1주 소정근로시간을 입력하면 주휴수당을 계산합니다. 아르바이트·단시간근로자도 지급 조건과 금액을 바로 확인하세요.',
  },
  {
    slug: 'unemployment-benefit-calculator',
    title: '실업급여(구직급여) 계산기',
    category: '급여',
    description:
      '이직일과 이직 전 3개월 급여, 나이·고용보험 가입기간을 입력하면 실업급여 예상 수급액과 소정급여일수를 계산합니다.',
  },
  {
    slug: 'annual-leave-calculator',
    title: '연차수당·연차개수 계산기',
    category: '급여',
    description:
      '입사일을 입력하면 현재까지 발생한 연차 개수를 계산합니다. 1일 통상임금을 입력하면 연차수당까지 바로 확인할 수 있습니다.',
  },
  {
    slug: 'loan-calculator',
    title: '대출이자 계산기',
    category: '부동산',
    description:
      '대출원금·연이자율·기간을 입력하면 원리금균등/원금균등/만기일시상환 방식별 월 상환액, 총 이자, 총 상환금액과 상환 스케줄을 계산합니다.',
  },
  {
    slug: 'acquisition-tax-calculator',
    title: '취득세 계산기',
    category: '부동산',
    description:
      '매매가를 입력하면 취득세·지방교육세·농어촌특별세를 함께 추정합니다. 주택(다주택자 중과세율 8%·12% 포함)과 오피스텔을 구분해서 계산합니다.',
  },
  {
    slug: 'brokerage-fee-calculator',
    title: '부동산 중개수수료 계산기',
    category: '부동산',
    description:
      '거래금액을 입력하면 매매·전세·월세별 부동산 중개보수(중개수수료) 상한액을 계산합니다. (서울특별시 조례 기준)',
  },
  {
    slug: 'jeonse-conversion-calculator',
    title: '전월세 전환율 계산기',
    category: '부동산',
    description:
      '전세보증금을 월세로 전환할 때의 월세와 법정 상한 전환율(주택임대차보호법)을 함께 계산합니다.',
  },
  {
    slug: 'property-tax-calculator',
    title: '보유세 계산기 (재산세·종합부동산세)',
    category: '부동산',
    description:
      '공시가격을 입력하면 재산세(주택·토지·건축물)와 종합부동산세를 함께 추정합니다. 공정시장가액비율·누진세율·지방교육세·도시지역분까지 반영한 간이 보유세 계산기입니다.',
  },
  {
    slug: 'bmi-calculator',
    title: 'BMI 계산기',
    category: '생활',
    description:
      '신장과 체중을 입력하면 체질량지수(BMI)와 대한비만학회 기준 비만도 분류, 표준체중을 계산합니다.',
  },
  {
    slug: 'tdee-calculator',
    title: 'TDEE·칼로리 계산기',
    category: '생활',
    description:
      '성별·나이·신장·체중·활동량을 입력하면 기초대사량(BMR)과 유지 칼로리(TDEE), 감량·증량 목표 칼로리를 계산합니다.',
  },
  {
    slug: 'dday-calculator',
    title: 'D-Day 계산기',
    category: '생활',
    description:
      '목표 날짜를 설정하면 오늘 기준으로 며칠 남았는지(D-100) 또는 며칠 지났는지(D+50)를 계산합니다. 수능·시험·결혼기념일 등 어떤 날짜든 카운트다운하세요.',
  },
];

/** Returns the calculators belonging to a given category. */
export function calculatorsByCategory(category: CalculatorCategory): Calculator[] {
  return calculators.filter((c) => c.category === category);
}
