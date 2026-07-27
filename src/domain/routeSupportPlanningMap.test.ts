import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "./routeMetrics";
import { buildSupportPlanningMapPoints } from "./routeSupportPlanningMap";

const route: MarathonRoute = {
  id: "support-route",
  name: "保障测试线",
  color: "#0f766e",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [
    [114.3, 30.6],
    [114.31, 30.61],
    [114.32, 30.62],
    [114.33, 30.63],
    [114.34, 30.64]
  ],
  elevationProfile: [],
  metrics: {
    totalClimbM: 58,
    avgSlopePercent: 0.7,
    maxSlopePercent: 2.4,
    longSteepRatio: 0.03,
    sharpTurnRatio: 0.08,
    narrowRoadRatio: 0.04,
    repeatedRoadRatio: 0,
    selfIntersectionCount: 0,
    supplyCoverageRatio: 0.78,
    medicalAvgIntervalKm: 4.5,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.46,
    bridgeDistanceKm: 1.8
  }
};

describe("routeSupportPlanningMap", () => {
  it("turns support planning recommendations into mileage-based map points", () => {
    const points = buildSupportPlanningMapPoints(route);

    expect(points.length).toBeGreaterThan(12);
    expect(points.map((point) => point.type)).toEqual(expect.arrayContaining(["补给", "医疗", "厕所", "引导"]));
    expect(points.find((point) => point.type === "补给" && point.mileageKm === 5)?.coordinate).toEqual([114.3, 30.6]);
    expect(points.find((point) => point.type === "医疗" && point.label.includes("半程"))?.mileageLabel).toContain("21.1km");
    expect(points.every((point) => point.routeId === "support-route")).toBe(true);
  });
});
