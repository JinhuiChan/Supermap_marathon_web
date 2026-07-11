import { describe, expect, it } from "vitest";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { getVisibleMapRoutes } from "./SuperMapMap";

function makeRoute(id: string): MarathonRoute {
  return {
    id,
    name: id,
    color: "#0f5ca8",
    lengthKm: 1,
    closedLoop: false,
    coordinates: [
      [114, 30],
      [114.01, 30.01]
    ],
    elevationProfile: [],
    metrics: {
      totalClimbM: 0,
      avgSlopePercent: 0,
      maxSlopePercent: 0,
      longSteepRatio: 0,
      sharpTurnRatio: 0,
      narrowRoadRatio: 0,
      supplyCoverageRatio: 0.8,
      medicalAvgIntervalKm: 4,
      parkingServiceScore: 80,
      shadeCoverageRatio: 0.5
    }
  };
}

describe("getVisibleMapRoutes", () => {
  it("returns active and compared routes for the map", () => {
    const routes = [makeRoute("active"), makeRoute("checked"), makeRoute("unchecked")];

    expect(getVisibleMapRoutes(routes, "active", ["checked"]).map((route) => route.id)).toEqual(["active", "checked"]);
  });

  it("keeps the active route visible even when it is not checked for comparison", () => {
    const routes = [makeRoute("active"), makeRoute("unchecked")];

    expect(getVisibleMapRoutes(routes, "active", []).map((route) => route.id)).toEqual(["active"]);
  });

  it("returns no routes when the candidate route map layer is hidden", () => {
    const routes = [makeRoute("checked")];

    expect(getVisibleMapRoutes(routes, "checked", ["checked"], false)).toEqual([]);
  });
});
