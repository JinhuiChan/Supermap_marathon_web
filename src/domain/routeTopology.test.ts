import { describe, expect, it } from "vitest";
import { analyzeRouteTopology } from "./routeTopology";
import type { Coordinate } from "./routeMetrics";

describe("analyzeRouteTopology", () => {
  it("counts a repeated intersection node while allowing only final closure to the start", () => {
    const coordinates: Coordinate[] = [[114.3, 30.6], [114.31, 30.6], [114.31, 30.61], [114.3, 30.61], [114.3, 30.6]];

    expect(analyzeRouteTopology(coordinates, ["a", "b", "c", "b", "d"], 4).revisitedNodeCount).toBe(1);
    expect(analyzeRouteTopology(coordinates, ["a", "b", "c", "d", "a"], 4).revisitedNodeCount).toBe(0);
  });

  it("detects a thin rectangular parallel backtrack", () => {
    const coordinates: Coordinate[] = [
      [114.3, 30.6],
      [114.31, 30.6],
      [114.31, 30.601],
      [114.3, 30.601]
    ];

    expect(analyzeRouteTopology(coordinates, ["a", "b", "c", "d"], 2).parallelBacktrackCount).toBeGreaterThan(0);
  });

  it("detects a hairpin reversal", () => {
    const coordinates: Coordinate[] = [[114.3, 30.6], [114.31, 30.6], [114.301, 30.6001]];

    expect(analyzeRouteTopology(coordinates, ["a", "b", "c"], 2).hairpinTurnCount).toBe(1);
  });

  it("keeps a clean corridor at zero topology violations", () => {
    const coordinates: Coordinate[] = [[114.3, 30.6], [114.31, 30.6], [114.32, 30.602], [114.33, 30.605]];

    expect(analyzeRouteTopology(coordinates, ["a", "b", "c", "d"], 3)).toMatchObject({
      revisitedNodeCount: 0,
      parallelBacktrackCount: 0,
      hairpinTurnCount: 0
    });
  });
});
