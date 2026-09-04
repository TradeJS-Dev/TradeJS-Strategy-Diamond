import { diamondAiAdapter } from "../adapters/ai";

describe("diamondAiAdapter", () => {
  it("carries Diamond geometry into the AI payload and prompt", () => {
    const context = {
      patternKind: "bullish_diamond",
      signalDirection: "LONG",
      expansionRatio: 1.55,
      centerOffsetRatio: 0.2,
      pivots: [{ role: "left_lower", value: 104 }],
    };
    const payload = diamondAiAdapter.buildPayload!({
      signal: { additionalIndicators: { diamondContext: context } },
      basePayload: {
        additionalIndicators: { baseContext: { available: true } },
      },
    } as any);

    expect((payload.additionalIndicators as any).diamondContext).toEqual(
      context,
    );
    expect((payload.additionalIndicators as any).baseContext).toEqual({
      available: true,
    });

    const prompt = diamondAiAdapter.buildHumanPromptAddon!({ payload } as any);
    expect(prompt).toContain("patternKind=bullish_diamond");
    expect(prompt).toContain("expansionRatio=1.55");
    expect(prompt).toContain("centerOffsetRatio=0.2");
  });

  it("keeps the 15m strategy AI runtime disabled by default", () => {
    expect(
      diamondAiAdapter.mapEntryRuntimeFromConfig!({
        AI_ENABLED: false,
        AI_MODE: "llm",
        MIN_AI_QUALITY: 4,
      } as any),
    ).toMatchObject({ enabled: false });
  });

  const applyLocalGate = ({
    direction = "LONG",
    psarBarsSinceSignal,
    currentPrice = 100,
    takeProfitPrice = direction === "LONG" ? 110 : 96.4,
  }: {
    direction?: "LONG" | "SHORT";
    psarBarsSinceSignal?: unknown;
    currentPrice?: number;
    takeProfitPrice?: number;
  }) =>
    diamondAiAdapter.postProcessLocalAnalysis!({
      signal: {
        direction,
        prices: {
          currentPrice,
          takeProfitPrice,
          stopLossPrice: direction === "LONG" ? 95 : 105,
        },
      },
      payload: {
        additionalIndicators: {
          baseContext: {
            regime: {
              trend: {
                psar: { barsSinceSignal: psarBarsSinceSignal },
              },
            },
          },
        },
      },
      analysis: { quality: 3 },
    } as any) as any;

  it("approves LONG at the PSAR age boundary", () => {
    const analysis = applyLocalGate({ psarBarsSinceSignal: 14 });

    expect(analysis).toMatchObject({
      approved: true,
      direction: "LONG",
      quality: 4,
      gateDecision: "approved",
      needRetest: false,
      takeProfitPrice: 110,
      stopLossPrice: 95,
    });
    expect(analysis.qualityReason).toContain(
      "rule=diamond_h1_psar_take_profit_directional_gate_2026_09_03",
    );
  });

  it.each([13.999999, undefined, null, "not-a-number"])(
    "rejects LONG outside the mature PSAR pocket: %p",
    (psarBarsSinceSignal) => {
      expect(applyLocalGate({ psarBarsSinceSignal })).toMatchObject({
        approved: false,
        direction: null,
        quality: 3,
        gateDecision: "rejected",
        needRetest: true,
        takeProfitPrice: null,
        stopLossPrice: null,
      });
    },
  );

  it("approves SHORT at the take-profit distance boundary", () => {
    expect(
      applyLocalGate({ direction: "SHORT", takeProfitPrice: 96.4 }),
    ).toMatchObject({
      approved: true,
      direction: "SHORT",
      quality: 4,
      gateDecision: "approved",
      needRetest: false,
      takeProfitPrice: 96.4,
      stopLossPrice: 105,
    });
  });

  it.each([
    { currentPrice: 100, takeProfitPrice: 96.399999 },
    { currentPrice: 0, takeProfitPrice: 96.4 },
    { currentPrice: Number.NaN, takeProfitPrice: 96.4 },
    { currentPrice: 100, takeProfitPrice: Number.NaN },
  ])("rejects SHORT outside a valid compact target: %p", (prices) => {
    expect(applyLocalGate({ direction: "SHORT", ...prices })).toMatchObject({
      approved: false,
      direction: null,
      quality: 3,
      gateDecision: "rejected",
    });
  });

  it("does not let SHORT target distance bypass the LONG PSAR condition", () => {
    expect(
      applyLocalGate({
        direction: "LONG",
        psarBarsSinceSignal: 13.999999,
        takeProfitPrice: 103.6,
      }),
    ).toMatchObject({ approved: false, gateDecision: "rejected" });
  });
});
