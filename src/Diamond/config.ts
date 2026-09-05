import { FEE_PERCENT as RISK_FEE_RATE } from "@tradejs/core/constants";
import {
  BacktestPriceMode,
  Direction,
  Interval,
  StrategyConfig,
} from "@tradejs/types";

export interface DiamondSideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export type DiamondEntryMode = "breakout" | "close_acceptance" | "retest";

export const config = {
  ENV: "BACKTEST",
  INTERVAL: "15" as Interval,
  MAKE_ORDERS: true,
  CLOSE_OPPOSITE_POSITIONS: false,
  BACKTEST_PRICE_MODE: "open" as const,
  AI_ENABLED: false,
  AI_MODE: "llm" as const,
  ML_ENABLED: false,
  ML_THRESHOLD: 0.1,
  MIN_AI_QUALITY: 4,
  RISK_FEE_RATE,
  RISK_SLIPPAGE_BPS: 0,
  RISK_MARKET_IMPACT_BPS: 0,
  MAX_LOSS_VALUE: 10,
  MA_FAST: 14,
  MA_MEDIUM: 49,
  MA_SLOW: 50,
  OBV_SMA: 10,
  ATR: 14,
  ATR_PCT_SHORT: 7,
  ATR_PCT_LONG: 30,
  BB: 20,
  BB_STD: 2,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  DIAMOND_PIVOT_LENGTH: 2,
  DIAMOND_MIN_EXPANSION_RATIO: 1.15,
  DIAMOND_MAX_RIGHT_WIDTH_RATIO: 0.75,
  DIAMOND_MAX_CENTER_OFFSET_RATIO: 0.3,
  DIAMOND_MIN_SYMMETRY_RATIO: 0.35,
  DIAMOND_TARGET_HEIGHT_PCT: 100,
  DIAMOND_STOP_HEIGHT_PADDING_PCT: 10,
  DIAMOND_MIN_PATTERN_HEIGHT_PCT: 0.4,
  DIAMOND_MIN_PATTERN_HEIGHT_ATR: 2,
  DIAMOND_ATR_PERIOD: 14,
  DIAMOND_MIN_LEG_BARS: 1,
  DIAMOND_MAX_PATTERN_AGE_BARS: 240,
  DIAMOND_MAX_BREAKOUT_AFTER_LAST_PIVOT_BARS: 40,
  DIAMOND_MAX_APEX_AFTER_PATTERN_BARS: 80,
  DIAMOND_TREND_LOOKBACK_BARS: 12,
  DIAMOND_MIN_PRETREND_MOVE_HEIGHT_RATIO: 0.35,
  DIAMOND_MIN_BREAKOUT_DISTANCE_ATR: 0.05,
  DIAMOND_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO: 0.5,
  DIAMOND_ENTRY_MODE: "close_acceptance" as DiamondEntryMode,
  DIAMOND_CONFIRMATION_MAX_BARS: 2,
  DIAMOND_RETEST_MAX_BARS: 4,
  DIAMOND_RETEST_TOLERANCE_ATR: 0.25,
  DIAMOND_EXIT_ON_OPPOSITE_PATTERN: true,
  LONG: {
    enable: true,
    direction: "LONG",
    minRiskRatio: 0.7,
  },
  SHORT: {
    enable: true,
    direction: "SHORT",
    minRiskRatio: 0.7,
  },
} as const;

export type DiamondConfig = StrategyConfig &
  Omit<
    typeof config,
    "BACKTEST_PRICE_MODE" | "LONG" | "SHORT" | "MIN_AI_QUALITY"
  > & {
    BACKTEST_PRICE_MODE: BacktestPriceMode;
    MIN_AI_QUALITY: number;
    DIAMOND_ENTRY_MODE: DiamondEntryMode;
    LONG: DiamondSideConfig;
    SHORT: DiamondSideConfig;
  };
