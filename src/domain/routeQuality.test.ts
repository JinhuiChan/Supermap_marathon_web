import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "./routeMetrics";
import { evaluateRouteQuality } from "./routeQuality";

function validRoute(overrides: Partial<MarathonRoute> = {}): MarathonRoute {
  const metrics = {
    totalClimbM: 120,
    startFinishElevationDiffM: 0,
    netElevationDropM: 0,
    maxSingleClimbM: 12,
    maxContinuousSteepKm: 0.6,
    avgSlopePercent: 1.2,
    maxSlopePercent: 4.2,
    longSteepRatio: 0.02,
    sharpTurnRatio: 0.02,
    narrowRoadRatio: 0.02,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    localBacktrackCount: 0,
    localKnotCount: 0,
    revisitedNodeCount: 0,
    parallelBacktrackCount: 0,
    hairpinTurnCount: 0,
    sharpTurnDensityPerKm: 0.4,
    terrainCoverageRatio: 1,
    maxContinuityGapM: 0,
    unsuitableEdgeCount: 0,
    roadAlignedRatio: 1,
    supplyCoverageRatio: 0.8,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 85,
    shadeCoverageRatio: 0.6,
    ...(overrides.metrics ?? {})
  } as MarathonRoute["metrics"];

  return {
    id: "quality-route",
    name: "合规测试路线",
    color: "#005bbb",
    lengthKm: 42.21,
    closedLoop: true,
    coordinates: [[114.3, 30.6], [114.4, 30.6], [114.3, 30.6]],
    elevationProfile: [],
    lineage: { source: "osm-generated", roadAligned: true, note: "test" },
    ...overrides,
    metrics
  };
}

function issueCodes(route: MarathonRoute) {
  return evaluateRouteQuality(route).issues.map((issue) => issue.code);
}

describe("evaluateRouteQuality", () => {
  it("accepts a route only inside the conservative marathon distance window", () => {
    expect(evaluateRouteQuality(validRoute()).passed).toBe(true);
    expect(issueCodes(validRoute({ lengthKm: 42.194 }))).toContain("distance");
    expect(issueCodes(validRoute({ lengthKm: 42.238 }))).toContain("distance");
  });

  it("uses target-specific distance windows for half marathon routes", () => {
    const route = validRoute({ lengthKm: 21.0975 });

    expect(evaluateRouteQuality(route, { targetDistanceKm: 21.0975 }).passed).toBe(true);
    expect(evaluateRouteQuality(route).issues.map((issue) => issue.code)).toContain("distance");
    expect(evaluateRouteQuality(validRoute({ lengthKm: 21.12 }), { targetDistanceKm: 21.0975 }).issues.map((issue) => issue.code)).toContain("distance");
  });

  it("does not constrain the straight-line distance between start and finish", () => {
    const route = validRoute({
      coordinates: [[114.1, 30.6], [114.4, 30.6]]
    });

    expect(evaluateRouteQuality(route).passed).toBe(true);
    expect(issueCodes(route)).not.toContain("endpoint-separation");
  });

  it("rejects excessive downhill and climbing terrain", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        netElevationDropM: 43,
        totalClimbM: 181,
        maxSlopePercent: 5.1,
        maxContinuousSteepKm: 1.01
      }
    });

    expect(issueCodes(route)).toEqual(expect.arrayContaining([
      "net-drop",
      "total-climb",
      "max-grade",
      "continuous-steep"
    ]));
  });

  it("rejects repeated roads, backtracking, self intersections, and local knots", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        repeatedRoadRatio: 0.01,
        selfIntersectionCount: 1,
        localBacktrackCount: 1,
        localKnotCount: 1
      }
    });

    expect(issueCodes(route)).toEqual(expect.arrayContaining([
      "repeated-road",
      "backtrack",
      "self-intersection",
      "local-knot"
    ]));
  });

  it("rejects intersection revisits, parallel backtracks, hairpins, and excessive sharp-turn density", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        revisitedNodeCount: 1,
        parallelBacktrackCount: 1,
        hairpinTurnCount: 1,
        sharpTurnDensityPerKm: 1.6
      }
    });

    expect(issueCodes(route)).toEqual(expect.arrayContaining([
      "node-revisit",
      "parallel-backtrack",
      "hairpin-turn",
      "sharp-turn-density"
    ]));
  });

  it("does not call a nearby junction revisit a backtrack when no physical road is repeated", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        repeatedRoadRatio: 0,
        localBacktrackCount: 20
      }
    });

    expect(evaluateRouteQuality(route).passed).toBe(true);
    expect(issueCodes(route)).not.toContain("backtrack");
  });

  it("rejects excessive nearby returns even when physical road ids are not repeated", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        repeatedRoadRatio: 0,
        localBacktrackCount: 41
      }
    });

    expect(issueCodes(route)).toContain("backtrack");
  });

  it("rejects gaps, unsuitable roads, and coordinates that do not fully follow the road geometry", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        maxContinuityGapM: 10.1,
        unsuitableEdgeCount: 1,
        roadAlignedRatio: 0.99
      }
    });

    expect(issueCodes(route)).toEqual(expect.arrayContaining([
      "continuity-gap",
      "road-suitability",
      "road-alignment"
    ]));
  });

  it("rejects routes without measured terrain coverage", () => {
    const route = validRoute({
      metrics: {
        ...validRoute().metrics,
        terrainCoverageRatio: 0.94
      }
    });

    expect(issueCodes(route)).toContain("terrain-coverage");
  });
});
