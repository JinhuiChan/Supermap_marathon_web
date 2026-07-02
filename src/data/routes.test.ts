import { describe, expect, it } from "vitest";
import { demoRoutes } from "./routes";

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const lonDelta = toRad(b[0] - a[0]);
  const latDelta = toRad(b[1] - a[1]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

function routeLengthKm(coordinates: [number, number][]) {
  return coordinates.slice(1).reduce((sum, coord, index) => sum + haversineKm(coordinates[index], coord), 0);
}

function hasPointNear(coordinates: [number, number][], target: [number, number], threshold = 0.012) {
  return coordinates.some((coord) => Math.abs(coord[0] - target[0]) < threshold && Math.abs(coord[1] - target[1]) < threshold);
}

describe("routes", () => {
  it("keeps only the official route before OSM test routes load", () => {
    expect(demoRoutes).toHaveLength(1);
    expect(demoRoutes[0].id).toBe("wuhan-marathon-2026");
  });

  it("uses a road-level vectorized official Wuhan Marathon route as the primary route", () => {
    const primary = demoRoutes[0];

    expect(primary.name).toContain("official");
    expect(primary.closedLoop).toBe(false);
    expect(primary.coordinates.length).toBeGreaterThan(20);
    expect(primary.coordinates[0]).toEqual([114.302, 30.604]);
    expect(primary.coordinates.at(-1)).toEqual([114.395, 30.635]);
  });

  it("keeps the official route close to the full marathon distance and key official corridors", () => {
    const primary = demoRoutes[0];
    const lengthKm = routeLengthKm(primary.coordinates);

    expect(primary.coordinates.length).toBeGreaterThan(80);
    expect(lengthKm).toBeGreaterThan(41);
    expect(lengthKm).toBeLessThan(44);
    expect(hasPointNear(primary.coordinates, [114.263, 30.568])).toBe(true);
    expect(hasPointNear(primary.coordinates, [114.296, 30.543])).toBe(true);
    expect(hasPointNear(primary.coordinates, [114.410, 30.582])).toBe(true);
    expect(hasPointNear(primary.coordinates, [114.463, 30.575])).toBe(true);
  });

  it("labels the official route as road-aligned reference data", () => {
    expect(demoRoutes[0].lineage).toMatchObject({
      source: "official-road-level",
      roadAligned: true
    });
  });
});
