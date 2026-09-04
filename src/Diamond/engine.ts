import { Candle, Direction } from "@tradejs/types";
import { DiamondConfig, DiamondEntryMode } from "./config";

export type DiamondPatternKind = "bullish_diamond" | "bearish_diamond";
export type DiamondEntryStage = "breakout" | "close_accepted" | "retest_held";
export type DiamondPivotRole =
  | "left_lower"
  | "left_upper"
  | "bottom"
  | "top"
  | "right_lower"
  | "right_upper";

export interface DiamondPivot {
  timestamp: number;
  index: number;
  value: number;
  kind: "high" | "low";
  traded: boolean;
}

export interface DiamondPattern {
  setupId: string;
  kind: DiamondPatternKind;
  direction: Direction;
  entryMode: DiamondEntryMode;
  entryStage: DiamondEntryStage;
  pivots: [
    DiamondPivot,
    DiamondPivot,
    DiamondPivot,
    DiamondPivot,
    DiamondPivot,
    DiamondPivot,
  ];
  breakoutBoundaryPrice: number;
  upperBoundaryPrice: number;
  lowerBoundaryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  height: number;
  patternHeightAtr: number;
  patternAgeBars: number;
  breakoutAfterLastPivotBars: number;
  patternBars: number;
  centerOffsetBars: number;
  centerOffsetRatio: number;
  symmetryRatio: number;
  expansionRatio: number;
  leftWidthRatio: number;
  rightWidthRatio: number;
  preTrendMoveHeightRatio: number;
  upperContractingSlopePctPerBar: number;
  lowerContractingSlopePctPerBar: number;
  apexIndex: number;
  apexTimestamp: number;
  apexAfterPatternBars: number;
  breakoutDistancePct: number;
  breakoutDistanceAtr: number;
  breakoutDistanceHeightRatio: number;
  breakoutTimestamp: number;
  confirmationBars: number;
  timestamp: number;
  close: number;
}

export interface DiamondPendingSetup {
  setupId: string;
  mode: Exclude<DiamondEntryMode, "breakout">;
  stage: "boundary_crossed" | "retest_pending";
  breakoutIndex: number;
  pattern: DiamondPattern;
}

export interface DiamondRuntimeState {
  pattern: DiamondPattern | null;
  pending: DiamondPendingSetup | null;
  pivots: DiamondPivot[];
}

interface CandleRecord {
  candle: Candle;
  index: number;
}

interface EngineState {
  records: CandleRecord[];
  currentIndex: number;
  pivots: DiamondPivot[];
  pattern: DiamondPattern | null;
  pending: DiamondPendingSetup | null;
  consumedSetupIds: string[];
  lastTimestamp: number | null;
}

