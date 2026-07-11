import { describe, expect, test } from "vitest";
import realWuhanRoadsText from "../../public/data/local-wuhan-marathon-area-roads.geojson?raw";
import { haversineKm } from "../domain/roadAttributes";
import { evaluateRouteQuality } from "../domain/routeQuality";
import { buildOsmMarathonCandidateRoutes } from "./osmMarathonRoute";
import { buildBestRouteForSelectionProfile } from "./profileRoutePlanner";

const realWuhanRoads = JSON.parse(realWuhanRoadsText);

describe("osmMarathonRoute with real local Wuhan roads", () => {
  test("uses an OSM generated compliant route for the city-experience objective", () => {
    const route = buildBestRouteForSelectionProfile(realWuhanRoads, "scenic", {
      seedPoints: [[114.2955, 30.5488]]
    });

    expect(route).not.toBeNull();
    expect(route?.id).toBe("profile-scenic");
    expect(route?.lineage?.source).toBe("osm-generated");
    expect(evaluateRouteQuality(route!)).toMatchObject({ passed: true, issues: [] });
  }, 60000);

  test("generates full marathon candidates from preset scenario seeds", () => {
    const scenarioSeeds: Array<[number, number]> = [
      [114.2955, 30.5488]
    ];
    const routes = scenarioSeeds.flatMap((startPoint) =>
      buildOsmMarathonCandidateRoutes(realWuhanRoads, {
        targetDistanceKm: 42.195,
        startPoint,
        maxRoutes: 1,
        profileIds: ["osm-scenic"]
      }).slice(0, 1)
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].lengthKm).toBeCloseTo(42.195, 1);
    expect(routes[0].metrics.repeatedRoadRatio ?? 0).toBe(0);
    expect(evaluateRouteQuality(routes[0])).toMatchObject({ passed: true, issues: [] });
  }, 70000);

  test("uses different routes for materially different planning objectives", () => {
    const pbRoute = buildOsmMarathonCandidateRoutes(realWuhanRoads, {
      targetDistanceKm: 8,
      startPoint: [114.434059, 30.596715],
      maxRoutes: 1,
      profileIds: ["osm-main-road", "osm-balanced"]
    })[0];
    const cityRoute = buildOsmMarathonCandidateRoutes(realWuhanRoads, {
      targetDistanceKm: 42.195,
      startPoint: [114.2955, 30.5488],
      maxRoutes: 1,
      profileIds: ["osm-scenic"]
    })[0];

    expect(pbRoute).toBeDefined();
    expect(cityRoute).toBeDefined();
    expect(pbRoute?.coordinates).not.toEqual(cityRoute?.coordinates);
    expect(cityRoute?.id).toBe("osm-scenic");
    expect(evaluateRouteQuality(cityRoute!)).toMatchObject({ passed: true, issues: [] });
  }, 40000);

  test("does not draw a cross-river fly-line when the local road network is disconnected", () => {
    const finish: [number, number] = [114.286, 30.545];
    const routes = buildOsmMarathonCandidateRoutes(realWuhanRoads, {
      targetDistanceKm: 8,
      startPoint: [114.302, 30.604],
      endPoint: finish
    });

    expect(routes).toHaveLength(0);
  });

  test("keeps connected real-road routes aligned to the source road edges", () => {
    const start: [number, number] = [114.434059, 30.596715];
    const finish: [number, number] = [114.460393, 30.529725];
    const routes = buildOsmMarathonCandidateRoutes(realWuhanRoads, {
      targetDistanceKm: 8,
      startPoint: start,
      endPoint: finish
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].coordinates.length).toBeGreaterThan(2);
    expect(routes[0].lengthKm).toBeGreaterThan(5.5);
    expect(routes[0].lengthKm).toBeLessThan(12);
    expect(haversineKm(routes[0].coordinates[0], start)).toBeLessThan(0.2);
    expect(haversineKm(routes[0].coordinates.at(-1) ?? [0, 0], finish)).toBeLessThan(0.2);
  });
});
