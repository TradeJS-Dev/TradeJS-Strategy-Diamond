import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import {
  getAiPayloadNumber,
  withStrategyLocalAiGate,
} from "@tradejs/strategy-kit/ai-gate";
import type { StrategyAiAdapter } from "@tradejs/types";
import type { DiamondConfig } from "../config";

const diamondBaseAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const baseAdditional =
      (basePayload.additionalIndicators as
        Record<string, unknown> | undefined) ?? {};

    return {
      ...basePayload,
      additionalIndicators: {
        ...baseAdditional,
        diamondContext: (
          signal.additionalIndicators as Record<string, unknown> | undefined
        )?.diamondContext,
      },
    };
  },
  buildHumanPromptAddon: ({ payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.diamondContext as Record<string, unknown> | undefined) ?? {};

    return `
Additional Diamond context:
- patternKind=${String(context.patternKind ?? "n/a")}
- signalDirection=${String(context.signalDirection ?? "n/a")}
- entryStage=${String(context.entryStage ?? "n/a")}
- breakoutBoundaryPrice=${String(context.breakoutBoundaryPrice ?? "n/a")}
- expansionRatio=${String(context.expansionRatio ?? "n/a")}
- rightWidthRatio=${String(context.rightWidthRatio ?? "n/a")}
- centerOffsetRatio=${String(context.centerOffsetRatio ?? "n/a")}
- symmetryRatio=${String(context.symmetryRatio ?? "n/a")}
- preTrendMoveHeightRatio=${String(context.preTrendMoveHeightRatio ?? "n/a")}
- apexAfterPatternBars=${String(context.apexAfterPatternBars ?? "n/a")}
- breakoutDistanceHeightRatio=${String(context.breakoutDistanceHeightRatio ?? "n/a")}
- targetPrice=${String(context.targetPrice ?? "n/a")}
- stopLossPrice=${String(context.stopLossPrice ?? "n/a")}
- pivots=${JSON.stringify(context.pivots ?? [])}

Interpretation rules for Diamond:
- A bullish Diamond follows a falling approach, widens into a central low/high pair, contracts on the right, then confirms above the descending upper boundary.
- A bearish Diamond is the exact mirror after a rising approach and confirms below the ascending lower boundary.
- Expansion, center alignment, symmetry, convergence and prior trend are geometry checks, not independent entry signals.
- Prefer a fresh close beyond the breakout boundary before the projected apex and reject analysis that contradicts the signal direction.
`.trim();
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<
        DiamondConfig,
        "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY"
      >,
    ),
};

export const diamondAiAdapter = withStrategyLocalAiGate(diamondBaseAiAdapter, {
  id: "diamond_h1_psar_take_profit_directional_gate_2026_09_03",
  approves: ({ signal, payload }) => {
    if (signal.direction === "LONG") {
      const psarBarsSinceSignal = getAiPayloadNumber(
        payload,
        "additionalIndicators.baseContext.regime.trend.psar.barsSinceSignal",
      );

      return psarBarsSinceSignal != null && psarBarsSinceSignal >= 14;
    }

    if (signal.direction !== "SHORT") {
      return false;
    }

    const currentPrice = signal.prices.currentPrice;
    const takeProfitPrice = signal.prices.takeProfitPrice;
    if (
      !Number.isFinite(currentPrice) ||
      currentPrice === 0 ||
      !Number.isFinite(takeProfitPrice)
    ) {
      return false;
    }

    const takeProfitDistanceBps =
      (Math.abs(takeProfitPrice - currentPrice) / Math.abs(currentPrice)) *
      10_000;

    return takeProfitDistanceBps <= 360;
  },
});
