/**
 * 전세 vs 매매 종합 비교 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 매매·전세 각각의 비용을 단순화한 모델로
 * 비교하며, 실제 의사결정에는 개인의 세부 재무 상황(신용대출 가능 여부,
 * 실제 투자수익률, 지역별 집값·전세가 변동성 등)을 반영해야 합니다.
 * 이 계산기는 다음과 같이 단순화합니다.
 *
 *  - 매매: 자기자본을 매매가에 우선 투입하고, 부족분(매매가−자기자본,
 *    음수면 0)을 대출로 조달한다고 가정합니다. 자기자본이 매매가를
 *    초과하는 경우 남는 돈(잉여자금)은 전세의 여유자금과 동일하게
 *    투자수익률 가정으로 운용된다고 가정합니다.
 *  - 재산세·종합부동산세는 비교기간 내내 최초 공시가격 기준으로 동일하다고
 *    가정합니다(공시가격 상승분 미반영). 종합부동산세는 1세대1주택 공제금액
 *    (12억원)을 초과하는 공시가격에서만 발생하며, 재산세액공제(이중과세
 *    조정)까지 근사 반영합니다.
 *  - 기회비용은 두 시나리오에 동일한 원칙으로 대칭 반영합니다: 전세는
 *    보증금(집에 넣지 않고 은행 등에 예치했다면 벌 수 있었던 돈)을,
 *    매매는 자기자본(집에 넣지 않고 투자했다면 벌 수 있었던 돈)을 각각
 *    투자수익률 가정으로 "기회비용"으로 계산해 순비용에 더합니다. 매매는
 *    대신 집값 상승분을 "자본이득"으로 별도 반영합니다 — 매입가 전체
 *    (대출 포함)에 대해 상승하므로, 자기자본만 투입하고도 집값 전체의
 *    상승분을 얻는 레버리지 효과가 그대로 드러납니다.
 *    (이전 버전은 매매의 자기자본에는 기회비용을 매기지 않아, 투자수익률
 *    가정을 집값 상승률보다 높게 잡을수록 비합리적으로 매매가 유리하게
 *    나오는 오류가 있었습니다 — 2026-07-25 3인 교차검증으로 발견해 수정.)
 *  - 대출 이자는 실제 상환 스케줄(원리금균등)에서 비교기간에 해당하는
 *    회차의 이자 합계를 사용합니다(대출 잔액이 계속 줄어드는 것을 반영).
 *  - 전세보증금이 보유 현금보다 큰 경우(전세자금대출이 필요한 상황)는
 *    반영하지 않습니다 — 보증금 전액을 자기 돈으로 낸다고 가정합니다.
 * =================================================================
 *
 * 아래 계산은 이미 검증된 기존 계산기 모듈을 그대로 재사용합니다:
 *  - 취득세: acquisitionTaxCalculator.ts (지방세법)
 *  - 대출이자: loanCalculator.ts
 *  - 재산세: propertyTaxCalculator.ts (지방세법)
 *  - 전세 중개수수료: brokerageFeeCalculator.ts (공인중개사법 시행규칙)
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "부동산 > 전세 vs 매매 비교 계산기". 값을 갱신하면 그 문서도 함께
 *    갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

import { calculateAcquisitionTax } from './acquisitionTaxCalculator';
import { calculateLoan } from './loanCalculator';
import { calculatePropertyTax, calculateComprehensiveTax } from './propertyTaxCalculator';
import { calculateBrokerageFee } from './brokerageFeeCalculator';

export interface BuyVsJeonseInput {
  /** 매매가(원). */
  purchasePrice: number;
  /** 전세보증금(원). */
  jeonseDeposit: number;
  /** 보유 현금(자기자본, 원). */
  cashOnHand: number;
  /** 비교(예상 거주) 기간(년). */
  years: number;
  /** 대출 연이자율(%). */
  loanAnnualRatePercent: number;
  /** 대출 기간(년). */
  loanTermYears: number;
  /** 연간 주택가격 상승률 가정(%). */
  priceGrowthRatePercent: number;
  /** 여유자금·보증금 기회비용 계산에 쓰는 연 수익률 가정(%). */
  investReturnRatePercent: number;
  /** 전세 재계약(2년 주기) 시 보증금 인상률 가정(%). */
  jeonseRenewalIncreasePercent: number;
  /** 공시가격 ÷ 매매가 비율 가정(%, 재산세 계산용). */
  publicPriceRatioPercent: number;
  /** 전용면적 85㎡ 초과 여부(취득세의 농어촌특별세 부과 여부). */
  isOver85Sqm: boolean;
  /** 도시지역 내 소재 여부(재산세 도시지역분 부과 대상). */
  isUrbanArea: boolean;
}

export interface BuyScenarioResult {
  loanAmount: number;
  acquisitionTax: number;
  totalLoanInterest: number;
  annualPropertyTax: number;
  totalPropertyTax: number;
  /** 종합부동산세(연, 재산세액공제 반영 후 결정세액+농특세). 공제금액 이하면 0. */
  annualComprehensiveTax: number;
  totalComprehensiveTax: number;
  /** 매매가에 투입된 자기자본(= min(보유현금, 매매가)). */
  equityInHome: number;
  /** 자기자본을 투자수익률 가정으로 운용했다면 벌었을 기회비용. */
  equityOpportunityCost: number;
  /** 보유현금이 매매가를 초과할 때의 잉여자금(= max(0, 보유현금 − 매매가)). */
  surplusCash: number;
  /** 잉여자금을 투자수익률 가정으로 운용한 수익. */
  surplusInvestReturn: number;
  expectedFuturePrice: number;
  capitalGain: number;
  netCost: number;
}

