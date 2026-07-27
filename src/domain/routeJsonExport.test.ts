import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "./routeMetrics";
import { buildRouteJsonExport, buildRoutePlanJsonExport } from "./routeJsonExport";
import { activeCityPackage } from "../config/cityPackages";

const route: MarathonRoute = {
  id: "auto-route",
  name: "自动推荐线",
  color: "#7c3aed",
  lengthKm: 42.195,
  targetDistanceKm: 42.195,
  closedLoop: false,
  coordinates: [[114.3, 30.6], [114.36, 30.62]],
  elevationProfile: [],
  lineage: { source: "osm-generated", roadAligned: true, note: "test" },
  metrics: {
    totalClimbM: 80,
    avgSlopePercent: 0.8,
    maxSlopePercent: 4,
    longSteepRatio: 0,
    sharpTurnRatio: 0.04,
    narrowRoadRatio: 0.02,
    supplyCoverageRatio: 0.8,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 70,
    shadeCoverageRatio: 0.6
  }
};

describe("routeJsonExport", () => {
  it("exports a generated route with geometry, metrics, and SuperMap data provenance", () => {
    const data = JSON.parse(buildRouteJsonExport(route, activeCityPackage));

    expect(data.routeName).toBe("自动推荐线");
    expect(data.geometry.type).toBe("LineString");
    expect(data.metrics.lengthKm).toBe(42.195);
    expect(data.dataSource).toContain("SuperMap iServer");
    expect(data.cityPackage.name).toBe("武汉");
  });

  it("exports an auto-recommended control-point plan as reusable JSON", () => {
    const autoPlan = activeCityPackage.routePlans.find((plan) => plan.controlPointMode === "auto-recommended");
    expect(autoPlan).toBeTruthy();
    const data = JSON.parse(buildRoutePlanJsonExport(autoPlan!, activeCityPackage));

    expect(data.routeName).toBe(autoPlan!.name);
    expect(data.controlPointSource).toContain("自动推荐");
    expect(data.controlPoints.length).toBe(autoPlan!.waypoints.length);
    expect(data.controlPoints[0]).toHaveProperty("lon");
    expect(data.controlPoints[0]).toHaveProperty("lat");
  });
});
