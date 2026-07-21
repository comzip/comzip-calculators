/**
 * 부동산 중개보수(중개수수료) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 아래 요율표는 서울특별시 주택 중개보수 등에 관한 조례(2021.12.30.
 * 시행) 기준입니다. 시·도 조례에 따라 지역별로 요율이 다를 수 있으므로,
 * 다른 지역은 해당 시·도 조례를 확인해야 합니다. 표시되는 금액은
 * "상한요율" 기준 최대 금액이며, 실제 중개보수는 이 한도 내에서
 * 의뢰인과 개업공인중개사가 협의하여 정합니다. 부가가치세는 별도입니다.
 *
 * 법령 근거: 공인중개사법 제32조, 같은 법 시행규칙 제20조(중개보수 등),
 *  서울특별시 주택 중개보수 등에 관한 조례
 * =================================================================
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

export type DealType = '매매' | '임대차';

interface RateBracket {
  upTo: number;
  rate: number;
  /** 한도액(원). 없으면 undefined. */
  limit?: number;
}

/** 매매·교환 요율표(서울시 조례 기준). */
const SALE_BRACKETS: RateBracket[] = [
  { upTo: 50_000_000, rate: 0.006, limit: 250_000 },
  { upTo: 200_000_000, rate: 0.005, limit: 800_000 },
  { upTo: 900_000_000, rate: 0.004 },
  { upTo: 1_200_000_000, rate: 0.005 },
  { upTo: 1_500_000_000, rate: 0.006 },
  { upTo: Infinity, rate: 0.007 },
];

/** 임대차 등 요율표(서울시 조례 기준). */
const LEASE_BRACKETS: RateBracket[] = [
  { upTo: 50_000_000, rate: 0.005, limit: 200_000 },
  { upTo: 100_000_000, rate: 0.004, limit: 300_000 },
  { upTo: 600_000_000, rate: 0.003 },
  { upTo: 1_200_000_000, rate: 0.004 },
  { upTo: 1_500_000_000, rate: 0.005 },
  { upTo: Infinity, rate: 0.006 },
];

function findBracket(amount: number, brackets: RateBracket[]): RateBracket {
  return brackets.find((b) => amount <= b.upTo) ?? brackets[brackets.length - 1];
}

export interface BrokerageFeeInput {
  dealType: DealType;
  /** 거래금액(원). 월세인 경우 계산된 환산보증금을 넣습니다. */
  amount: number;
}

export interface BrokerageFeeResult {
  /** 적용된 상한요율(소수). */
  rate: number;
  /** 적용된 한도액(원). 없으면 undefined. */
  limit?: number;
  /** 중개보수 상한액(원) = min(거래금액×요율, 한도액). */
  fee: number;
}

/** 거래금액과 거래 종류로 중개보수 상한액을 계산합니다. */
export function calculateBrokerageFee(input: BrokerageFeeInput): BrokerageFeeResult {
  const amount = Math.max(0, input.amount || 0);
  const brackets = input.dealType === '매매' ? SALE_BRACKETS : LEASE_BRACKETS;
  const bracket = findBracket(amount, brackets);

  const rawFee = amount * bracket.rate;
  const fee = bracket.limit !== undefined ? Math.min(rawFee, bracket.limit) : rawFee;

  return { rate: bracket.rate, limit: bracket.limit, fee };
}

/**
 * 월세 계약의 거래금액(환산보증금)을 계산합니다.
 * 거래금액 = 보증금 + (월세 × 100). 단, 그 합산액이 5천만원 미만이면
 * 거래금액 = 보증금 + (월세 × 70).
 */
export function calculateMonthlyRentDealAmount(deposit: number, monthlyRent: number): number {
  const d = Math.max(0, deposit || 0);
  const m = Math.max(0, monthlyRent || 0);
  const primary = d + m * 100;
  return primary < 50_000_000 ? d + m * 70 : primary;
}