interface DiamondGeometry {
  leftLower: DiamondPivot;
  leftUpper: DiamondPivot;
  bottom: DiamondPivot;
  top: DiamondPivot;
  rightLower: DiamondPivot;
  rightUpper: DiamondPivot;
}

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getConfigNumbers = (config: DiamondConfig) => ({
  pivotLength: Math.max(1, Math.floor(config.DIAMOND_PIVOT_LENGTH ?? 2)),
  minExpansionRatio: Math.max(
    1,
    Number(config.DIAMOND_MIN_EXPANSION_RATIO ?? 1.15),
  ),
  maxRightWidthRatio: Math.max(
    0,
    Number(config.DIAMOND_MAX_RIGHT_WIDTH_RATIO ?? 0.75),
  ),
  maxCenterOffsetRatio: Math.max(
    0,
    Number(config.DIAMOND_MAX_CENTER_OFFSET_RATIO ?? 0.3),
  ),
  minSymmetryRatio: Math.min(
    1,
    Math.max(0, Number(config.DIAMOND_MIN_SYMMETRY_RATIO ?? 0.35)),
  ),
  targetHeightPct: Math.max(0, Number(config.DIAMOND_TARGET_HEIGHT_PCT ?? 100)),
  stopHeightPaddingPct: Math.max(
    0,
    Number(config.DIAMOND_STOP_HEIGHT_PADDING_PCT ?? 10),
  ),
  minPatternHeightPct: Math.max(
    0,
    Number(config.DIAMOND_MIN_PATTERN_HEIGHT_PCT ?? 0),
  ),
  minPatternHeightAtr: Math.max(
    0,
    Number(config.DIAMOND_MIN_PATTERN_HEIGHT_ATR ?? 0),
  ),
  atrPeriod: Math.max(2, Math.floor(config.DIAMOND_ATR_PERIOD ?? 14)),
  minLegBars: Math.max(1, Math.floor(config.DIAMOND_MIN_LEG_BARS ?? 1)),
  maxPatternAgeBars: Math.max(
    6,
    Math.floor(config.DIAMOND_MAX_PATTERN_AGE_BARS ?? 240),
  ),
  maxBreakoutAfterLastPivotBars: Math.max(
    1,
    Math.floor(config.DIAMOND_MAX_BREAKOUT_AFTER_LAST_PIVOT_BARS ?? 40),
  ),
  maxApexAfterPatternBars: Math.max(
    1,
    Number(config.DIAMOND_MAX_APEX_AFTER_PATTERN_BARS ?? 80),
  ),
  trendLookbackBars: Math.max(
    1,
    Math.floor(config.DIAMOND_TREND_LOOKBACK_BARS ?? 12),
  ),
  minPreTrendMoveHeightRatio: Math.max(
    0,
    Number(config.DIAMOND_MIN_PRETREND_MOVE_HEIGHT_RATIO ?? 0.35),
  ),
  minBreakoutDistanceAtr: Math.max(
    0,
    Number(config.DIAMOND_MIN_BREAKOUT_DISTANCE_ATR ?? 0),
  ),
  maxBreakoutDistanceHeightRatio: Math.max(
    0,
    Number(config.DIAMOND_MAX_BREAKOUT_DISTANCE_HEIGHT_RATIO ?? 0),
  ),
  entryMode: config.DIAMOND_ENTRY_MODE ?? "close_acceptance",
  confirmationMaxBars: Math.max(
    1,
    Math.floor(config.DIAMOND_CONFIRMATION_MAX_BARS ?? 2),
  ),
  retestMaxBars: Math.max(1, Math.floor(config.DIAMOND_RETEST_MAX_BARS ?? 4)),
  retestToleranceAtr: Math.max(
    0,
    Number(config.DIAMOND_RETEST_TOLERANCE_ATR ?? 0.25),
  ),
});

type EngineOptions = ReturnType<typeof getConfigNumbers>;

const calculateAtr = (
  records: CandleRecord[],
  period: number,
): number | null => {
  const relevant = records.slice(-(period + 1));
  if (relevant.length < 2) return null;
  const trueRanges: number[] = [];

  for (let index = 1; index < relevant.length; index += 1) {
    const candle = relevant[index]?.candle;
    const previous = relevant[index - 1]?.candle;
    const high = asNumber(candle?.high);
    const low = asNumber(candle?.low);
    const previousClose = asNumber(previous?.close);
    if (high == null || low == null || previousClose == null) continue;
    trueRanges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }

  if (trueRanges.length === 0) return null;
  return trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
};

const pushBoundedRecord = (
  state: Pick<EngineState, "records" | "currentIndex">,
  candle: Candle,
  maxRecords: number,
) => {
  state.currentIndex += 1;
  state.records.push({ candle, index: state.currentIndex });
  if (state.records.length > maxRecords) {
    state.records.splice(0, state.records.length - maxRecords);
  }
  return state.currentIndex;
};

const appendPivot = (state: EngineState, pivot: DiamondPivot) => {
  const latest = state.pivots[state.pivots.length - 1];
  if (latest?.kind === pivot.kind) {
    if (latest.traded) return;
    const moreExtreme =
      pivot.kind === "high"
        ? pivot.value > latest.value
        : pivot.value < latest.value;
    if (moreExtreme) state.pivots[state.pivots.length - 1] = pivot;
    return;
  }

  state.pivots.push(pivot);
  if (state.pivots.length > 24) state.pivots.shift();
};

