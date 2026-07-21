import { describe, expect, test } from "vitest";
import realWuhanRoadsText from "../../public/data/local-wuhan-marathon-area-roads.geojson?raw";
import { evaluateRouteQuality } from "../domain/routeQuality";
import { buildWaypointRoute, waypointRoutePlans } from "./profileRoutePlanner";

const realWuhanRoads = JSON.parse(realWuhanRoadsText);

describe("osmMarathonRoute visible real-data waypoint routes", () => {
  test("does not return non-compliant waypoint routes to the visible route drawer", () => {
    for (const plan of waypointRoutePlans) {
      const route = buildWaypointRoute(realWuhanRoads, plan, { maxAttempts: 5 });

      expect(route === null || evaluateRouteQuality(route, { targetDistanceKm: plan.targetDistanceKm }).passed, plan.id).toBe(true);
    }
  }, 60000);

  test("returns quality-gated routes for the visible waypoint route buttons", () => {
    for (const plan of waypointRoutePlans) {
      const route = buildWaypointRoute(realWuhanRoads, plan, { maxAttempts: 5 });

      expect(route, plan.id).not.toBeNull();
      expect(route!.lengthKm, plan.id).toBeCloseTo(plan.targetDistanceKm, 3);
      expect(evaluateRouteQuality(route!, { targetDistanceKm: plan.targetDistanceKm }), plan.id).toMatchObject({ passed: true, issues: [] });
      expect(route!.metrics.localBacktrackCount ?? 0, plan.id).toBeLessThanOrEqual(40);
    }
  }, 60000);

  test("keeps visible waypoint route buttons spatially distinct", () => {
    const routeSignatures = new Set<string>();

    for (const plan of waypointRoutePlans) {
      const route = buildWaypointRoute(realWuhanRoads, plan, { maxAttempts: 5 });

      expect(route, plan.id).not.toBeNull();
      routeSignatures.add(JSON.stringify(route!.coordinates));
    }

    expect(routeSignatures.size).toBe(waypointRoutePlans.length);
  }, 60000);
});
