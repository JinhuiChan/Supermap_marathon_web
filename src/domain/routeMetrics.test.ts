import { describe, expect, it } from "vitest";
import { compareRoutes, getDifficultyLabel, scoreRoute } from "./routeMetrics";

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
});