const detectConfirmedPivot = (state: EngineState, pivotLength: number) => {
  const windowLength = pivotLength * 2 + 1;
  if (state.records.length < windowLength) return;

  const centerPosition = state.records.length - pivotLength - 1;
  const start = centerPosition - pivotLength;
  const end = centerPosition + pivotLength + 1;
  if (start < 0) return;

  const window = state.records.slice(start, end);
  const center = state.records[centerPosition];
  const high = asNumber(center?.candle.high);
  const low = asNumber(center?.candle.low);
  if (!center || high == null || low == null) return;

  const highs = window.map(({ candle }) => asNumber(candle.high));
  const lows = window.map(({ candle }) => asNumber(candle.low));
  if (
    highs.some((value) => value == null) ||
    lows.some((value) => value == null)
  ) {
    return;
  }

  const isHigh =
    highs.every((value) => high >= (value as number)) &&
    highs.filter((value) => value === high).length === 1;
  const isLow =
    lows.every((value) => low <= (value as number)) &&
    lows.filter((value) => value === low).length === 1;
  if (isHigh === isLow) return;

  appendPivot(state, {
    timestamp: center.candle.timestamp,
    index: center.index,
    value: isHigh ? high : low,
    kind: isHigh ? "high" : "low",
    traded: false,
  });
};

const projectLine = (
  first: DiamondPivot,
  second: DiamondPivot,
  index: number,
) => {
  const bars = second.index - first.index;
  if (bars <= 0) return first.value;
  return (
    first.value + ((second.value - first.value) * (index - first.index)) / bars
  );
};

const lineSlope = (first: DiamondPivot, second: DiamondPivot) =>
  (second.value - first.value) / (second.index - first.index);

const patternRolesForDirection = (direction: Direction) =>
  direction === "LONG"
    ? (["low", "high", "low", "high", "low", "high"] as const)
    : (["high", "low", "high", "low", "high", "low"] as const);

const findLatestPatternPivots = (
  state: EngineState,
  direction: Direction,
): DiamondPattern["pivots"] | null => {
  const roles = patternRolesForDirection(direction);
  const firstCandidate = Math.max(0, state.pivots.length - 10);

  for (
    let index = state.pivots.length - 6;
    index >= firstCandidate;
    index -= 1
  ) {
    const candidate = state.pivots.slice(index, index + 6);
    if (
      candidate.length === 6 &&
      candidate.every((pivot, roleIndex) => pivot.kind === roles[roleIndex]) &&
      candidate[5]!.index < state.currentIndex &&
      !candidate[5]!.traded
    ) {
      return candidate as DiamondPattern["pivots"];
    }
  }

  return null;
};

const geometryFor = (
  pivots: DiamondPattern["pivots"],
  direction: Direction,
): DiamondGeometry => {
  if (direction === "LONG") {
    return {
      leftLower: pivots[0],
      leftUpper: pivots[1],
      bottom: pivots[2],
      top: pivots[3],
      rightLower: pivots[4],
      rightUpper: pivots[5],
    };
  }

  return {
    leftUpper: pivots[0],
    leftLower: pivots[1],
    top: pivots[2],
    bottom: pivots[3],
    rightUpper: pivots[4],
    rightLower: pivots[5],
  };
};

const calculateApexIndex = ({
  top,
  bottom,
  rightUpper,
  rightLower,
}: DiamondGeometry): number | null => {
  const upperSlope = lineSlope(top, rightUpper);
  const lowerSlope = lineSlope(bottom, rightLower);
  const denominator = upperSlope - lowerSlope;
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  const apexIndex =
    (bottom.value -
      lowerSlope * bottom.index -
      top.value +
      upperSlope * top.index) /
    denominator;
  return Number.isFinite(apexIndex) ? apexIndex : null;
};

const getBoundaryPivots = (
  geometry: DiamondGeometry,
  direction: Direction,
): [DiamondPivot, DiamondPivot] =>
  direction === "LONG"
    ? [geometry.top, geometry.rightUpper]
    : [geometry.bottom, geometry.rightLower];

const findLatestBoundaryCross = ({
  records,
  boundaryStart,
  boundaryEnd,
  lastPivot,
  direction,
}: {
  records: CandleRecord[];
  boundaryStart: DiamondPivot;
  boundaryEnd: DiamondPivot;
  lastPivot: DiamondPivot;
  direction: Direction;
}): CandleRecord | null => {
  const sign = direction === "LONG" ? 1 : -1;
  let crossing: CandleRecord | null = null;

  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1];
    const current = records[index];
    if (!previous || !current || current.index <= lastPivot.index) continue;

    const previousClose = asNumber(previous.candle.close);
    const currentClose = asNumber(current.candle.close);
    if (previousClose == null || currentClose == null) continue;

    const previousBoundary = projectLine(
      boundaryStart,
      boundaryEnd,
      previous.index,
    );
    const currentBoundary = projectLine(
      boundaryStart,
      boundaryEnd,
      current.index,
    );
    const crossed =
      previousClose * sign <= previousBoundary * sign &&
      currentClose * sign > currentBoundary * sign;
    if (crossed) crossing = current;
  }

  return crossing;
};

