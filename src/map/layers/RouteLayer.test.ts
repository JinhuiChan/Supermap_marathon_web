import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { buildRouteDirectionMarkers, computeRouteStyle, findNearestRouteId } from "./RouteLayer";

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

  it("builds direction markers along a route", () => {
    const markers = buildRouteDirectionMarkers(
      {
        ...route,
        coordinates: [
          [114.292, 30.584],
          [114.302, 30.584],
          [114.312, 30.584],
          [114.322, 30.584]
        ]
      },
      2
    );

    expect(markers).toHaveLength(2);
    expect(markers[0].coordinate[0]).toBeGreaterThan(114.292);
    expect(markers[0].angleDeg).toBeCloseTo(0, 0);
  });

  it("keeps compared routes visually quieter than the active route", () => {
    const activeStyle = computeRouteStyle(route, true, true);
    const comparedStyle = computeRouteStyle(route, false, true);

    expect(comparedStyle.weight).toBeLessThan(activeStyle.weight);
    expect(comparedStyle.opacity).toBeLessThan(activeStyle.opacity);
  });
});
