/** @jest-environment node */

import { config as DEFAULT_CONFIG } from "../config";
import { createDiamondEngine } from "../engine";

const makeCandle = (
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
) => ({
  timestamp: 1_700_000_000_000 + index * 15 * 60_000,
  dt: new Date(1_700_000_000_000 + index * 15 * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  volume: 1_000,
  turnover: close * 1_000,
});

const makeConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    ...DEFAULT_CONFIG,
    DIAMOND_PIVOT_LENGTH: 1,
    DIAMOND_MIN_PATTERN_HEIGHT_PCT: 0,
    DIAMOND_MIN_PATTERN_HEIGHT_ATR: 0,
    DIAMOND_TREND_LOOKBACK_BARS: 2,
    DIAMOND_MIN_BREAKOUT_DISTANCE_ATR: 0,
    DIAMOND_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO: 1,
    DIAMOND_ENTRY_MODE: "breakout",
    ...overrides,
  }) as any;

export const makeBullishDiamondCandles = () => [
  makeCandle(0, 124, 125, 123, 124),
  makeCandle(1, 121, 122, 119, 120),
  makeCandle(2, 115, 116, 113, 114),
  makeCandle(3, 106, 107, 104, 105),
  makeCandle(4, 109, 112, 108, 111),
  makeCandle(5, 114, 116, 112, 115),
  makeCandle(6, 111, 112, 108, 109),
  makeCandle(7, 101, 102, 94, 96),
  makeCandle(8, 105, 118, 100, 112),
  makeCandle(9, 120, 128, 118, 126),
  makeCandle(10, 118, 121, 112, 114),
  makeCandle(11, 106, 110, 100, 105),
  makeCandle(12, 111, 118, 108, 116),
  makeCandle(13, 119, 122, 115, 121),
  makeCandle(14, 118, 119, 116, 117),
  makeCandle(15, 118, 121.5, 117, 120),
];

const mirrorCandles = (candles: ReturnType<typeof makeBullishDiamondCandles>) =>
  candles.map((candle) => ({
    ...candle,
    open: 220 - candle.open,
    high: 220 - candle.low,
    low: 220 - candle.high,
    close: 220 - candle.close,
    turnover: (220 - candle.close) * 1_000,
  }));

describe("Diamond engine", () => {
  it("detects a bullish Diamond after the upper contracting boundary break", () => {
    const engine = createDiamondEngine({ config: makeConfig() });
    const states = makeBullishDiamondCandles().map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bullish_diamond");
    expect(pattern?.direction).toBe("LONG");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      104, 116, 94, 128, 100, 122,
    ]);
    expect(pattern?.height).toBe(34);
    expect(pattern?.expansionRatio).toBeCloseTo(34 / 22);
    expect(pattern?.centerOffsetRatio).toBeCloseTo(0.2);
    expect(pattern?.symmetryRatio).toBeCloseTo(1);
    expect(pattern?.preTrendMoveHeightRatio).toBeCloseTo(16 / 34);
    expect(pattern?.breakoutBoundaryPrice).toBeCloseTo(119);
    expect(pattern?.apexIndex).toBeCloseTo(19.333333);
    expect(pattern?.targetPrice).toBeCloseTo(154);
    expect(pattern?.stopLossPrice).toBeCloseTo(96.6);
  });

  it("detects the mirrored bearish Diamond", () => {
    const engine = createDiamondEngine({ config: makeConfig() });
    const states = mirrorCandles(makeBullishDiamondCandles()).map((candle) =>
      engine.next(candle as any),
    );
    const pattern = states[states.length - 1]?.pattern;

    expect(pattern?.kind).toBe("bearish_diamond");
    expect(pattern?.direction).toBe("SHORT");
    expect(pattern?.pivots.map((pivot) => pivot.value)).toEqual([
      116, 104, 126, 92, 120, 98,
    ]);
    expect(pattern?.targetPrice).toBeCloseTo(66);
    expect(pattern?.stopLossPrice).toBeCloseTo(123.4);
  });

  it("rejects a shape whose central extrema are not aligned", () => {
    const engine = createDiamondEngine({
      config: makeConfig({ DIAMOND_MAX_CENTER_OFFSET_RATIO: 0.1 }),
    });
    const state = makeBullishDiamondCandles().reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("rejects a Diamond without a strong enough falling approach", () => {
    const engine = createDiamondEngine({
      config: makeConfig({ DIAMOND_MIN_PRETREND_MOVE_HEIGHT_RATIO: 0.5 }),
    });
    const state = makeBullishDiamondCandles().reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(state.pattern).toBeNull();
  });

  it("waits for close acceptance and emits the setup only once", () => {
    const engine = createDiamondEngine({
      config: makeConfig({
        DIAMOND_ENTRY_MODE: "close_acceptance",
        DIAMOND_CONFIRMATION_MAX_BARS: 2,
      }),
    });
    const history = makeBullishDiamondCandles();
    const breakoutState = history.reduce(
      (_, candle) => engine.next(candle as any),
      engine.getState(),
    );

    expect(breakoutState.pattern).toBeNull();
    expect(breakoutState.pending?.stage).toBe("boundary_crossed");

    const confirmation = makeCandle(16, 120, 123, 118, 121);
    const accepted = engine.next(confirmation as any);
    expect(accepted.pattern?.entryStage).toBe("close_accepted");
    expect(accepted.pattern?.confirmationBars).toBe(1);

    expect(engine.next(confirmation as any)).toEqual(accepted);
    expect(
      engine.next(makeCandle(17, 121, 124, 119, 122) as any).pattern,
    ).toBeNull();
  });

  it("rebuilds a pending setup identically from initial candles", () => {
    const config = makeConfig({ DIAMOND_ENTRY_MODE: "close_acceptance" });
    const history = makeBullishDiamondCandles();
    const confirmation = makeCandle(16, 120, 123, 118, 121);
    const continuous = createDiamondEngine({ config });
    for (const candle of history) continuous.next(candle as any);
    const continuousState = continuous.next(confirmation as any);

    const restored = createDiamondEngine({
      config,
      initialCandles: history as any,
    });
    expect(restored.next(confirmation as any)).toEqual(continuousState);
  });
});