const hasConsumed = (state: EngineState, setupId: string) =>
  state.consumedSetupIds.includes(setupId);

const markTerminal = (state: EngineState, setup: DiamondPendingSetup) => {
  if (!hasConsumed(state, setup.setupId)) {
    state.consumedSetupIds.push(setup.setupId);
    if (state.consumedSetupIds.length > 64) state.consumedSetupIds.shift();
  }
  const lastPatternPivot = setup.pattern.pivots[5];
  const lastPivot = state.pivots.find(
    (pivot) => pivot.timestamp === lastPatternPivot.timestamp,
  );
  if (lastPivot) lastPivot.traded = true;
};

const buildBreakoutPattern = ({
  state,
  candle,
  atr,
  direction,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  direction: Direction;
  options: EngineOptions;
}): DiamondPattern | null => {
  const pivots = findLatestPatternPivots(state, direction);
  if (!pivots) return null;
  const geometry = geometryFor(pivots, direction);
  const { leftLower, leftUpper, bottom, top, rightLower, rightUpper } =
    geometry;
  const firstPivot = pivots[0];
  const lastPivot = pivots[5];

  const legBars = pivots
    .slice(1)
    .map((pivot, index) => pivot.index - pivots[index]!.index);
  if (Math.min(...legBars) < options.minLegBars) return null;

  const height = top.value - bottom.value;
  const leftWidth = leftUpper.value - leftLower.value;
  const rightWidth = rightUpper.value - rightLower.value;
  if (height <= 0 || leftWidth <= 0 || rightWidth <= 0) return null;
  if (
    top.value <= leftUpper.value ||
    top.value <= rightUpper.value ||
    bottom.value >= leftLower.value ||
    bottom.value >= rightLower.value
  ) {
    return null;
  }

  const expansionRatio = height / Math.max(leftWidth, rightWidth);
  const leftWidthRatio = leftWidth / height;
  const rightWidthRatio = rightWidth / height;
  if (
    expansionRatio < options.minExpansionRatio ||
    rightWidthRatio > options.maxRightWidthRatio
  ) {
    return null;
  }

  const patternBars = lastPivot.index - firstPivot.index;
  const centerOffsetBars = Math.abs(top.index - bottom.index);
  const centerOffsetRatio = centerOffsetBars / patternBars;
  const centerIndex = (top.index + bottom.index) / 2;
  const leftHalfBars = centerIndex - firstPivot.index;
  const rightHalfBars = lastPivot.index - centerIndex;
  const symmetryRatio =
    Math.min(leftHalfBars, rightHalfBars) /
    Math.max(leftHalfBars, rightHalfBars);
  if (
    centerOffsetRatio > options.maxCenterOffsetRatio ||
    symmetryRatio < options.minSymmetryRatio
  ) {
    return null;
  }

  const patternAgeBars = state.currentIndex - firstPivot.index;
  const breakoutAfterLastPivotBars = state.currentIndex - lastPivot.index;
  if (
    patternAgeBars > options.maxPatternAgeBars ||
    breakoutAfterLastPivotBars > options.maxBreakoutAfterLastPivotBars
  ) {
    return null;
  }

  const midpoint = (top.value + bottom.value) / 2;
  const heightPct = midpoint !== 0 ? (height / Math.abs(midpoint)) * 100 : 0;
  const patternHeightAtr = atr != null && atr > 0 ? height / atr : 0;
  if (
    heightPct < options.minPatternHeightPct ||
    patternHeightAtr < options.minPatternHeightAtr
  ) {
    return null;
  }

  const trendReference = state.records.find(
    ({ index }) => index === firstPivot.index - options.trendLookbackBars,
  );
  const trendReferenceClose = asNumber(trendReference?.candle.close);
  if (trendReferenceClose == null) return null;
  const sign = direction === "LONG" ? 1 : -1;
  const preTrendMoveHeightRatio =
    ((trendReferenceClose - firstPivot.value) * sign) / height;
  if (preTrendMoveHeightRatio < options.minPreTrendMoveHeightRatio) return null;

  const upperSlope = lineSlope(top, rightUpper);
  const lowerSlope = lineSlope(bottom, rightLower);
  if (upperSlope >= 0 || lowerSlope <= 0) return null;
  const apexIndex = calculateApexIndex(geometry);
  if (apexIndex == null || apexIndex <= lastPivot.index) return null;
  const apexAfterPatternBars = apexIndex - lastPivot.index;
  if (
    apexAfterPatternBars > options.maxApexAfterPatternBars ||
    state.currentIndex >= apexIndex
  ) {
    return null;
  }

  const [boundaryStart, boundaryEnd] = getBoundaryPivots(geometry, direction);
  const crossing = findLatestBoundaryCross({
    records: state.records,
    boundaryStart,
    boundaryEnd,
    lastPivot,
    direction,
  });
  const close = asNumber(candle.close);
  if (!crossing || close == null) return null;

  const upperBoundaryPrice = projectLine(top, rightUpper, state.currentIndex);
  const lowerBoundaryPrice = projectLine(
    bottom,
    rightLower,
    state.currentIndex,
  );
  const breakoutBoundaryPrice =
    direction === "LONG" ? upperBoundaryPrice : lowerBoundaryPrice;
  const normalizedBreakoutDistance = (close - breakoutBoundaryPrice) * sign;
  if (normalizedBreakoutDistance <= 0) return null;

  const breakoutDistancePct =
    breakoutBoundaryPrice !== 0
      ? (normalizedBreakoutDistance / Math.abs(breakoutBoundaryPrice)) * 100
      : 0;
  const breakoutDistanceAtr =
    atr != null && atr > 0 ? normalizedBreakoutDistance / atr : 0;
  const breakoutDistanceHeightRatio = normalizedBreakoutDistance / height;
  if (
    breakoutDistanceAtr < options.minBreakoutDistanceAtr ||
    (options.maxBreakoutDistanceHeightRatio > 0 &&
      breakoutDistanceHeightRatio > options.maxBreakoutDistanceHeightRatio)
  ) {
    return null;
  }

  const kind: DiamondPatternKind =
    direction === "LONG" ? "bullish_diamond" : "bearish_diamond";
  const setupId = `${kind}:${pivots.map(({ timestamp }) => timestamp).join(":")}`;
  if (hasConsumed(state, setupId)) return null;

  const timestampPerBar =
    patternBars > 0
      ? (lastPivot.timestamp - firstPivot.timestamp) / patternBars
      : 0;
  const apexTimestamp = Math.round(
    firstPivot.timestamp + (apexIndex - firstPivot.index) * timestampPerBar,
  );
  const stopAnchor = direction === "LONG" ? rightLower : rightUpper;

  return {
    setupId,
    kind,
    direction,
    entryMode: options.entryMode,
    entryStage: "breakout",
    pivots,
    breakoutBoundaryPrice,
    upperBoundaryPrice,
    lowerBoundaryPrice,
    targetPrice: close + sign * height * (options.targetHeightPct / 100),
    stopLossPrice:
      stopAnchor.value - sign * height * (options.stopHeightPaddingPct / 100),
    height,
    patternHeightAtr,
    patternAgeBars,
    breakoutAfterLastPivotBars,
    patternBars,
    centerOffsetBars,
    centerOffsetRatio,
    symmetryRatio,
    expansionRatio,
    leftWidthRatio,
    rightWidthRatio,
    preTrendMoveHeightRatio,
    upperContractingSlopePctPerBar: (upperSlope / Math.abs(top.value)) * 100,
    lowerContractingSlopePctPerBar: (lowerSlope / Math.abs(bottom.value)) * 100,
    apexIndex,
    apexTimestamp,
    apexAfterPatternBars,
    breakoutDistancePct,
    breakoutDistanceAtr,
    breakoutDistanceHeightRatio,
    breakoutTimestamp: crossing.candle.timestamp,
    confirmationBars: 0,
    timestamp: candle.timestamp,
    close,
  };
};

