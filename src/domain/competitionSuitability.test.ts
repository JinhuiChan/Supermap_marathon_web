import { describe, expect, it } from "vitest";
import type { RoadEdge } from "./roadNetwork";
import { summarizeMarathonSuitability } from "./competitionSuitability";

function edge(id: string, roadLevel: RoadEdge["roadLevel"], lengthKm = 1): RoadEdge {
  return {
    id,
    fromNodeId: `${id}-from`,
    toNodeId: `${id}-to`,
    lengthKm,
    roadLevel,
    isBridge: false,
    isTunnel: false,
    competitionSuitable: roadLevel === "trunk" || roadLevel === "primary" || roadLevel === "secondary" || roadLevel === "tertiary",
    baselineCost: lengthKm
  };
}

describe("competitionSuitability", () => {
  it("rewards arterial roads and penalizes unsuitable local roads", () => {
    const summary = summarizeMarathonSuitability(
      [
        [114.3, 30.6],
        [114.31, 30.6],
        [114.32, 30.6],
        [114.33, 30.6]
      ],
      [edge("primary-a", "primary", 2), edge("service-b", "service", 1)],
      3
    );

    expect(summary.mainRoadRatio).toBeCloseTo(0.67, 2);
    expect(summary.unsuitableRoadRatio).toBeCloseTo(0.33, 2);
    expect(summary.score).toBeLessThan(90);
  });

  it("detects self intersections and repeated road use", () => {
    const summary = summarizeMarathonSuitability(
      [
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0]
      ],
      [edge("a", "primary", 1), edge("b", "primary", 1), edge("a_rev", "primary", 1)],
      3
    );

    expect(summary.selfIntersectionCount).toBe(1);
    expect(summary.repeatedRoadRatio).toBeCloseTo(0.33, 2);
    expect(summary.score).toBeLessThan(85);
  });

  it("detects short local double-backs even without self intersection", () => {
    const summary = summarizeMarathonSuitability(
      [
        [114.3, 30.6],
        [114.315, 30.6],
        [114.3008, 30.6002],
        [114.316, 30.6002]
      ],
      [edge("a", "primary", 1), edge("b", "primary", 1), edge("c", "primary", 1)],
      3
    );

    expect(summary.selfIntersectionCount).toBe(0);
    expect(summary.localBacktrackCount).toBeGreaterThan(0);
    expect(summary.score).toBeLessThan(95);
  });

  it("detects compact local knots around one junction", () => {
    const summary = summarizeMarathonSuitability(
      [
        [114.3, 30.6],
        [114.302, 30.602],
        [114.304, 30.6],
        [114.302, 30.598],
        [114.3005, 30.5997],
        [114.298, 30.598]
      ],
      [
        edge("a", "primary", 0.35),
        edge("b", "primary", 0.35),
        edge("c", "primary", 0.35),
        edge("d", "primary", 0.35),
        edge("e", "primary", 0.9)
      ],
      2.3
    );

    expect(summary.selfIntersectionCount).toBe(0);
    expect(summary.localKnotCount).toBeGreaterThan(0);
    expect(summary.score).toBeLessThan(88);
  });
});
