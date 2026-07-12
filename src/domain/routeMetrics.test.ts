import { describe, expect, it } from "vitest";
import { compareRoutes, getDifficultyLabel, routeSelectionProfiles, scoreRoute, scoreRouteForProfile } from "./routeMetrics";

const easyRoute = {
  id: "easy",
  name: "江滩平缓线",
  color: "#1f77b4",
  lengthKm: 42.195,
  closedLoop: true,
  coordinates: [
    [0, 0],
    [1, 1]
  ] as [number, number][],
  elevationProfile: [
    { km: 0, elevation: 24, slope: 0.2 },
    { km: 1, elevation: 25, slope: 0.4 }
  ],
  metrics: {
    totalClimbM: 88,
    avgSlopePercent: 0.7,
    maxSlopePercent: 2.4,
    longSteepRatio: 0.04,
    sharpTurnRatio: 0.08,
    turnPenaltyScore: 14,
    narrowRoadRatio: 0.06,
    supplyCoverageRatio: 0.92,
    medicalAvgIntervalKm: 4.2,
    parkingServiceScore: 86,
    shadeCoverageRatio: 0.68
  }
};

const hardRoute = {
  ...easyRoute,
  id: "hard",
  name: "东湖爬坡线",
  metrics: {
    ...easyRoute.metrics,
    totalClimbM: 410,
    avgSlopePercent: 3.8,
    maxSlopePercent: 8.2,
    longSteepRatio: 0.34,
    supplyCoverageRatio: 0.58,
    medicalAvgIntervalKm: 8.8
  }
};

describe("routeMetrics", () => {
  it("scores an easier route lower than a harder route", () => {
    expect(scoreRoute(easyRoute).difficultyScore).toBeLessThan(scoreRoute(hardRoute).difficultyScore);
  });

  it("labels difficulty from score", () => {
    expect(getDifficultyLabel(22)).toBe("精英 PB 友好");
    expect(getDifficultyLabel(52)).toBe("大众稳健完赛");
    expect(getDifficultyLabel(82)).toBe("高难度挑战");
  });

  it("sorts compared routes by recommendation score descending", () => {
    const result = compareRoutes([hardRoute, easyRoute]);
    expect(result[0].id).toBe("easy");
    expect(result[0].rank).toBe(1);
  });

  it("reranks routes for different selection profiles", () => {
    const flatLowSupportRoute = {
      ...easyRoute,
      id: "flat-low-support",
      name: "平缓低保障线",
      metrics: {
        ...easyRoute.metrics,
        totalClimbM: 60,
        avgSlopePercent: 0.5,
        maxSlopePercent: 1.8,
        supplyCoverageRatio: 0.32,
        medicalAvgIntervalKm: 9.5,
        parkingServiceScore: 35,
        shadeCoverageRatio: 0.24
      }
    };
    const supportedRollingRoute = {
      ...easyRoute,
      id: "supported-rolling",
      name: "保障完善起伏线",
      metrics: {
        ...easyRoute.metrics,
        totalClimbM: 220,
        avgSlopePercent: 2.4,
        maxSlopePercent: 5.8,
        longSteepRatio: 0.16,
        supplyCoverageRatio: 0.98,
        medicalAvgIntervalKm: 2.4,
        parkingServiceScore: 95,
        shadeCoverageRatio: 0.72
      }
    };

    expect(compareRoutes([supportedRollingRoute, flatLowSupportRoute], "pb-friendly")[0].id).toBe(
      "flat-low-support"
    );
    expect(compareRoutes([supportedRollingRoute, flatLowSupportRoute], "support-first")[0].id).toBe(
      "supported-rolling"
    );
  });

  it("penalizes routes with poor venue readiness even when terrain looks easy", () => {
    const venueReadyRoute = {
      ...easyRoute,
      id: "venue-ready",
      metrics: {
        ...easyRoute.metrics,
        competitionReadinessScore: 92,
        mainRoadRatio: 0.86,
        unsuitableRoadRatio: 0.02,
        repeatedRoadRatio: 0,
        selfIntersectionCount: 0
      }
    };
    const tangledRoute = {
      ...easyRoute,
      id: "tangled",
      metrics: {
        ...easyRoute.metrics,
        competitionReadinessScore: 42,
        mainRoadRatio: 0.3,
        unsuitableRoadRatio: 0.28,
        repeatedRoadRatio: 0.2,
        selfIntersectionCount: 3
      }
    };

    expect(compareRoutes([tangledRoute, venueReadyRoute])[0].id).toBe("venue-ready");
    expect(scoreRoute(tangledRoute).recommendationScore).toBeLessThan(scoreRoute(venueReadyRoute).recommendationScore);
  });

  it("offers only the two distinct decision-ready route objectives", () => {
    expect(routeSelectionProfiles.map((profile) => profile.id)).toEqual([
      "pb-friendly",
      "scenic"
    ]);
    expect(routeSelectionProfiles.map((profile) => profile.label)).toEqual([
      "竞速平坦",
      "城市体验"
    ]);
  });

  it("prioritizes landmark exposure for city experience without requiring a bridge", () => {
    const bridgeScenicRoute = {
      ...easyRoute,
      id: "bridge-scenic",
      metrics: {
        ...easyRoute.metrics,
        bridgeDistanceKm: 2.8,
        bridgeSegmentCount: 2,
        riverCrossingScore: 92,
        landmarkCoverageScore: 84,
        shadeCoverageRatio: 0.7
      }
    };
    const inlandRoute = {
      ...easyRoute,
      id: "inland",
      metrics: {
        ...easyRoute.metrics,
        bridgeDistanceKm: 0,
        bridgeSegmentCount: 0,
        riverCrossingScore: 8,
        landmarkCoverageScore: 35,
        shadeCoverageRatio: 0.75
      }
    };

    expect(compareRoutes([inlandRoute, bridgeScenicRoute], "scenic")[0].id).toBe("bridge-scenic");
    expect(scoreRouteForProfile(bridgeScenicRoute, "scenic").profileScore).toBeGreaterThan(
      scoreRouteForProfile(inlandRoute, "scenic").profileScore
    );
  });

  it("penalizes right-angle and acute zigzag turns more strongly", () => {
    const smoothRoute = {
      ...easyRoute,
      id: "smooth",
      metrics: {
        ...easyRoute.metrics,
        sharpTurnRatio: 0.03,
        turnPenaltyScore: 6
      }
    };
    const angularRoute = {
      ...easyRoute,
      id: "angular",
      metrics: {
        ...easyRoute.metrics,
        sharpTurnRatio: 0.2,
        turnPenaltyScore: 78
      }
    };

    expect(scoreRoute(angularRoute).difficultyScore - scoreRoute(smoothRoute).difficultyScore).toBeGreaterThanOrEqual(12);
    expect(compareRoutes([angularRoute, smoothRoute], "pb-friendly")[0].id).toBe("smooth");
  });
});