const resolvePending = ({
  state,
  candle,
  atr,
  options,
}: {
  state: EngineState;
  candle: Candle;
  atr: number | null;
  options: EngineOptions;
}): DiamondPattern | null => {
  const pending = state.pending;
  if (!pending) return null;
  const confirmationBars = state.currentIndex - pending.breakoutIndex;
  if (confirmationBars < 1) return null;

  const close = asNumber(candle.close);
  const high = asNumber(candle.high);
  const low = asNumber(candle.low);
  if (close == null || high == null || low == null) return null;

  const pattern = pending.pattern;
  const invalidated =
    pattern.direction === "LONG"
      ? low <= pattern.stopLossPrice
      : high >= pattern.stopLossPrice;
  const maxBars =
    pending.mode === "retest"
      ? options.retestMaxBars
      : options.confirmationMaxBars;
  if (
    invalidated ||
    confirmationBars > maxBars ||
    state.currentIndex >= pattern.apexIndex
  ) {
    markTerminal(state, pending);
    state.pending = null;
    return null;
  }

  const geometry = geometryFor(pattern.pivots, pattern.direction);
  const [boundaryStart, boundaryEnd] = getBoundaryPivots(
    geometry,
    pattern.direction,
  );
  const breakoutBoundaryPrice = projectLine(
    boundaryStart,
    boundaryEnd,
    state.currentIndex,
  );
  const upperBoundaryPrice = projectLine(
    geometry.top,
    geometry.rightUpper,
    state.currentIndex,
  );
  const lowerBoundaryPrice = projectLine(
    geometry.bottom,
    geometry.rightLower,
    state.currentIndex,
  );
  const sign = pattern.direction === "LONG" ? 1 : -1;
  const effectiveAtr = atr != null && atr > 0 ? atr : pattern.height;
  const minimumDistance = effectiveAtr * options.minBreakoutDistanceAtr;
  const normalizedDistance = (close - breakoutBoundaryPrice) * sign;
  const distanceHeightRatio = normalizedDistance / pattern.height;
  const closeAccepted = normalizedDistance >= minimumDistance;
  const ranTooFar =
    options.maxBreakoutDistanceHeightRatio > 0 &&
    distanceHeightRatio > options.maxBreakoutDistanceHeightRatio;
  if (ranTooFar) {
    markTerminal(state, pending);
    state.pending = null;
    return null;
  }

  let entryStage: DiamondEntryStage | null = null;
  if (pending.mode === "close_acceptance") {
    if (closeAccepted) entryStage = "close_accepted";
  } else {
    const tolerance = effectiveAtr * options.retestToleranceAtr;
    const touchPrice = pattern.direction === "LONG" ? low : high;
    const touched = Math.abs(touchPrice - breakoutBoundaryPrice) <= tolerance;
    if (touched && closeAccepted) entryStage = "retest_held";
  }

  if (!entryStage) return null;
  markTerminal(state, pending);
  state.pending = null;
  return {
    ...pattern,
    entryStage,
    breakoutBoundaryPrice,
    upperBoundaryPrice,
    lowerBoundaryPrice,
    breakoutDistancePct:
      breakoutBoundaryPrice !== 0
        ? (normalizedDistance / Math.abs(breakoutBoundaryPrice)) * 100
        : 0,
    breakoutDistanceAtr:
      effectiveAtr > 0 ? normalizedDistance / effectiveAtr : 0,
    breakoutDistanceHeightRatio: distanceHeightRatio,
    confirmationBars,
    timestamp: candle.timestamp,
    close,
  };
};

