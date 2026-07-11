import { describe, expect, it } from "vitest";
import { supportPoints } from "../data/supportPoints";
import type { MarathonRoute } from "./routeMetrics";
import { analyzeRoute, buildDecisionReport } from "./routeAnalysis";

const generatedRoute: MarathonRoute = {
  id: "profile-balanced",
  name: "综合平衡最优路线",
  color: "#005bbb",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [[114.302, 30.604], [114.34, 30.558]],
  elevationProfile: [],
  metrics: {
    totalClimbM: 58,
    avgSlopePercent: 0.7,
    maxSlopePercent: 2.4,
    longSteepRatio: 0.03,
    sharpTurnRatio: 0.08,
    turnPenaltyScore: 18,
    narrowRoadRatio: 0.04,
    competitionReadinessScore: 90,
    mainRoadRatio: 0.78,
    unsuitableRoadRatio: 0,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    supplyCoverageRatio: 0.92,
    medicalAvgIntervalKm: 4.2,
    parkingServiceScore: 86,
    shadeCoverageRatio: 0.68,
    landmarkCoverageScore: 82,
    riverCrossingScore: 64,
    bridgeDistanceKm: 1.8,
    bridgeSegmentCount: 1
  },
  lineage: {
    source: "osm-generated",
    roadAligned: true,
    note: "测试路线"
  }
};

describe("routeAnalysis", () => {
  it("turns generated route metrics into analysis cards", () => {
    const analysis = analyzeRoute(generatedRoute, supportPoints);

    expect(analysis.routeId).toBe("profile-balanced");
    expect(analysis.dimensionCards.map((card) => card.id)).toEqual([
      "terrain",
      "passage",
      "venue",
      "support",
      "experience"
    ]);
    expect(analysis.dimensionCards.find((card) => card.id === "venue")?.score).toBeGreaterThan(0);
    expect(analysis.dimensionCards.find((card) => card.id === "support")?.evidence).toContain("公厕");
  });

  it("builds a competition report without the deleted official vector route as baseline", () => {
    const report = buildDecisionReport([generatedRoute], supportPoints);

    expect(report).toContain("SuperMap iServer");
    expect(report).toContain("不采用已删除的 2026 官方道路级矢量路线");
    expect(report).not.toContain("2026 Wuhan Marathon official route reference");
    expect(report).toContain("推荐");
  });

  it("derives visibly different analysis scores from each route's real metrics", () => {
    const flatSupportedRoute: MarathonRoute = {
      ...generatedRoute,
      id: "flat-supported",
      metrics: {
        ...generatedRoute.metrics,
        totalClimbM: 42,
        sharpTurnRatio: 0.03,
        turnPenaltyScore: 8,
        supplyCoverageRatio: 0.94,
        medicalAvgIntervalKm: 3.2,
        landmarkCoverageScore: 76,
        riverCrossingScore: 58
      }
    };
    const angularLowSupportRoute: MarathonRoute = {
      ...generatedRoute,
      id: "angular-low-support",
      metrics: {
        ...generatedRoute.metrics,
        totalClimbM: 76,
        sharpTurnRatio: 0.22,
        turnPenaltyScore: 82,
        narrowRoadRatio: 0.18,
        supplyCoverageRatio: 0.48,
        medicalAvgIntervalKm: 8.4,
        parkingServiceScore: 42,
        landmarkCoverageScore: 24,
        riverCrossingScore: 12
      }
    };

    const better = analyzeRoute(flatSupportedRoute, supportPoints);
    const worse = analyzeRoute(angularLowSupportRoute, supportPoints);
    const betterScores = Object.fromEntries(better.dimensionCards.map((card) => [card.id, card.score]));
    const worseScores = Object.fromEntries(worse.dimensionCards.map((card) => [card.id, card.score]));

    expect(betterScores.passage).toBeGreaterThan(worseScores.passage);
    expect(betterScores.support).toBeGreaterThan(worseScores.support);
    expect(betterScores.experience).toBeGreaterThan(worseScores.experience);
    expect(new Set(worse.dimensionCards.map((card) => card.score)).size).toBeGreaterThan(2);
  });
});
