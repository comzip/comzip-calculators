/**
 * 주식 물타기(평단가 낮추기) 계산 모듈.
 *
 * ============================== 주의 ==============================
 * 이 계산은 "간이 추정"입니다. 실제 투자 결정에는 종목별 유동성, 향후
 * 실적·업황 전망, 세금 신고 시 실제 적용되는 매매 시점별 세율 등을
 * 종합적으로 고려해야 합니다. 이 계산기는 가중평균 단가 산술과, 매도 시
 * 부담하는 거래비용(증권거래세·수수료)을 반영한 손익분기가만 다룹니다.
 *
 *  - 국내주식(원화)은 매도 시 증권거래세(코스피 0.05%+농어촌특별세
 *    0.15%=0.20%, 코스닥 0.20%, 2026-01-01 시행 세율 기준)가 자동
 *    반영됩니다. 해외주식(달러)은 한국 측 매도세가 없어 0%로 둡니다 —
 *    다만 해외주식은 종목별이 아니라 한 해 전체 매매손익을 합산해 매기는
 *    양도소득세(연 250만원 공제 초과분 22~27.5%)가 별도로 있으며, 이는
 *    종목 하나를 다루는 이 계산기의 범위를 벗어나 반영하지 않습니다.
 *  - 증권사 수수료율은 법정 요율이 아니라 증권사마다 다른 상거래
 *    요율이므로 사용자 입력값(기본값 0.015%)을 그대로 씁니다.
 *  - "손익분기가"는 평단가를 매수·매도 거래비용(수수료 2회 + 매도세)까지
 *    감안해 실제로 팔았을 때 본전이 되는 가격으로 역산한 값입니다:
 *    손익분기가 = 평단가 ÷ (1 − 수수료율×2 − 증권거래세율).
 *  - "목표 평단가" 역산 모드는 추가 매수만으로 목표 평단가에 도달하는
 *    데 필요한 주식수를 계산합니다. 목표 평단가는 산술적으로 현재가와
 *    기존 평단가 "사이"에만 있을 수 있습니다 — 아무리 많이 사도 평단가가
 *    현재가를 넘어 반대편으로 갈 수는 없습니다(가중평균의 성질).
 *  - 시뮬레이션은 매 회차 동일한 주식수를 추가 매수한다고 가정합니다.
 * =================================================================
 *
 * 📋 법령 현황 추적: 프로젝트 루트 LEGAL_REFERENCES.md →
 *    "주식 물타기 계산기". 값을 갱신하면 그 문서도 함께 갱신하세요.
 *
 * 순수 함수로 작성되어 단위 테스트가 가능하며, 계산기 페이지의
 * 클라이언트 스크립트에서 import 하여 사용합니다.
 */

/** 국내(원화) 증권거래세율(코스피·코스닥 공통, 농어촌특별세 포함, 2026-01-01 시행). */
export const KRW_SECURITIES_TAX_RATE_PERCENT = 0.2;

export type StockCurrency = 'KRW' | 'USD';
export type StockAveragingMode = '추가매수' | '목표평단가';

export interface StockAveragingInput {
  /** 원화(국내주식) 또는 달러(해외주식). 국내주식만 매도 시 증권거래세가 붙습니다. */
  currency: StockCurrency;
  /** 기존 보유 주식수. */
  existingShares: number;
  /** 기존 평균 매입단가. */
  existingAvgPrice: number;
  /** 현재가(추가 매수 가정 가격). */
  currentPrice: number;
  mode: StockAveragingMode;
  /** [mode='추가매수'] 추가로 매수할 주식수. */
  additionalShares?: number;
  /** [mode='목표평단가'] 도달하고 싶은 평균 매입단가. */
  targetAvgPrice?: number;
  /** 증권사 매매수수료율(%, 매수·매도 동일하다고 가정). */
  commissionRatePercent: number;
}

