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

  test("builds named candidate routes from one OSM road network", () => {
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

  test("can limit generated candidate profiles when the caller only needs the first route", () => {
    const routes = buildOsmMarathonCandidateRoutes(smallRoadNetwork, {
      targetDistanceKm: 5,
      startPoint: [114.3, 30.6],
      maxRoutes: 1
    });

    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe("osm-balanced");
  });

  test("does not inflate a short bridge check line into a full marathon candidate", () => {
    const shortBridgeOnlyNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            highway: "trunk",
            bridge: "T",
            name: "武汉长江大桥",
            control_ok: 0,
            slope_mean: 8
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.275, 30.557],
              [114.288, 30.549],
              [114.295, 30.547]
            ]
          }
        }
      ]
    };

    const routes = buildOsmMarathonCandidateRoutes(shortBridgeOnlyNetwork, {
      targetDistanceKm: 42.195,
      startPoint: [114.2955, 30.5488],
      maxRoutes: 1,
      profileIds: ["osm-river-scenic"]
    });

    expect(routes).toHaveLength(0);
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

  test("does not extend user-constrained routes by reusing the same road segment", () => {
    const routes = buildOsmMarathonCandidateRoutes(smallRoadNetwork, {
      targetDistanceKm: 5,
      startPoint: [114.3, 30.6],
      endPoint: [114.3, 30.61]
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].metrics.repeatedRoadRatio ?? 0).toBe(0);
  });

  test("prefers a Wuhan landmark corridor when an otherwise similar branch is available", () => {
    const landmarkChoiceNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", name: "arterial away from landmark" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.545],
              [114.3, 30.555],
              [114.3, 30.565]
            ]
          }
        },
        {
          type: "Feature",
          properties: { highway: "secondary", name: "yellow crane tower corridor" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.545],
              [114.3063, 30.5448],
              [114.3163, 30.5448],
              [114.3263, 30.5448]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(landmarkChoiceNetwork, {
      id: "landmark-choice",
      name: "Landmark choice",
      targetDistanceKm: 1.7,
      startPoint: [114.3, 30.545]
    });

    expect(route).not.toBeNull();
    const nearestLandmarkKm = Math.min(
      ...route!.coordinates.map((coordinate) => haversineKm(coordinate, [114.3063, 30.5448]))
    );
    expect(nearestLandmarkKm).toBeLessThan(0.15);
  });

  test("rejects same-point full marathon loops when the road network cannot meet race requirements", () => {
    const routes = buildOsmMarathonCandidateRoutes(smallRoadNetwork, {
      targetDistanceKm: 42.195,
      startPoint: [114.3, 30.6],
      endPoint: [114.3, 30.6]
    });

    expect(routes).toHaveLength(0);
  });

  test("rejects disconnected cross-river roads instead of drawing review fly-lines", () => {
    const disconnectedCrossRiverNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", name: "north approach" },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "primary", name: "marathon bridge", bridge: "T" },
          geometry: { type: "LineString", coordinates: [[114.32, 30.6], [114.32, 30.54]] }
        },
        {
          type: "Feature",
          properties: { highway: "primary", name: "south approach" },
          geometry: { type: "LineString", coordinates: [[114.33, 30.54], [114.34, 30.54]] }
        }
      ]
    };

    const routes = buildOsmMarathonCandidateRoutes(disconnectedCrossRiverNetwork, {
      targetDistanceKm: 42.195,
      startPoint: [114.3, 30.6],
      endPoint: [114.34, 30.54]
    });

    expect(routes).toHaveLength(0);
  });

  test("keeps cross-river user routing connected through bridge roads", () => {
    const connectedBridgeNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", name: "north approach" },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "primary", name: "river bridge", bridge: "T" },
          geometry: { type: "LineString", coordinates: [[114.31, 30.6], [114.32, 30.55]] }
        },
        {
          type: "Feature",
          properties: { highway: "secondary", name: "south approach" },
          geometry: { type: "LineString", coordinates: [[114.32, 30.55], [114.34, 30.54]] }
        },
        {
          type: "Feature",
          properties: { highway: "service", name: "narrow detour" },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.34, 30.54]] }
        }
      ]
    };

    const routes = buildOsmMarathonCandidateRoutes(connectedBridgeNetwork, {
      targetDistanceKm: 7,
      startPoint: [114.3, 30.6],
      endPoint: [114.34, 30.54]
    });

    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].coordinates.some((coordinate) => coordinate[1] < 30.56)).toBe(true);
    expect(routes[0].metrics.narrowRoadRatio).toBe(0);
    expect(haversineKm(routes[0].coordinates.at(-1) ?? [0, 0], [114.34, 30.54])).toBeLessThan(0.2);
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

  test("rejects generated routes that break marathon elevation requirements", () => {
    const steepRoadNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.37, 30.55],
              [114.38, 30.55],
              [114.39, 30.55],
              [114.4, 30.55],
              [114.41, 30.55],
              [114.42, 30.55]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(steepRoadNetwork, {
      id: "steep-test",
      name: "Steep test",
      targetDistanceKm: 3,
      startPoint: [114.37, 30.55]
    });

    expect(route).toBeNull();
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

  test("avoids compact junction knots when a continuous corridor is available", () => {
    const junctionKnotNetwork = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", name: "continuous arterial" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.305, 30.6],
              [114.31, 30.6],
              [114.315, 30.6],
              [114.32, 30.6],
              [114.325, 30.6],
              [114.33, 30.6]
            ]
          }
        },
        {
          type: "Feature",
          properties: { highway: "primary", name: "short triangular junction loop" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.305, 30.6],
              [114.307, 30.602],
              [114.309, 30.6002],
              [114.3056, 30.6001]
            ]
          }
        }
      ]
    };

    const route = buildOsmMarathonTestRoute(junctionKnotNetwork, {
      id: "junction-knot-test",
      name: "Junction knot test",
      targetDistanceKm: 2.3,
      startPoint: [114.3, 30.6]
    });

    expect(route).not.toBeNull();
    expect(route?.metrics.localKnotCount ?? 0).toBe(0);
    expect(route?.coordinates).not.toContainEqual([114.307, 30.602]);
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
