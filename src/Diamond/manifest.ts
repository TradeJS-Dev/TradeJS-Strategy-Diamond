import { StrategyManifest } from "@tradejs/types";
import { diamondAiAdapter } from "./adapters/ai";

export const diamondManifest: StrategyManifest = {
  name: "Diamond",
  aiAdapter: diamondAiAdapter,
};