const clonePattern = (pattern: DiamondPattern): DiamondPattern => ({
  ...pattern,
  pivots: pattern.pivots.map((pivot) => ({
    ...pivot,
  })) as DiamondPattern["pivots"],
});

const clonePending = (
  pending: DiamondPendingSetup | null,
): DiamondPendingSetup | null =>
  pending
    ? {
        ...pending,
        pattern: clonePattern(pending.pattern),
      }
    : null;

const pivotRolesForDirection = (direction: Direction): DiamondPivotRole[] =>
  direction === "LONG"
    ? [
        "left_lower",
        "left_upper",
        "bottom",
        "top",
        "right_lower",
        "right_upper",
      ]
    : [
        "left_upper",
        "left_lower",
        "top",
        "bottom",
        "right_upper",
        "right_lower",
      ];

export const buildDiamondSignalContext = (pattern: DiamondPattern) => ({
  setupId: pattern.setupId,
  patternKind: pattern.kind,
  signalDirection: pattern.direction,
  entryMode: pattern.entryMode,
  entryStage: pattern.entryStage,
  breakoutBoundaryPrice: pattern.breakoutBoundaryPrice,
  upperBoundaryPrice: pattern.upperBoundaryPrice,
  lowerBoundaryPrice: pattern.lowerBoundaryPrice,
  targetPrice: pattern.targetPrice,
  stopLossPrice: pattern.stopLossPrice,
  height: pattern.height,
  patternHeightAtr: pattern.patternHeightAtr,
  patternAgeBars: pattern.patternAgeBars,
  breakoutAfterLastPivotBars: pattern.breakoutAfterLastPivotBars,
  patternBars: pattern.patternBars,
  centerOffsetBars: pattern.centerOffsetBars,
  centerOffsetRatio: pattern.centerOffsetRatio,
  symmetryRatio: pattern.symmetryRatio,
  expansionRatio: pattern.expansionRatio,
  leftWidthRatio: pattern.leftWidthRatio,
  rightWidthRatio: pattern.rightWidthRatio,
  preTrendMoveHeightRatio: pattern.preTrendMoveHeightRatio,
  upperContractingSlopePctPerBar: pattern.upperContractingSlopePctPerBar,
  lowerContractingSlopePctPerBar: pattern.lowerContractingSlopePctPerBar,
  apexIndex: pattern.apexIndex,
  apexTimestamp: pattern.apexTimestamp,
  apexAfterPatternBars: pattern.apexAfterPatternBars,
  breakoutDistancePct: pattern.breakoutDistancePct,
  breakoutDistanceAtr: pattern.breakoutDistanceAtr,
  breakoutDistanceHeightRatio: pattern.breakoutDistanceHeightRatio,
  breakoutTimestamp: pattern.breakoutTimestamp,
  confirmationBars: pattern.confirmationBars,
  currentPrice: pattern.close,
  pivots: pattern.pivots.map(({ timestamp, value, kind }, index) => ({
    role: pivotRolesForDirection(pattern.direction)[index],
    timestamp,
    value,
    kind,
  })),
});

