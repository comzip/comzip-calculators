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
    slug: 'loan-calculator',
    title: '대출이자 계산기',
    category: '부동산',
    description:
      '대출원금·연이자율·기간을 입력하면 원리금균등/원금균등/만기일시상환 방식별 월 상환액, 총 이자, 총 상환금액과 상환 스케줄을 계산합니다.',
  },
  {
    slug: 'property-tax-calculator',
    title: '보유세 계산기 (재산세·종합부동산세)',
    category: '부동산',
    description:
      '공시가격을 입력하면 재산세(주택·토지·건축물)와 종합부동산세를 함께 추정합니다. 공정시장가액비율·누진세율·지방교육세·도시지역분까지 반영한 간이 보유세 계산기입니다.',
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
