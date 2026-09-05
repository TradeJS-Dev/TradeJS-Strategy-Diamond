import { round } from "@tradejs/core/math";
import {
  buildTradeEconomics,
  isStopLossOnCorrectSide,
} from "@tradejs/strategy-kit/risk";
import type {
  CreateStrategyCore,
  IndicatorsHistorySnapshot,
  Position,
} from "@tradejs/types";
import { DiamondConfig } from "./config";
import { buildDiamondSignalContext, createDiamondEngine } from "./engine";
import { buildDiamondFigures } from "./figures";

const isOpenPosition = (position: Position | null): position is Position =>
  Boolean(
    position &&
    typeof position.price === "number" &&
    Number.isFinite(position.price) &&
    typeof position.qty === "number" &&
    Number.isFinite(position.qty) &&
    position.qty > 0 &&
    (position.direction === "LONG" || position.direction === "SHORT"),
  );

const buildDiamondStateKey = (config: DiamondConfig) =>
  JSON.stringify({
    pivotLength: config.DIAMOND_PIVOT_LENGTH,
    minExpansionRatio: config.DIAMOND_MIN_EXPANSION_RATIO,
    maxRightWidthRatio: config.DIAMOND_MAX_RIGHT_WIDTH_RATIO,
    maxCenterOffsetRatio: config.DIAMOND_MAX_CENTER_OFFSET_RATIO,
    minSymmetryRatio: config.DIAMOND_MIN_SYMMETRY_RATIO,
    targetHeightPct: config.DIAMOND_TARGET_HEIGHT_PCT,
    stopHeightPaddingPct: config.DIAMOND_STOP_HEIGHT_PADDING_PCT,
    minPatternHeightPct: config.DIAMOND_MIN_PATTERN_HEIGHT_PCT,
    minPatternHeightAtr: config.DIAMOND_MIN_PATTERN_HEIGHT_ATR,
    atrPeriod: config.DIAMOND_ATR_PERIOD,
    minLegBars: config.DIAMOND_MIN_LEG_BARS,
    maxPatternAgeBars: config.DIAMOND_MAX_PATTERN_AGE_BARS,
    maxBreakoutAfterLastPivotBars:
      config.DIAMOND_MAX_BREAKOUT_AFTER_LAST_PIVOT_BARS,
    maxApexAfterPatternBars: config.DIAMOND_MAX_APEX_AFTER_PATTERN_BARS,
    trendLookbackBars: config.DIAMOND_TREND_LOOKBACK_BARS,
    minPreTrendMoveHeightRatio: config.DIAMOND_MIN_PRETREND_MOVE_HEIGHT_RATIO,
    minBreakoutDistanceAtr: config.DIAMOND_MIN_BREAKOUT_DISTANCE_ATR,
    maxBreakoutDistanceHeightRatio:
      config.DIAMOND_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO,
    entryMode: config.DIAMOND_ENTRY_MODE,
    confirmationMaxBars: config.DIAMOND_CONFIRMATION_MAX_BARS,
    retestMaxBars: config.DIAMOND_RETEST_MAX_BARS,
    retestToleranceAtr: config.DIAMOND_RETEST_TOLERANCE_ATR,
  });

export const createDiamondCore: CreateStrategyCore<
  DiamondConfig,
  IndicatorsHistorySnapshot | undefined