export type DiamondSignalContext = ReturnType<typeof buildDiamondSignalContext>;

export const createDiamondEngine = ({
  config,
  initialCandles = [],
}: {
  config: DiamondConfig;
  initialCandles?: Candle[];
}): {
  next: (candle: Candle) => DiamondRuntimeState;
  getState: () => DiamondRuntimeState;
} => {
  const options = getConfigNumbers(config);
  const state: EngineState = {
    records: [],
    currentIndex: -1,
    pivots: [],
    pattern: null,
    pending: null,
    consumedSetupIds: [],
    lastTimestamp: null,
  };
  const maxRecords = Math.max(
    options.maxPatternAgeBars +
      options.trendLookbackBars +
      options.pivotLength * 2 +
      8,
    options.atrPeriod + 2,
  );

  const snapshot = (): DiamondRuntimeState => ({
    pattern: state.pattern ? clonePattern(state.pattern) : null,
    pending: clonePending(state.pending),
    pivots: state.pivots.map((pivot) => ({ ...pivot })),
  });

  const apply = (candle: Candle): DiamondRuntimeState => {
    if (state.lastTimestamp === candle.timestamp) return snapshot();
    state.lastTimestamp = candle.timestamp;
    state.pattern = null;
    pushBoundedRecord(state, candle, maxRecords);
    detectConfirmedPivot(state, options.pivotLength);
    const atr = calculateAtr(state.records, options.atrPeriod);

    const pendingPattern = resolvePending({ state, candle, atr, options });
    if (pendingPattern) {
      state.pattern = pendingPattern;
      return snapshot();
    }
    if (state.pending) return snapshot();

    const breakout =
      buildBreakoutPattern({
        state,
        candle,
        atr,
        direction: "LONG",
        options,
      }) ??
      buildBreakoutPattern({
        state,
        candle,
        atr,
        direction: "SHORT",
        options,
      });
    if (!breakout) return snapshot();

    if (options.entryMode === "breakout") {
      const terminal: DiamondPendingSetup = {
        setupId: breakout.setupId,
        mode: "close_acceptance",
        stage: "boundary_crossed",
        breakoutIndex: state.currentIndex,
        pattern: breakout,
      };
      markTerminal(state, terminal);
      state.pattern = breakout;
      return snapshot();
    }

    state.pending = {
      setupId: breakout.setupId,
      mode: options.entryMode,
      stage:
        options.entryMode === "retest" ? "retest_pending" : "boundary_crossed",
      breakoutIndex: state.currentIndex,
      pattern: breakout,
    };
    return snapshot();
  };

  for (const candle of initialCandles) apply(candle);
  return { next: apply, getState: snapshot };
};