export interface StockAveragingSimulationRow {
  /** 현재가 대비 추가 하락률(%). 0이면 현재가에서의 매수. */
  dropPercent: number;
  /** 이 회차의 매수 가격. */
  priceAtDrop: number;
  /** 이 회차까지 누적 보유 주식수. */
  cumulativeShares: number;
  /** 이 회차까지 누적 평균 매입단가. */
  cumulativeAvgPrice: number;
  /** 이 회차까지 누적 투자금액. */
  cumulativeInvested: number;
  /** 이 회차 기준 손익분기 도달에 필요한, "이 회차 매수가" 대비 수익률(%). */
  breakevenReturnPercent: number;
}

export interface StockAveragingResult {
  /** [mode='목표평단가']에서 목표가가 산술적으로 도달 가능한 범위 안에 있는지. */
  targetFeasible: boolean;
  /** 실제 반영된 추가 매수 주식수(목표평단가 모드는 올림 계산된 값). */
  additionalShares: number;
  /** 추가 매수에 드는 금액. */
  additionalCost: number;
  /** 기존 보유분 총 투자금액(= 기존 주식수 × 기존 평단가). */
  existingInvested: number;
  /** 추가 매수 후 총 보유 주식수. */
  newShares: number;
  /** 추가 매수 후 총 투자금액. */
  totalInvested: number;
  /** 추가 매수 후 새 평균 매입단가. */
  newAvgPrice: number;
  /** 적용된 증권거래세율(%, 원화는 0.2, 달러는 0). */
  securitiesTaxRatePercent: number;
  /** 물타기 전(기존 평단가 기준) 손익분기가(거래비용 반영). */
  breakevenPriceBefore: number;
  /** 물타기 후(새 평단가 기준) 손익분기가(거래비용 반영). */
  breakevenPriceAfter: number;
  /** 물타기 전 손익분기가에 도달하는 데 필요한, 현재가 대비 수익률(%). */
  breakevenReturnBeforePercent: number;
  /** 물타기 후 손익분기가에 도달하는 데 필요한, 현재가 대비 수익률(%). */
  breakevenReturnAfterPercent: number;
  /**
   * 거래비용을 빼고, 기존 평단가만 놓고 봤을 때 현재가 기준 순수 손익률(%).
   * 음수면 손실 중. "필요수익률"과 다른 지표다 — 이건 지금 얼마나
   * 손실/수익 중인지를 보여주고, 필요수익률은 손실을 만회하는 데(거래비용
   * 포함) 얼마나 더 올라야 하는지를 보여준다. 등락률의 비대칭성 때문에
   * 두 값은 절대값이 같지 않다(예: 20% 하락은 25% 상승해야 만회된다).
   */
  lossRateBeforePercent: number;
  /** 추가 매수 후 새 평단가 기준의 같은 순수 손익률(%). */
  lossRateAfterPercent: number;
  /** 추가 하락 시나리오별 누적 시뮬레이션. */
  simulation: StockAveragingSimulationRow[];
}

/** 거래비용(수수료 왕복 + 매도세)까지 감안한 손익분기가. */
function calculateBreakevenPrice(
  avgPrice: number,
  commissionRatePercent: number,
  securitiesTaxRatePercent: number,
): number {
  const roundTripCostRatio = (commissionRatePercent * 2 + securitiesTaxRatePercent) / 100;
  if (roundTripCostRatio >= 1) return Infinity;
  return avgPrice / (1 - roundTripCostRatio);
}

const SIMULATION_DROP_PERCENTS = [0, 10, 20, 30, 40, 50];