> = async ({ config, data: initialData, strategyApi, indicatorsState }) => {
  const detectorState = strategyApi.createStateController<
    { engine: ReturnType<typeof createDiamondEngine> },
    ReturnType<ReturnType<typeof createDiamondEngine>["next"]>,
    ReturnType<ReturnType<typeof createDiamondEngine>["getState"]>
  >(
    "Diamond",
    () => ({
      engine: createDiamondEngine({
        config,
        initialCandles: initialData,
      }),
    }),
    {
      configKey: buildDiamondStateKey(config),
      snapshot: (state) => state.engine.getState(),
    },
  );
  const lastTradeController = strategyApi.createLastTradeController({
    enabled: true,
  });
  const nextDetectorState = (
    candle: Parameters<ReturnType<typeof createDiamondEngine>["next"]>[0],
  ) =>
    detectorState.oncePerTimestamp(candle.timestamp, (state) =>
      state.engine.next(candle),
    );

  return async (candle) => {
    const runtimeState = nextDetectorState(candle);
    const pattern = runtimeState.pattern;
    if (!pattern) return strategyApi.skip("NO_PATTERN");

    const position = await strategyApi.getCurrentPosition();
    if (isOpenPosition(position)) {
      const oppositePattern = position.direction !== pattern.direction;
      if (Boolean(config.DIAMOND_EXIT_ON_OPPOSITE_PATTERN) && oppositePattern) {
        return strategyApi.exit({
          code: "DIAMOND_OPPOSITE_PATTERN_EXIT",
          direction: position.direction,
        });
      }
      return strategyApi.skip("POSITION_EXISTS");
    }

    if (lastTradeController.isInCooldown(candle.timestamp)) {
      return strategyApi.skip("DEV_TRADE_COOLDOWN");
    }

    const modeConfig =
      pattern.direction === "LONG" ? config.LONG : config.SHORT;
    if (!modeConfig.enable) return strategyApi.skip("STRATEGY_DISABLED");

    const { timestamp, currentPrice } =
      await strategyApi.getDecisionPriceContext();
    if (
      !isStopLossOnCorrectSide({
        direction: pattern.direction,
        currentPrice,
        stopLossPrice: pattern.stopLossPrice,
      })
    ) {
      return strategyApi.skip("INVALID_STOP");
    }

    const targetIsValid =
      pattern.direction === "LONG"
        ? pattern.targetPrice > currentPrice
        : pattern.targetPrice < currentPrice;
    if (!targetIsValid) return strategyApi.skip("TARGET_ALREADY_PASSED");

    const economics = buildTradeEconomics({
      entryPrice: currentPrice,
      stopLossPrice: pattern.stopLossPrice,
      takeProfitPrice: pattern.targetPrice,
      feeRate: Number(config.RISK_FEE_RATE ?? 0),
      slippageBps:
        Number(config.RISK_SLIPPAGE_BPS ?? 0) +
        Number(config.RISK_MARKET_IMPACT_BPS ?? 0),
    });
    const qty =
      economics.lossPerUnit > 0
        ? Number(config.MAX_LOSS_VALUE ?? 0) / economics.lossPerUnit
        : 0;
    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return strategyApi.skip("INVALID_QTY");
    }

    const riskRatio = economics.netRiskRatio;
    if (riskRatio <= modeConfig.minRiskRatio) {
      return strategyApi.skip(`RISK_RATIO:${round(riskRatio)}`);
    }

    const signalContext = {
      ...buildDiamondSignalContext({ ...pattern, close: currentPrice }),
      executionEconomics: {
        grossRiskRatio: economics.grossRiskRatio,
        netRiskRatio: economics.netRiskRatio,
        lossPerUnit: economics.lossPerUnit,
        rewardPerUnit: economics.rewardPerUnit,
      },
    };
    const indicators = indicatorsState.snapshot();
    lastTradeController.markTrade(timestamp);

    return strategyApi.entry({
      code:
        pattern.direction === "LONG"
          ? `DIAMOND_BULLISH_${pattern.entryStage.toUpperCase()}`
          : `DIAMOND_BEARISH_${pattern.entryStage.toUpperCase()}`,
      direction: modeConfig.direction,
      indicators,
      additionalIndicators: { diamondContext: signalContext },
      figures: buildDiamondFigures({
        pattern,
        entryTimestamp: timestamp,
        entryPrice: currentPrice,
      }),
      orderPlan: {
        qty,
        stopLossPrice: pattern.stopLossPrice,
        takeProfits: [{ rate: 1, price: pattern.targetPrice }],
      },
    });
  };
};
