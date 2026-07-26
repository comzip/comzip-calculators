/**
 * 전세 vs 매매 종합 비교 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 매매·전세 각각의 비용을 단순화한 모델로
 * 비교하며, 실제 의사결정에는 개인의 세부 재무 상황(신용대출 가능 여부,
 * 실제 투자수익률, 지역별 집값·전세가 변동성 등)을 반영해야 합니다.
 * 이 계산기는 다음과 같이 단순화합니다.
 *
 *  - 두 시나리오 모두 같은 보유현금(cashOnHand)에서 출발해서, 비교기간이
 *    끝난 시점에 그 돈이 "최종 자기자본(finalCapital)"으로 얼마가
 *    되었는지 직접 비교합니다(순비용·기회비용 같은 간접 지표가 아니라
 *    결과값 자체를 비교):
 *      매매 최종 자기자본 = 보유현금 + 집값 상승분 + 잉여자금 운용수익
 *                          − 취득세 − 중개수수료 − 대출이자 − 재산세 − 종부세
 *      전세 최종 자기자본 = 보유현금 + 여유자금 운용수익 − 중개수수료
 *                          − 보증금 증액 기회비용
 *    매매·전세 모두 중개수수료가 발생합니다(공인중개사법 시행규칙상
 *    매매는 '매매' 요율표, 전세는 '임대차' 요율표를 적용).
 *    전세보증금은 계약 종료 시 원금 그대로 돌려받으므로(이자가 붙지
 *    않음) 최종 자기자본 계산에서 그 자체는 늘지도 줄지도 않고, 보증금을
 *    뺀 나머지 여유자금만 투자수익률 가정으로 굴린 수익이 더해집니다.
 *    매매도 마찬가지로 자기자본 중 매매가를 넘는 잉여자금만 투자수익률로
 *    굴립니다.
 *  - 전세 재계약(2년 주기)마다 보증금이 오르면, 그 증액분은 여유자금
 *    투자 풀에서 인출해 충당한다고 봅니다(같은 보유현금에서만 조달한다는
 *    전제상 외부 소득을 가정할 근거가 없습니다). 인출된 돈은 무이자
 *    보증금에 묶여 더는 불어나지 않으므로, 인출 시점부터 비교기간
 *    종료까지 계속 투자됐다면 벌었을 수익을 "보증금 증액 기회비용"으로
 *    계산해 전세 최종 자기자본에서 차감합니다(매매의 대출 원금 상환과는
 *    다릅니다 — 원금 상환은 집값 상승분에 이미 반영된 자산(주택 지분)으로
 *    바뀌지만, 보증금 증액분은 아무것도 불리지 않는 곳에 묶이기 때문에
 *    그냥 제외하면 안 됩니다. 2026-07-26 사용자 지적으로 발견해 추가).
 *
 *    (이전 버전들은 "순비용"을 지표로 삼거나 자기자본·보증금에 각각
 *    별도로 기회비용을 매겼는데, 둘 다 "결국 내 돈이 얼마가 됐는가"를
 *    직접 보여주지 못해 오해를 낳았습니다 — 2026-07-26 재검토로 "최종
 *    자기자본" 직접 비교로 단순화했습니다. 두 방식은 수학적으로는 동일한
 *    비교(finalCapital = cashOnHand − netCost)이지만, 결과값 자체를
 *    보여주는 쪽이 더 명확합니다.)
 *  - 대출 원금 상환분은 비용으로도 이득으로도 계산하지 않습니다(대출
 *    이자만 비용으로 집계) — 원금 상환은 현금이 그대로 주택 지분으로
 *    바뀌는 것이라 순자산에 중립적이라고 가정하는, 이런 종류의 계산기의
 *    일반적인 단순화입니다. 정확히 하려면 원금 상환에 쓰인 현금이 어느
 *    소득에서 나왔는지까지 추적해야 하는데, 이는 이 계산기의 범위를
 *    벗어납니다.
 *  - 재산세·종합부동산세는 비교기간 내내 최초 공시가격 기준으로 동일하다고
 *    가정합니다(공시가격 상승분 미반영). 종합부동산세는 1세대1주택 공제금액
 *    (12억원)을 초과하는 공시가격에서만 발생하며, 재산세액공제(이중과세
 *    조정)까지 근사 반영합니다.
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
 *  - 중개수수료(매매·전세): brokerageFeeCalculator.ts (공인중개사법 시행규칙)
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
  /** 여유자금 운용 연 수익률 가정(%). */
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
  /** 시작 자기자본(= 입력한 보유현금). */
  startingCash: number;
  loanAmount: number;
  acquisitionTax: number;
  /** 취득세 본세(지방교육세·농특세 제외). */
  acquisitionTaxBase: number;
  /** 취득세분 지방교육세. */
  acquisitionLocalEduTax: number;
  /** 취득세분 농어촌특별세. */
  acquisitionRuralTax: number;
  brokerageFee: number;
  /** 매매 중개보수 상한요율(소수, 예: 0.004 = 0.4%). */
  brokerageRatePercent: number;
  /** 매매 중개보수 한도액(원). 해당 구간에 한도가 없으면 undefined. */
  brokerageLimit?: number;
  totalLoanInterest: number;
  /** 대출 이자 계산에 반영한 개월 수(비교기간과 대출기간 중 짧은 쪽). */
  interestMonthsCounted: number;
  annualPropertyTax: number;
  /** 재산세 본세(연). */
  annualPropertyTaxBase: number;
  /** 재산세분 지방교육세(연). */
  annualPropertyLocalEduTax: number;
  /** 재산세 도시지역분(연). */
  annualPropertyUrbanAreaTax: number;
  totalPropertyTax: number;
  /** 종합부동산세(연, 재산세액공제 반영 후 결정세액+농특세). 공제금액 이하면 0. */
  annualComprehensiveTax: number;
  /** 종합부동산세 산출세액(연, 재산세액공제 반영 전). */
  annualComprehensiveCalculatedTax: number;
  /** 종합부동산세 재산세액공제(연, 이중과세 조정). */
  annualComprehensivePropertyCredit: number;
  totalComprehensiveTax: number;
  /** 보유현금이 매매가를 초과할 때의 잉여자금(= max(0, 보유현금 − 매매가)). */
  surplusCash: number;
  /** 잉여자금을 투자수익률 가정으로 운용한 수익. */
  surplusInvestReturn: number;
  expectedFuturePrice: number;
  capitalGain: number;
  /** 비교기간 종료 시점의 최종 자기자본 = 시작 자기자본 + 자본이득 + 잉여자금 운용수익 − 취득세 − 중개수수료 − 대출이자 − 재산세 − 종부세. */
  finalCapital: number;
}

