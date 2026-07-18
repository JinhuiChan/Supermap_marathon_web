import { describe, expect, test } from "vitest";
import realWuhanRoadsText from "../../public/data/local-wuhan-marathon-area-roads.geojson?raw";
import { haversineKm } from "../domain/roadAttributes";
import { buildOsmMarathonCandidateRoutes } from "./osmMarathonRoute";

const realWuhanRoads = JSON.parse(realWuhanRoadsText);

describe("osmMarathonRoute real-road connectivity", () => {
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
