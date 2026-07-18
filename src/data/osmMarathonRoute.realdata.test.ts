import { describe, expect, test } from "vitest";
import realWuhanRoadsText from "../../public/data/local-wuhan-marathon-area-roads.geojson?raw";
import { evaluateRouteQuality } from "../domain/routeQuality";
import { buildOsmMarathonCandidateRoutes } from "./osmMarathonRoute";
import { buildBestRouteForSelectionProfile } from "./profileRoutePlanner";

const realWuhanRoads = JSON.parse(realWuhanRoadsText);

describe("osmMarathonRoute with real local Wuhan roads", () => {
  test("returns a quality-gated route for every visible selection goal", () => {
    const routeSignatures = new Set<string>();
    for (const profile of ["pb-friendly", "scenic"] as const) {
      const route = buildBestRouteForSelectionProfile(realWuhanRoads, profile);
      expect(route, profile).not.toBeNull();
      expect(evaluateRouteQuality(route!), profile).toMatchObject({ passed: true, issues: [] });
      expect(route!.metrics, profile).toMatchObject({
        revisitedNodeCount: 0,
        parallelBacktrackCount: 0,
        hairpinTurnCount: 0
      });
      expect(route!.metrics.sharpTurnDensityPerKm, profile).toBeLessThanOrEqual(1.5);
      routeSignatures.add(JSON.stringify(route!.coordinates));
    }
    expect(routeSignatures.size).toBe(2);
  }, 60000);

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
      [114.434059, 30.596715]
    ];
    const routes = scenarioSeeds.flatMap((startPoint) =>
      buildOsmMarathonCandidateRoutes(realWuhanRoads, {
        targetDistanceKm: 42.195,
        startPoint,
        maxRoutes: 1,
        profileIds: ["osm-scenic", "osm-balanced", "osm-main-road"]
      }).slice(0, 1)
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].lengthKm).toBeCloseTo(42.195, 1);
    expect(routes[0].metrics.repeatedRoadRatio ?? 0).toBe(0);
    expect(evaluateRouteQuality(routes[0])).toMatchObject({ passed: true, issues: [] });
  }, 70000);

  test("uses different routes for materially different planning objectives", () => {
    const pbRoute = buildBestRouteForSelectionProfile(realWuhanRoads, "pb-friendly");
    const cityRoute = buildBestRouteForSelectionProfile(realWuhanRoads, "scenic");

    expect(pbRoute).not.toBeNull();
    expect(cityRoute).not.toBeNull();
    expect(pbRoute?.coordinates).not.toEqual(cityRoute?.coordinates);
    expect(cityRoute?.id).toBe("profile-scenic");
    expect(evaluateRouteQuality(cityRoute!)).toMatchObject({ passed: true, issues: [] });
  }, 40000);

});
