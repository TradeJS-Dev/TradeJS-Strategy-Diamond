import { buildDiamondFigures } from "../figures";
import { DiamondPattern } from "../engine";

describe("Diamond figures", () => {
  it("renders four boundaries, target, stop, pivots and entry", () => {
    const pattern: DiamondPattern = {
      setupId: "bullish-diamond-1",
      kind: "bullish_diamond",
      direction: "LONG",
      entryMode: "close_acceptance",
      entryStage: "close_accepted",
      pivots: [
        { timestamp: 3, index: 3, value: 104, kind: "low", traded: false },
        { timestamp: 5, index: 5, value: 116, kind: "high", traded: false },
        { timestamp: 7, index: 7, value: 94, kind: "low", traded: false },
        { timestamp: 9, index: 9, value: 128, kind: "high", traded: false },
        { timestamp: 11, index: 11, value: 100, kind: "low", traded: false },
        { timestamp: 13, index: 13, value: 122, kind: "high", traded: true },
      ],
      breakoutBoundaryPrice: 117.5,
      upperBoundaryPrice: 117.5,
      lowerBoundaryPrice: 107.5,
      targetPrice: 154,
      stopLossPrice: 96.6,
      height: 34,
      patternHeightAtr: 4,
      patternAgeBars: 13,
      breakoutAfterLastPivotBars: 3,
      patternBars: 10,
      centerOffsetBars: 2,
      centerOffsetRatio: 0.2,
      symmetryRatio: 1,
      expansionRatio: 34 / 22,
      leftWidthRatio: 12 / 34,
      rightWidthRatio: 22 / 34,
      preTrendMoveHeightRatio: 16 / 34,
      upperContractingSlopePctPerBar: -1.171875,
      lowerContractingSlopePctPerBar: 1.595744,
      apexIndex: 19.333333,
      apexTimestamp: 19.333333,
      apexAfterPatternBars: 6.333333,
      breakoutDistancePct: 2,
      breakoutDistanceAtr: 0.5,
      breakoutDistanceHeightRatio: 2.5 / 34,
      breakoutTimestamp: 15,
      confirmationBars: 1,
      timestamp: 16,
      close: 121,
    };

    const figures = buildDiamondFigures({
      pattern,
      entryTimestamp: 16,
      entryPrice: 121,
    });

    expect(figures.lines).toHaveLength(6);
    expect(figures.points).toHaveLength(2);
    expect(figures.lines?.map((line) => line.kind)).toEqual([
      "diamond_upper_expanding_boundary",
      "diamond_lower_expanding_boundary",
      "diamond_upper_contracting_boundary",
      "diamond_lower_contracting_boundary",
      "diamond_target",
      "diamond_stop",
    ]);
    expect(figures.points?.[0]?.points).toHaveLength(6);
  });
});
