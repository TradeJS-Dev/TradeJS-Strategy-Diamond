import { createStrategyConfigParser } from "@tradejs/strategy-kit/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import { config as DEFAULT_CONFIG, DiamondConfig } from "./config";
import { createDiamondCore } from "./core";
import { diamondManifest } from "./manifest";

export const DiamondStrategyDefinition: ValidatedStrategyRegistryEntry<DiamondConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: createStrategyConfigParser({
      strategyName: "Diamond",
      defaults: DEFAULT_CONFIG,
    }),
    createCore: createDiamondCore,
    manifest: diamondManifest,
  };

export default DiamondStrategyDefinition;
