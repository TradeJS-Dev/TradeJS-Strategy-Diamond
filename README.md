# @tradejs/strategy-diamond

TradeJS strategy plugin providing `Diamond` on the 15-minute timeframe.

## Strategy overview

`Diamond` detects a reversal pattern in both directions from six confirmed
fractal pivots:

1. the first high and low establish the left side;
2. the next high and low move farther apart and form the central top and bottom;
3. the final high and low move closer together and form the contracting right
   side;
4. the projected right boundaries must converge ahead of the pattern;
5. an entry becomes eligible after price closes through the boundary opposite
   the preceding trend.

A bullish Diamond requires a falling approach and confirms above the descending
upper boundary. A bearish Diamond requires a rising approach and confirms below
the ascending lower boundary.

![Diamond strategy logic](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Diamond/main/docs/strategy-logic.svg)

## Signal geometry

![Bearish Diamond signal](https://raw.githubusercontent.com/TradeJS-Dev/TradeJS-Strategy-Diamond/main/docs/signal-example.svg)

The illustrations are schematic. Defaults use wick pivots, a two-bar confirmed
fractal, a 100% measured-height target from the confirmed break, and a stop 10%
of pattern height beyond the last opposite-side pivot. Expansion, contraction,
central-axis alignment, left/right symmetry, preceding-trend strength, apex
distance, and breakout freshness are explicit config fields so research can
change geometry without changing detector code.

The detector supports direct breakout, next-close acceptance, and retest entry
modes. `close_acceptance` is the default.

## Install

```bash
yarn add @tradejs/strategy-diamond
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-diamond"],
});
```

The package exports `strategyEntries`, the `Diamond` strategy definition,
manifest, default config, and AI adapter.

## Development

```bash
yarn install --immutable
yarn checks
```

Publishing is beta-first and delegated to the pinned
`TradeJS-Workflows@v1` reusable workflow.

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads a hidden nested engine, types package, or Strategy Kit.
