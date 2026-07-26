import { beforeAll, describe, expect, test } from "vitest";
import realWuhanRoadsText from "../../public/data/local-wuhan-marathon-area-roads.geojson?raw";
import { activeCityPackage } from "../config/cityPackages";
import type { Coordinate, MarathonRoute } from "../domain/routeMetrics";
import { evaluateRouteQuality } from "../domain/routeQuality";
import { haversineKm } from "../domain/roadAttributes";
import { buildWaypointRoute, waypointHitRadiusKm, waypointRoutePlans } from "./profileRoutePlanner";

const realWuhanRoads = JSON.parse(realWuhanRoadsText);
const minimumWaypointHitsByRouteId = new Map([
  ["waypoint-east-lake", 7],
  ["waypoint-riverside", 5],
  ["waypoint-city-scenic", 6]
]);
describe("osmMarathonRoute visible real-data waypoint routes", () => {
  const routesByPlan = new Map<string, MarathonRoute | null>();

  beforeAll(() => {
    for (const plan of waypointRoutePlans) {
      routesByPlan.set(plan.id, buildWaypointRoute(realWuhanRoads, plan, { maxAttempts: 5 }));
    }
  }, 60000);

  test("does not return non-compliant waypoint routes to the visible route drawer", () => {
    for (const plan of waypointRoutePlans) {
      const route = routesByPlan.get(plan.id) ?? null;

      expect(route === null || evaluateRouteQuality(route, { targetDistanceKm: plan.targetDistanceKm }).passed, plan.id).toBe(true);
    }
  }, 60000);

  test("returns quality-gated routes for the visible waypoint route buttons", () => {
    for (const plan of waypointRoutePlans) {
      const route = routesByPlan.get(plan.id) ?? null;

      expect(route, plan.id).not.toBeNull();
      expect(route!.lengthKm, plan.id).toBeCloseTo(plan.targetDistanceKm, 3);
      expect(evaluateRouteQuality(route!, { targetDistanceKm: plan.targetDistanceKm }), plan.id).toMatchObject({ passed: true, issues: [] });
      expect(route!.metrics.localBacktrackCount ?? 0, plan.id).toBeLessThanOrEqual(40);
    }
  }, 60000);

  test("keeps visible waypoint route buttons spatially distinct", () => {
    const routeSignatures = new Set<string>();

    for (const plan of waypointRoutePlans) {
      const route = routesByPlan.get(plan.id) ?? null;

      expect(route, plan.id).not.toBeNull();
      routeSignatures.add(JSON.stringify(route!.coordinates));
    }

    expect(routeSignatures.size).toBe(waypointRoutePlans.length);
  }, 60000);

  test("keeps riverside and city scenic routes from collapsing onto the same corridor", () => {
    const riverside = routesByPlan.get("waypoint-riverside");
    const cityScenic = routesByPlan.get("waypoint-city-scenic");

    expect(riverside).not.toBeNull();
    expect(cityScenic).not.toBeNull();
    expect(routeOverlapRatio(riverside!, cityScenic!, 0.1)).toBeLessThanOrEqual(0.7);
  }, 60000);

  test("keeps generated routes close to as many control points as current road quality allows", () => {
    for (const plan of waypointRoutePlans) {
      const route = routesByPlan.get(plan.id) ?? null;

      expect(route, plan.id).not.toBeNull();
      const summary = summarizeWaypointHits(route!, plan.waypoints.map((waypoint) => waypoint.coordinate), waypointHitRadiusKm);
      expect(summary.hitCount, plan.id).toBeGreaterThanOrEqual(minimumWaypointHitsByRouteId.get(plan.id) ?? 4);
    }
  }, 60000);

  test("generates a quality-gated route for the auto-recommended control-point plan", () => {
    const plan = activeCityPackage.routePlans.find((routePlan) => routePlan.id === "waypoint-auto-recommended");
    expect(plan).toBeDefined();

    const route = buildWaypointRoute(realWuhanRoads, plan!, { maxAttempts: 5 });

    expect(route).not.toBeNull();
    expect(route!.lengthKm, plan!.id).toBeCloseTo(plan!.targetDistanceKm, 3);
    expect(evaluateRouteQuality(route!, { targetDistanceKm: plan!.targetDistanceKm }), plan!.id).toMatchObject({ passed: true, issues: [] });
    expect(summarizeWaypointHits(route!, plan!.waypoints.map((waypoint) => waypoint.coordinate), waypointHitRadiusKm).hitCount).toBeGreaterThanOrEqual(5);
  }, 60000);

});

function summarizeWaypointHits(route: MarathonRoute, waypoints: Coordinate[], hitRadiusKm: number) {
  const hits = waypoints
    .map((waypoint) => nearestRouteDistanceKm(waypoint, route.coordinates))
    .filter((hit) => hit.distanceKm <= hitRadiusKm);

  return {
    hitCount: hits.length
  };
}

function routeOverlapRatio(first: MarathonRoute, second: MarathonRoute, thresholdKm: number): number {
  const firstOverlap = coordinateOverlapRatio(first.coordinates, second.coordinates, thresholdKm);
  const secondOverlap = coordinateOverlapRatio(second.coordinates, first.coordinates, thresholdKm);
  return Math.round(((firstOverlap + secondOverlap) / 2) * 100) / 100;
}

function coordinateOverlapRatio(first: Coordinate[], second: Coordinate[], thresholdKm: number): number {
  const overlapping = first.filter((coordinate) =>
    second.some((other) => haversineKm(coordinate, other) <= thresholdKm)
  );
  return overlapping.length / Math.max(1, first.length);
}

function nearestRouteDistanceKm(point: Coordinate, routeCoordinates: Coordinate[]) {
  let best = { distanceKm: Number.POSITIVE_INFINITY, alongKm: 0 };
  let walkedKm = 0;

  for (let index = 1; index < routeCoordinates.length; index++) {
    const from = routeCoordinates[index - 1];
    const to = routeCoordinates[index];
    const segmentKm = haversineKm(from, to);
    const projected = projectPointToSegment(point, from, to);
    const distanceKm = haversineKm(point, projected.coordinate);
    if (distanceKm < best.distanceKm) {
      best = {
        distanceKm,
        alongKm: walkedKm + segmentKm * projected.fraction
      };
    }
    walkedKm += segmentKm;
  }

  return best;
}

function projectPointToSegment(point: Coordinate, from: Coordinate, to: Coordinate) {
  const latitude = point[1];
  const projectedPoint = toPlanarKm(point, latitude);
  const projectedFrom = toPlanarKm(from, latitude);
  const projectedTo = toPlanarKm(to, latitude);
  const vectorX = projectedTo[0] - projectedFrom[0];
  const vectorY = projectedTo[1] - projectedFrom[1];
  const pointX = projectedPoint[0] - projectedFrom[0];
  const pointY = projectedPoint[1] - projectedFrom[1];
  const denominator = vectorX * vectorX + vectorY * vectorY;
  const fraction = denominator === 0
    ? 0
    : Math.max(0, Math.min(1, (pointX * vectorX + pointY * vectorY) / denominator));

  return {
    fraction,
    coordinate: [
      from[0] + (to[0] - from[0]) * fraction,
      from[1] + (to[1] - from[1]) * fraction
    ] as Coordinate
  };
}

function toPlanarKm(coordinate: Coordinate, latitude: number): [number, number] {
  const kmPerDegree = 111.32;
  return [
    coordinate[0] * kmPerDegree * Math.cos(latitude * Math.PI / 180),
    coordinate[1] * kmPerDegree
  ];
}
