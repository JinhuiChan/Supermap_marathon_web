import { describe, expect, test } from "vitest";
import { buildOsmMarathonCandidateRoutes, buildOsmMarathonTestRoute } from "./osmMarathonRoute";
import { haversineKm } from "../domain/roadAttributes";

const smallRoadNetwork = {
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
    },
    {
      type: "Feature",
      properties: { highway: "cycleway" },
      geometry: {
        type: "LineString",
        coordinates: [
          [114.31, 30.6],
          [114.315, 30.605],
          [114.32, 30.61]
        ]
      }
    }
  ]
};

describe("osmMarathonRoute", () => {
  test("builds a target-distance test route from OSM-like roads", () => {
    const route = buildOsmMarathonTestRoute(
      smallRoadNetwork,
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

  test("builds three named candidate routes from one OSM road network", () => {
    const routes = buildOsmMarathonCandidateRoutes(smallRoadNetwork, {
      targetDistanceKm: 5,
      startPoint: [114.3, 30.6]
    });

    expect(routes).toHaveLength(3);
    expect(routes.map((route) => route.id)).toEqual([
      "osm-balanced",
      "osm-main-road",
      "osm-scenic"
    ]);
    expect(routes.every((route) => route.lineage?.roadAligned === true)).toBe(true);
    expect(routes.every((route) => route.lengthKm > 4.5 && route.lengthKm < 5.5)).toBe(true);
  });

  test("builds candidate routes between user-selected start and finish points", () => {
    const endPoint: [number, number] = [114.3, 30.61];
    const routes = buildOsmMarathonCandidateRoutes(smallRoadNetwork, {
      targetDistanceKm: 3.5,
      startPoint: [114.3, 30.6],
      endPoint
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].id).toContain("user-osm");
    expect(haversineKm(routes[0].coordinates.at(-1) ?? [0, 0], endPoint)).toBeLessThan(0.2);
  });

  test("prefers marathon-suitable arterial roads over narrow local roads", () => {
    const mixedRoadNetwork = {
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
              [114.34, 30.6],
              [114.35, 30.6]
            ]
          }
        },
        {
          type: "Feature",
          properties: { highway: "footway" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.305, 30.605],
              [114.31, 30.6]
            ]
          }
        },
        {
          type: "Feature",
          properties: { highway: "service" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.31, 30.6],
              [114.315, 30.605],
              [114.32, 30.6]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(mixedRoadNetwork, {
      id: "arterial-test",
      name: "Arterial test",
      targetDistanceKm: 3,
      startPoint: [114.3, 30.6]
    });

    expect(route).not.toBeNull();
    expect(route?.metrics.narrowRoadRatio).toBe(0);
  });

  test("does not create a marathon route by repeatedly overlapping the same road", () => {
    const shortRoadNetwork = {
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
              [114.32, 30.6]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(shortRoadNetwork, {
      id: "overlap-test",
      name: "Overlap test",
      targetDistanceKm: 5,
      startPoint: [114.3, 30.6]
    });

    expect(route).toBeNull();
  });

  test("rejects routes that contain an X-shaped self intersection", () => {
    const crossingRoadNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.31, 30.61],
              [114.3, 30.61],
              [114.31, 30.6]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(crossingRoadNetwork, {
      id: "crossing-test",
      name: "Crossing test",
      targetDistanceKm: 3.5,
      startPoint: [114.3, 30.6]
    });

    expect(route).toBeNull();
  });

  test("rejects routes with repeated sharp zigzag turns", () => {
    const zigzagRoadNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.31, 30.61],
              [114.302, 30.601],
              [114.312, 30.611],
              [114.304, 30.602]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(zigzagRoadNetwork, {
      id: "zigzag-test",
      name: "Zigzag test",
      targetDistanceKm: 5,
      startPoint: [114.3, 30.6]
    });

    expect(route).toBeNull();
  });

  test("rejects routes that quickly double back to the same local area", () => {
    const localLoopRoadNetwork = {
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
              [114.3008, 30.6002],
              [114.311, 30.6002]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(localLoopRoadNetwork, {
      id: "double-back-test",
      name: "Double back test",
      targetDistanceKm: 3,
      startPoint: [114.3, 30.6]
    });

    expect(route).toBeNull();
  });

  test("avoids short dead-end branches when a continuous arterial path is available", () => {
    const branchingRoadNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "trunk" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.3, 30.605]
            ]
          }
        },
        {
          type: "Feature",
          properties: { highway: "secondary" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.31, 30.6],
              [114.32, 30.6],
              [114.33, 30.6],
              [114.34, 30.6],
              [114.35, 30.6]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(branchingRoadNetwork, {
      id: "dead-end-test",
      name: "Dead-end test",
      targetDistanceKm: 3,
      startPoint: [114.3, 30.6]
    });

    expect(route).not.toBeNull();
    expect(route?.lengthKm).toBeCloseTo(3, 1);
  });

  test("uses nearby support POIs when computing generated route support metrics", () => {
    const roadNearParking = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.295, 30.561],
              [114.298, 30.561],
              [114.301, 30.561]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(roadNearParking, {
      id: "poi-test",
      name: "POI test",
      targetDistanceKm: 0.25,
      startPoint: [114.295, 30.561]
    });

    expect(route).not.toBeNull();
    expect(route?.metrics.parkingServiceScore).toBeGreaterThan(90);
  });
});