export interface JeonseScenarioResult {
  /** 시작 자기자본(= 입력한 보유현금). */
  startingCash: number;
  brokerageFee: number;
  /** 전세 중개보수 상한요율(소수, 예: 0.004 = 0.4%). */
  brokerageRatePercent: number;
  /** 전세 중개보수 한도액(원). 해당 구간에 한도가 없으면 undefined. */
  brokerageLimit?: number;
  /** 보유현금 중 보증금·중개수수료를 뺀 여유자금. */
  surplusCash: number;
  /** 여유자금을 투자수익률 가정으로 운용한 수익. */
  surplusInvestReturn: number;
  expectedFinalDeposit: number;
  /** 비교기간 중 재계약(2년 주기) 횟수. */
  renewalCycles: number;
  /**
   * 재계약마다 오른 보증금(증액분)을 여유자금 투자 풀에서 인출해 충당한다고
   * 볼 때, 그 인출된 돈이 남은 기간 동안 투자됐다면 벌었을 수익(기회비용).
   * 증액분은 무이자로 보증금에 묶여 있다가 원금 그대로 돌아오므로, 그
   * 기간만큼의 투자수익을 놓친 셈이다.
   */
  depositTopUpOpportunityCost: number;
  /** depositTopUpOpportunityCost의 재계약 회차별 내역(표시용). */
  depositTopUps: Array<{ topUp: number; yearsRemaining: number }>;
  /** 비교기간 종료 시점의 최종 자기자본 = 시작 자기자본 + 여유자금 운용수익 − 중개수수료 − 보증금 증액 기회비용. */
  finalCapital: number;
}

export interface BuyVsJeonseResult {
  buy: BuyScenarioResult;
  jeonse: JeonseScenarioResult;
  /** buy.finalCapital − jeonse.finalCapital. 양수면 매매 쪽 최종 자기자본이 더 큼(매매 유리), 음수면 전세 유리. */
  capitalDifference: number;
}

