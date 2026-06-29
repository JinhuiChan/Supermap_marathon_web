import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { findNearestRouteId } from "./RouteLayer";

const route = {
  id: "river-loop",
  name: "两江四岸平缓线",
  color: "#1f77b4",
  lengthKm: 42.195,
  closedLoop: true,
  coordinates: [
    [114.292, 30.584],
    [114.305, 30.598]
  ],
  elevationProfile: [],
  metrics: {
    totalClimbM: 96,
    avgSlopePercent: 0.8,
    maxSlopePercent: 2.7,
    longSteepRatio: 0.05,
    sharpTurnRatio: 0.1,
    narrowRoadRatio: 0.07,
    supplyCoverageRatio: 0.93,
    medicalAvgIntervalKm: 4.1,
    parkingServiceScore: 88,
    shadeCoverageRatio: 0.62
  }
} satisfies MarathonRoute;

describe("RouteLayer", () => {
  it("selects a route when clicking near the middle of a segment", () => {
    expect(findNearestRouteId([route], [114.2985, 30.591], 0.001)).toBe("river-loop");
  });
});
