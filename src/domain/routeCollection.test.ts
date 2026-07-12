import { describe, expect, it } from "vitest";
import { upsertGeneratedRoute } from "./routeCollection";
import type { MarathonRoute } from "./routeMetrics";

const baseRoute: MarathonRoute = {
  id: "profile-balanced",
  name: "综合平衡最优路线",
  color: "#005bbb",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: [[114.3, 30.6], [114.31, 30.6]],
  elevationProfile: [],
  metrics: {
    totalClimbM: 40,
    avgSlopePercent: 0.5,
    maxSlopePercent: 1.2,
    longSteepRatio: 0,
    sharpTurnRatio: 0.05,
    narrowRoadRatio: 0,
    supplyCoverageRatio: 0.9,
    medicalAvgIntervalKm: 4,
    parkingServiceScore: 80,
    shadeCoverageRatio: 0.6
  }
};

describe("routeCollection", () => {
  it("keeps previous profile results when another selection objective is generated", () => {
    const scenicRoute = {
      ...baseRoute,
      id: "profile-scenic",
      name: "景观体验最优路线",
      coordinates: [[114.32, 30.6], [114.33, 30.6]] as MarathonRoute["coordinates"]
    };
    const routes = upsertGeneratedRoute([baseRoute], scenicRoute);

    expect(routes.map((route) => route.id)).toEqual(["profile-balanced", "profile-scenic"]);
  });

  it("replaces the previous route for the same selection objective", () => {
    const updated = { ...baseRoute, lengthKm: 41.9 };
    const routes = upsertGeneratedRoute([baseRoute], updated);

    expect(routes).toHaveLength(1);
    expect(routes[0].lengthKm).toBe(41.9);
  });

  it("replaces an older route with the same displayed geometry", () => {
    const duplicateGeometryRoute = {
      ...baseRoute,
      id: "profile-scenic",
      name: "景观体验最优路线"
    };

    const routes = upsertGeneratedRoute([baseRoute], duplicateGeometryRoute);

    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe("profile-scenic");
  });
});
