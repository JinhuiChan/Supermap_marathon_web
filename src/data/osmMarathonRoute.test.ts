import { describe, expect, test } from "vitest";
import { buildOsmMarathonTestRoute } from "./osmMarathonRoute";

describe("osmMarathonRoute", () => {
  test("builds a target-distance test route from OSM-like roads", () => {
    const route = buildOsmMarathonTestRoute(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { highway: "primary" },
            geometry: {
              type: "LineString",
              coordinates: [
                [114.3, 30.6],
                [114.31, 30.6],
                [114.32, 30.6],
                [114.33, 30.6],
                [114.34, 30.6]
              ]
            }
          },
          {
            type: "Feature",
            properties: { highway: "secondary" },
            geometry: {
              type: "LineString",
              coordinates: [
                [114.34, 30.6],
                [114.34, 30.61],
                [114.33, 30.61],
                [114.32, 30.61],
                [114.31, 30.61],
                [114.3, 30.61],
                [114.3, 30.6]
              ]
            }
          }
        ]
      },
      {
        id: "test-osm",
        name: "OSM test",
        targetDistanceKm: 5,
        startPoint: [114.3, 30.6]
      }
    );

    expect(route).not.toBeNull();
    expect(route?.lengthKm).toBeCloseTo(5, 1);
    expect(route?.lineage?.source).toBe("osm-generated");
    expect(route?.lineage?.roadAligned).toBe(true);
    expect(route?.coordinates.length).toBeGreaterThan(3);
  });
});