export interface JeonseScenarioResult {
  brokerageFee: number;
  surplusCash: number;
  depositOpportunityCost: number;
  surplusInvestReturn: number;
  expectedFinalDeposit: number;
  netCost: number;
}

export interface BuyVsJeonseResult {
  buy: BuyScenarioResult;
  jeonse: JeonseScenarioResult;
  /** buy.netCost − jeonse.netCost. 양수면 매매가 더 비쌈(전세 유리), 음수면 매매가 유리. */
  costDifference: number;
}

/** 전세와 매매 중 N년 보유 시 어느 쪽의 순비용이 더 낮은지 비교합니다. */
export function calculateBuyVsJeonse(input: BuyVsJeonseInput): BuyVsJeonseResult {
  const purchasePrice = Math.max(0, input.purchasePrice || 0);
  const jeonseDeposit = Math.max(0, input.jeonseDeposit || 0);
  const cashOnHand = Math.max(0, input.cashOnHand || 0);
  const years = Math.max(0, input.years || 0);
  const months = Math.round(years * 12);

  // 두 시나리오 모두 "묶인 자금을 투자했다면 벌었을 돈"을 같은 수익률
  // 가정으로 계산하므로, 성장 배율을 한 번만 구해 공유한다.
  const growthFactor = Math.pow(1 + input.investReturnRatePercent / 100, years) - 1;

  // ---------------- 매매 시나리오 ----------------
  const loanAmount = Math.max(0, purchasePrice - cashOnHand);
  const equityInHome = Math.min(cashOnHand, purchasePrice);
  const equityOpportunityCost = equityInHome * growthFactor;
  const buySurplusCash = Math.max(0, cashOnHand - purchasePrice);
  const buySurplusInvestReturn = buySurplusCash * growthFactor;

  const acquisition = calculateAcquisitionTax({
    propertyType: '주택',
    price: purchasePrice,
    houseCount: '1주택',
    isRegulatedArea: false,
    isOver85Sqm: input.isOver85Sqm,
  });

  let totalLoanInterest = 0;
  if (loanAmount > 0) {
    const loanTermMonths = Math.max(1, Math.round(input.loanTermYears * 12));
    const loanResult = calculateLoan({
      principal: loanAmount,
      annualRatePercent: input.loanAnnualRatePercent,
      months: loanTermMonths,
      method: '원리금균등',
    });
    const monthsToCount = Math.min(months, loanTermMonths);
    totalLoanInterest = loanResult.schedule
      .slice(0, monthsToCount)
      .reduce((sum, row) => sum + row.interestPortion, 0);
  }

  const publicPrice = purchasePrice * (input.publicPriceRatioPercent / 100);
  const propertyTaxResult = calculatePropertyTax({
    assetType: '주택',
    baseValue: publicPrice,
    singleHouseholdSpecial: true,
    urbanArea: input.isUrbanArea,
  });
  const annualPropertyTax = propertyTaxResult.total;
  const totalPropertyTax = annualPropertyTax * years;

  // 공시가격이 1세대1주택 공제금액(12억원)을 넘으면 종합부동산세도 부과된다.
  // 재산세액공제(이중과세 조정)까지 근사 반영하기 위해 방금 계산한 재산세
  // 결과를 linkedPropertyTax로 넘긴다.
  const comprehensiveTaxResult = calculateComprehensiveTax({
    totalPublicPrice: publicPrice,
    houseCount: '1주택',
    linkedPropertyTax: {
      propertyTaxPaid: propertyTaxResult.propertyTax,
      fairMarketRatio: propertyTaxResult.fairMarketRatio,
      topMarginalRate: propertyTaxResult.topMarginalRate,
    },
  });
  const annualComprehensiveTax = comprehensiveTaxResult.totalWithSurtax;
  const totalComprehensiveTax = annualComprehensiveTax * years;

  const expectedFuturePrice =
    purchasePrice * Math.pow(1 + input.priceGrowthRatePercent / 100, years);
  const capitalGain = expectedFuturePrice - purchasePrice;

  const buyNetCost =
    acquisition.total +
    totalLoanInterest +
    totalPropertyTax +
    totalComprehensiveTax +
    equityOpportunityCost -
    capitalGain -
    buySurplusInvestReturn;

  // ---------------- 전세 시나리오 ----------------
  const brokerage = calculateBrokerageFee({ dealType: '임대차', amount: jeonseDeposit });
  const surplusCash = Math.max(0, cashOnHand - jeonseDeposit - brokerage.fee);

  const depositOpportunityCost = jeonseDeposit * growthFactor;
  const surplusInvestReturn = surplusCash * growthFactor;

  const renewalCycles = Math.floor(years / 2);
  const expectedFinalDeposit =
    jeonseDeposit * Math.pow(1 + input.jeonseRenewalIncreasePercent / 100, renewalCycles);

  const jeonseNetCost = brokerage.fee + depositOpportunityCost - surplusInvestReturn;

  return {
    buy: {
      loanAmount,
      acquisitionTax: acquisition.total,
      totalLoanInterest,
      annualPropertyTax,
      totalPropertyTax,
      annualComprehensiveTax,
      totalComprehensiveTax,
      equityInHome,
      equityOpportunityCost,
      surplusCash: buySurplusCash,
      surplusInvestReturn: buySurplusInvestReturn,
      expectedFuturePrice,
      capitalGain,
      netCost: buyNetCost,
    },
    jeonse: {
      brokerageFee: brokerage.fee,
      surplusCash,
      depositOpportunityCost,
      surplusInvestReturn,
      expectedFinalDeposit,
      netCost: jeonseNetCost,
    },
    costDifference: buyNetCost - jeonseNetCost,
  };
}
