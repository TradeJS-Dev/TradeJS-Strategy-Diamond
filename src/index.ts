import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as diamondDefaultConfig } from "./Diamond/config";
import { DiamondStrategyDefinition } from "./Diamond/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  DiamondStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  Diamond: diamondDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export { DiamondStrategyDefinition } from "./Diamond/strategy";
export { diamondDefaultConfig };
export { diamondManifest } from "./Diamond/manifest";
export { diamondAiAdapter } from "./Diamond/adapters/ai";

export default defineStrategyPlugin({ strategyEntries });