/** 전세와 매매 중 N년 보유 시 어느 쪽의 최종 자기자본이 더 큰지 비교합니다. */
export function calculateBuyVsJeonse(input: BuyVsJeonseInput): BuyVsJeonseResult {
  const purchasePrice = Math.max(0, input.purchasePrice || 0);
  const jeonseDeposit = Math.max(0, input.jeonseDeposit || 0);
  const cashOnHand = Math.max(0, input.cashOnHand || 0);
  const years = Math.max(0, input.years || 0);
  const months = Math.round(years * 12);

  // 양쪽 시나리오의 여유자금이 같은 수익률 가정으로 굴러간다고 본다.
  const growthFactor = Math.pow(1 + input.investReturnRatePercent / 100, years) - 1;

  // ---------------- 매매 시나리오 ----------------
  const loanAmount = Math.max(0, purchasePrice - cashOnHand);
  const buySurplusCash = Math.max(0, cashOnHand - purchasePrice);
  const buySurplusInvestReturn = buySurplusCash * growthFactor;

  const acquisition = calculateAcquisitionTax({
    propertyType: '주택',
    price: purchasePrice,
    houseCount: '1주택',
    isRegulatedArea: false,
    isOver85Sqm: input.isOver85Sqm,
  });
  const buyBrokerage = calculateBrokerageFee({ dealType: '매매', amount: purchasePrice });

  let totalLoanInterest = 0;
  let interestMonthsCounted = 0;
  if (loanAmount > 0) {
    const loanTermMonths = Math.max(1, Math.round(input.loanTermYears * 12));
    const loanResult = calculateLoan({
      principal: loanAmount,
      annualRatePercent: input.loanAnnualRatePercent,
      months: loanTermMonths,
      method: '원리금균등',
    });
    interestMonthsCounted = Math.min(months, loanTermMonths);
    totalLoanInterest = loanResult.schedule
      .slice(0, interestMonthsCounted)
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

  const buyFinalCapital =
    cashOnHand +
    capitalGain +
    buySurplusInvestReturn -
    acquisition.total -
    buyBrokerage.fee -
    totalLoanInterest -
    totalPropertyTax -
    totalComprehensiveTax;

  // ---------------- 전세 시나리오 ----------------
  const brokerage = calculateBrokerageFee({ dealType: '임대차', amount: jeonseDeposit });
  const surplusCash = Math.max(0, cashOnHand - jeonseDeposit - brokerage.fee);
  const surplusInvestReturn = surplusCash * growthFactor;

  const renewalCycles = Math.floor(years / 2);
  const renewalRate = input.jeonseRenewalIncreasePercent / 100;

  // 재계약마다 오른 보증금은 여유자금 투자 풀에서 인출해 충당한다고 본다
  // (같은 보유현금에서만 조달한다는 이 계산기의 전제상, 외부 소득으로
  // 충당한다고 가정할 근거가 없다 — 매매의 대출 원금 상환과 달리, 이
  // 인출된 돈은 무이자 보증금에 묶여 더 이상 불어나지 않는다). 각 인출분이
  // 인출 시점부터 비교기간 종료까지 계속 투자됐다면 벌었을 수익을
  // 기회비용으로 계산해 최종 자기자본에서 차감한다.
  let depositTopUpOpportunityCost = 0;
  let previousDeposit = jeonseDeposit;
  const depositTopUps: Array<{ topUp: number; yearsRemaining: number }> = [];
  for (let cycle = 1; cycle <= renewalCycles; cycle++) {
    const depositAtCycle = jeonseDeposit * Math.pow(1 + renewalRate, cycle);
    const topUp = depositAtCycle - previousDeposit;
    const yearsRemaining = years - cycle * 2;
    depositTopUpOpportunityCost +=
      topUp * (Math.pow(1 + input.investReturnRatePercent / 100, yearsRemaining) - 1);
    depositTopUps.push({ topUp, yearsRemaining });
    previousDeposit = depositAtCycle;
  }

  const expectedFinalDeposit = previousDeposit;

  const jeonseFinalCapital =
    cashOnHand + surplusInvestReturn - brokerage.fee - depositTopUpOpportunityCost;

  return {
    buy: {
      startingCash: cashOnHand,
      loanAmount,
      acquisitionTax: acquisition.total,
      acquisitionTaxBase: acquisition.acquisitionTax,
      acquisitionLocalEduTax: acquisition.localEducationTax,
      acquisitionRuralTax: acquisition.ruralSpecialTax,
      brokerageFee: buyBrokerage.fee,
      brokerageRatePercent: buyBrokerage.rate,
      brokerageLimit: buyBrokerage.limit,
      totalLoanInterest,
      interestMonthsCounted,
      annualPropertyTax,
      annualPropertyTaxBase: propertyTaxResult.propertyTax,
      annualPropertyLocalEduTax: propertyTaxResult.localEducationTax,
      annualPropertyUrbanAreaTax: propertyTaxResult.urbanAreaTax,
      totalPropertyTax,
      annualComprehensiveTax,
      annualComprehensiveCalculatedTax: comprehensiveTaxResult.calculatedTax,
      annualComprehensivePropertyCredit: comprehensiveTaxResult.propertyTaxCredit,
      totalComprehensiveTax,
      surplusCash: buySurplusCash,
      surplusInvestReturn: buySurplusInvestReturn,
      expectedFuturePrice,
      capitalGain,
      finalCapital: buyFinalCapital,
    },
    jeonse: {
      startingCash: cashOnHand,
      brokerageFee: brokerage.fee,
      brokerageRatePercent: brokerage.rate,
      brokerageLimit: brokerage.limit,
      surplusCash,
      surplusInvestReturn,
      expectedFinalDeposit,
      renewalCycles,
      depositTopUpOpportunityCost,
      depositTopUps,
      finalCapital: jeonseFinalCapital,
    },
    capitalDifference: buyFinalCapital - jeonseFinalCapital,
  };
}
