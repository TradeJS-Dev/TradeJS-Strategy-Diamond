import {
  StrategyEntryModelFigures,
  StrategyFigureLine,
  StrategyFigurePoints,
} from "@tradejs/types";
import { DiamondPattern } from "./engine";

const geometryFor = (pattern: DiamondPattern) => {
  const pivots = pattern.pivots;
  return pattern.direction === "LONG"
    ? {
        leftLower: pivots[0],
        leftUpper: pivots[1],
        bottom: pivots[2],
        top: pivots[3],
        rightLower: pivots[4],
        rightUpper: pivots[5],
      }
    : {
        leftUpper: pivots[0],
        leftLower: pivots[1],
        top: pivots[2],
        bottom: pivots[3],
        rightUpper: pivots[4],
        rightLower: pivots[5],
      };
};

export const buildDiamondFigures = ({
  pattern,
  entryTimestamp,
  entryPrice,
}: {
  pattern: DiamondPattern;
  entryTimestamp: number;
  entryPrice: number;
}): StrategyEntryModelFigures => {
  const signalColor = pattern.direction === "LONG" ? "#22c55e" : "#ef4444";
  const upperColor = "#ef4444";
  const lowerColor = "#2563eb";
  const geometry = geometryFor(pattern);
  const apex = {
    timestamp: pattern.apexTimestamp,
    value:
      geometry.top.value +
      ((geometry.rightUpper.value - geometry.top.value) *
        (pattern.apexIndex - geometry.top.index)) /
        (geometry.rightUpper.index - geometry.top.index),
  };

  const lines: StrategyFigureLine[] = [
    {
      id: `diamond-upper-expanding-${entryTimestamp}`,
      kind: "diamond_upper_expanding_boundary",
      points: [geometry.leftUpper, geometry.top].map(
        ({ timestamp, value }) => ({
          timestamp,
          value,
        }),
      ),
      color: upperColor,
      width: 2,
      style: "solid",
    },
    {
      id: `diamond-lower-expanding-${entryTimestamp}`,
      kind: "diamond_lower_expanding_boundary",
      points: [geometry.leftLower, geometry.bottom].map(
        ({ timestamp, value }) => ({
          timestamp,
          value,
        }),
      ),
      color: lowerColor,
      width: 2,
      style: "solid",
    },
    {
      id: `diamond-upper-contracting-${entryTimestamp}`,
      kind: "diamond_upper_contracting_boundary",
      points: [
        { timestamp: geometry.top.timestamp, value: geometry.top.value },
        {
          timestamp: geometry.rightUpper.timestamp,
          value: geometry.rightUpper.value,
        },
        apex,
      ],
      color: upperColor,
      width: 2,
      style: "solid",
    },
    {
      id: `diamond-lower-contracting-${entryTimestamp}`,
      kind: "diamond_lower_contracting_boundary",
      points: [
        { timestamp: geometry.bottom.timestamp, value: geometry.bottom.value },
        {
          timestamp: geometry.rightLower.timestamp,
          value: geometry.rightLower.value,
        },
        apex,
      ],
      color: lowerColor,
      width: 2,
      style: "solid",
    },
    {
      id: `diamond-target-${entryTimestamp}`,
      kind: "diamond_target",
      points: [
        { timestamp: pattern.pivots[5].timestamp, value: pattern.targetPrice },
        { timestamp: entryTimestamp, value: pattern.targetPrice },
      ],
      color: "#22c55e",
      width: 1,
      style: "dashed",
    },
    {
      id: `diamond-stop-${entryTimestamp}`,
      kind: "diamond_stop",
      points: [
        {
          timestamp: pattern.pivots[5].timestamp,
          value: pattern.stopLossPrice,
        },
        { timestamp: entryTimestamp, value: pattern.stopLossPrice },
      ],
      color: "#ef4444",
      width: 1,
      style: "dashed",
    },
  ];

  const points: StrategyFigurePoints[] = [
    {
      id: `diamond-pivots-${entryTimestamp}`,
      kind: `diamond_${pattern.kind}_pivots`,
      points: pattern.pivots.map(({ timestamp, value }) => ({
        timestamp,
        value,
      })),
      color: signalColor,
      radius: 4,
    },
    {
      id: `diamond-entry-${entryTimestamp}`,
      kind: "diamond_entry",
      points: [{ timestamp: entryTimestamp, value: entryPrice }],
      color: signalColor,
      radius: 5,
    },
  ];

  return { lines, points };
};
