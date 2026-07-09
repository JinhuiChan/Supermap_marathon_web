import { describe, expect, test } from "vitest";
import realWuhanRoadsText from "../../public/data/local-wuhan-marathon-area-roads.geojson?raw";
import { haversineKm } from "../domain/roadAttributes";
import { buildOsmMarathonCandidateRoutes } from "./osmMarathonRoute";

const realWuhanRoads = JSON.parse(realWuhanRoadsText);

describe("osmMarathonRoute with real local Wuhan roads", () => {
  test("connects a cross-river Hankou to Wuchang route through the local road network", () => {
    const finish: [number, number] = [114.286, 30.545];
    const routes = buildOsmMarathonCandidateRoutes(realWuhanRoads, {
      targetDistanceKm: 8,
      startPoint: [114.302, 30.604],
      endPoint: finish
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].coordinates.length).toBeGreaterThan(4);
    expect(routes[0].lengthKm).toBeGreaterThan(5);
    expect(routes[0].lengthKm).toBeLessThan(25);
    expect(haversineKm(routes[0].coordinates.at(-1) ?? [0, 0], finish)).toBeLessThan(0.8);
    expect(Math.min(...routes[0].coordinates.map((coordinate) => coordinate[1]))).toBeLessThan(30.56);
    expect(Math.max(...routes[0].coordinates.map((coordinate) => coordinate[1]))).toBeGreaterThan(30.59);
  });

  test("keeps same-bank short route lengths in a realistic range", () => {
    const finish: [number, number] = [114.33, 30.604];
    const routes = buildOsmMarathonCandidateRoutes(realWuhanRoads, {
      targetDistanceKm: 5,
      startPoint: [114.302, 30.604],
      endPoint: finish
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].coordinates.length).toBeGreaterThan(2);
    expect(routes[0].lengthKm).toBeGreaterThan(2);
    expect(routes[0].lengthKm).toBeLessThan(12);
    expect(haversineKm(routes[0].coordinates.at(-1) ?? [0, 0], finish)).toBeLessThan(0.8);
  });
});