/** 물타기(또는 목표 평단가 도달)에 필요한 추가 매수와 그 결과를 계산합니다. */
export function calculateStockAveraging(input: StockAveragingInput): StockAveragingResult {
  const existingShares = Math.max(0, input.existingShares || 0);
  const existingAvgPrice = Math.max(0, input.existingAvgPrice || 0);
  const currentPrice = Math.max(0, input.currentPrice || 0);
  const commissionRatePercent = Math.max(0, input.commissionRatePercent || 0);
  const securitiesTaxRatePercent =
    input.currency === 'KRW' ? KRW_SECURITIES_TAX_RATE_PERCENT : 0;

  const existingInvested = existingShares * existingAvgPrice;

  let additionalShares = 0;
  let targetFeasible = true;

  if (input.mode === '목표평단가') {
    const targetAvgPrice = Math.max(0, input.targetAvgPrice || 0);
    // 목표 평단가는 산술적으로 현재가와 기존 평단가 "사이"에만 있을 수 있다
    // (가중평균은 두 입력값의 볼록결합이므로 그 구간을 벗어날 수 없다).
    const inDownwardRange =
      existingAvgPrice > currentPrice &&
      targetAvgPrice > currentPrice &&
      targetAvgPrice < existingAvgPrice;
    const inUpwardRange =
      existingAvgPrice < currentPrice &&
      targetAvgPrice < currentPrice &&
      targetAvgPrice > existingAvgPrice;

    if (existingShares <= 0 || !(inDownwardRange || inUpwardRange)) {
      targetFeasible = false;
    } else {
      const exact =
        (existingShares * (existingAvgPrice - targetAvgPrice)) / (targetAvgPrice - currentPrice);
      additionalShares = Math.ceil(exact);
    }
  } else {
    additionalShares = Math.max(0, Math.floor(input.additionalShares || 0));
  }

  const additionalCost = additionalShares * currentPrice;
  const newShares = existingShares + additionalShares;
  const totalInvested = existingInvested + additionalCost;
  const newAvgPrice = newShares > 0 ? totalInvested / newShares : 0;

  const breakevenPriceBefore = calculateBreakevenPrice(
    existingAvgPrice,
    commissionRatePercent,
    securitiesTaxRatePercent,
  );
  const breakevenPriceAfter = calculateBreakevenPrice(
    newAvgPrice,
    commissionRatePercent,
    securitiesTaxRatePercent,
  );
  const breakevenReturn = (breakevenPrice: number) =>
    currentPrice > 0 ? ((breakevenPrice - currentPrice) / currentPrice) * 100 : 0;
  const lossRate = (avgPrice: number) =>
    avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

  // ---------------- 시뮬레이션: 계속 같은 수량을 추가 매수한다면 ----------------
  const simulation: StockAveragingSimulationRow[] = [];
  let cumulativeShares = existingShares;
  let cumulativeInvested = existingInvested;
  for (const dropPercent of SIMULATION_DROP_PERCENTS) {
    const priceAtDrop = currentPrice * (1 - dropPercent / 100);
    cumulativeShares += additionalShares;
    cumulativeInvested += additionalShares * priceAtDrop;
    const cumulativeAvgPrice = cumulativeShares > 0 ? cumulativeInvested / cumulativeShares : 0;
    const breakevenAtDrop = calculateBreakevenPrice(
      cumulativeAvgPrice,
      commissionRatePercent,
      securitiesTaxRatePercent,
    );
    simulation.push({
      dropPercent,
      priceAtDrop,
      cumulativeShares,
      cumulativeAvgPrice,
      cumulativeInvested,
      breakevenReturnPercent:
        priceAtDrop > 0 ? ((breakevenAtDrop - priceAtDrop) / priceAtDrop) * 100 : 0,
    });
  }

  return {
    targetFeasible,
    additionalShares,
    additionalCost,
    existingInvested,
    newShares,
    totalInvested,
    newAvgPrice,
    securitiesTaxRatePercent,
    breakevenPriceBefore,
    breakevenPriceAfter,
    breakevenReturnBeforePercent: breakevenReturn(breakevenPriceBefore),
    breakevenReturnAfterPercent: breakevenReturn(breakevenPriceAfter),
    lossRateBeforePercent: lossRate(existingAvgPrice),
    lossRateAfterPercent: lossRate(newAvgPrice),
    simulation,
  };
}
