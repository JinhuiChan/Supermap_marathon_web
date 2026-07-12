import { describe, expect, test } from "vitest";
import {
  buildRoadGraphFromGeoJson,
  filterRoadGeoJsonByBounds,
  filterRoadGeoJsonByRouteCorridor,
  mapOsmHighwayToRoadLevel
} from "./roadNetworkGeoJson";

describe("roadNetworkGeoJson", () => {
  test("classifies short link roads by their parent road level", () => {
    expect(mapOsmHighwayToRoadLevel("primary_link")).toBe("primary");
    expect(mapOsmHighwayToRoadLevel("secondary_link")).toBe("secondary");
    expect(mapOsmHighwayToRoadLevel("tertiary_link")).toBe("tertiary");
    expect(mapOsmHighwayToRoadLevel("trunk_link")).toBe("trunk");
    expect(mapOsmHighwayToRoadLevel("unclassified")).toBe("tertiary");
  });
  test("builds a graph from a LineString road feature", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", bridge: "yes" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.31, 30.61],
              [114.32, 30.62]
            ]
          }
        }
      ]
    });

    expect(graph.nodes.size).toBe(3);
    expect(graph.edges.size).toBe(2);
    expect([...graph.edges.values()].every((edge) => edge.roadLevel === "primary")).toBe(true);
    expect([...graph.edges.values()].every((edge) => edge.isBridge)).toBe(true);
    expect([...graph.edges.values()].every((edge) => edge.competitionSuitable)).toBe(true);
  });

  test("recognizes SuperMap boolean bridge flags from prepared OSM data", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", bridge: "T" },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        }
      ]
    });

    expect([...graph.edges.values()].every((edge) => edge.isBridge)).toBe(true);
  });

  test("preserves physical edge identity, source geometry, surface suitability, and terrain provenance", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {
          highway: "primary",
          surface: "asphalt",
          slope_mean: 1.8,
          slope_source: "wuhan_30m_slope_tif"
        },
        geometry: {
          type: "LineString",
          coordinates: [[114.3, 30.6], [114.301, 30.601]]
        }
      }]
    });

    const forward = [...graph.edges.values()][0];
    const reverse = graph.adjacency.get(forward.toNodeId)?.find((edge) => edge.id.endsWith("_rev"));

    expect(forward.physicalEdgeId).toBe(forward.id);
    expect(reverse?.physicalEdgeId).toBe(forward.physicalEdgeId);
    expect(forward.coordinates).toEqual([[114.3, 30.6], [114.301, 30.601]]);
    expect(reverse?.coordinates).toEqual([[114.301, 30.601], [114.3, 30.6]]);
    expect(forward.surfaceSuitable).toBe(true);
    expect(forward.terrainMeasured).toBe(true);
  });

  test("rejects explicitly soft road surfaces", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { highway: "primary", surface: "grass", slope_mean: 1 },
        geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.301, 30.6]] }
      }]
    });

    const edge = [...graph.edges.values()][0];
    expect(edge.surfaceSuitable).toBe(false);
    expect(edge.competitionSuitable).toBe(false);
  });

  test("does not merge road endpoints that are tens of metres apart", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", slope_mean: 1 },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.3001, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "primary", slope_mean: 1 },
          geometry: { type: "LineString", coordinates: [[114.3008, 30.6], [114.301, 30.6]] }
        }
      ]
    });

    expect(graph.nodes.size).toBe(4);
    const firstEnd = [...graph.edges.values()][0].toNodeId;
    const secondStart = [...graph.edges.values()][1].fromNodeId;
    expect(firstEnd).not.toBe(secondStart);
  });

  test("builds separate chains from a MultiLineString", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "cycleway", tunnel: "yes" },
          geometry: {
            type: "MultiLineString",
            coordinates: [
              [
                [114.3, 30.6],
                [114.31, 30.61]
              ],
              [
                [114.4, 30.62],
                [114.41, 30.63]
              ]
            ]
          }
        }
      ]
    });

    expect(graph.nodes.size).toBe(4);
    expect(graph.edges.size).toBe(2);
    expect([...graph.edges.values()].every((edge) => edge.roadLevel === "greenway")).toBe(true);
    expect([...graph.edges.values()].every((edge) => edge.isTunnel)).toBe(true);
  });

  test("skips malformed features", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: null },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [114.3, 30.6] } },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[114.3], ["bad", 30.6]]
          }
        }
      ]
    });

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
  });

  test("maps OSM highway tags to route road levels", () => {
    expect(mapOsmHighwayToRoadLevel("motorway")).toBe("motorway");
    expect(mapOsmHighwayToRoadLevel("cycleway")).toBe("greenway");
    expect(mapOsmHighwayToRoadLevel("living_street")).toBe("residential");
    expect(mapOsmHighwayToRoadLevel("unclassified")).toBe("tertiary");
  });

  test("marks narrow local road types as unsuitable for international marathon routing", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary" },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "footway" },
          geometry: { type: "LineString", coordinates: [[114.31, 30.6], [114.32, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "service" },
          geometry: { type: "LineString", coordinates: [[114.32, 30.6], [114.33, 30.6]] }
        }
      ]
    });

    const edges = [...graph.edges.values()];
    expect(edges.find((edge) => edge.roadLevel === "primary")?.competitionSuitable).toBe(true);
    expect(edges.find((edge) => edge.roadLevel === "greenway")?.competitionSuitable).toBe(false);
    expect(edges.find((edge) => edge.roadLevel === "service")?.competitionSuitable).toBe(false);
  });

  test("applies marathon road requirements for width, elevated roads, long tunnels, and wide greenways", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", width: 5.5 },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "primary", layer: 1, name: "elevated road" },
          geometry: { type: "LineString", coordinates: [[114.31, 30.6], [114.32, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "secondary", tunnel: "yes" },
          geometry: { type: "LineString", coordinates: [[114.32, 30.6], [114.335, 30.6]] }
        },
        {
          type: "Feature",
          properties: { highway: "cycleway", width: 8 },
          geometry: { type: "LineString", coordinates: [[114.335, 30.6], [114.345, 30.6]] }
        }
      ]
    });

    const edges = [...graph.edges.values()];
    expect(edges[0].competitionSuitable).toBe(false);
    expect(edges[0].roadWidthM).toBe(5.5);
    expect(edges[1].competitionSuitable).toBe(false);
    expect(edges[1].isElevated).toBe(true);
    expect(edges[2].competitionSuitable).toBe(false);
    expect(edges[2].isTunnel).toBe(true);
    expect(edges[3].roadLevel).toBe("greenway");
    expect(edges[3].competitionSuitable).toBe(true);
  });

  test("uses prepared marathon suitability attributes when present", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            highway: "secondary",
            control_ok: 0,
            impedance: 72,
            suitability: 28,
            slope_mean: 6
          },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        }
      ]
    });

    const edge = [...graph.edges.values()][0];
    expect(edge.competitionSuitable).toBe(false);
    expect(edge.slopeFiltered).toBe(false);
    expect(edge.baselineCost).toBeGreaterThan(edge.lengthKm * 1.72);
    expect(edge.impedanceBreakdown).toMatchObject({
      explicit: 72,
      constraint: 80
    });
    expect(edge.suitabilityScore).toBe(28);
    expect(edge.slopeMean).toBe(6);
  });

  test("adds slope resistance when explicit impedance is not present", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            highway: "primary",
            control_ok: 1,
            slope_mean: 6
          },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        }
      ]
    });

    const edge = [...graph.edges.values()][0];
    expect(edge.baselineCost).toBeGreaterThan(edge.lengthKm * 1.2);
    expect(edge.impedanceBreakdown?.slope).toBeGreaterThan(0);
  });

  test("uses decomposed raster slope impedance without double counting penalties", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            highway: "primary",
            control_ok: 0,
            impedance: 96,
            base_impedance: 10,
            slope_impedance: 6,
            constraint_impedance: 80,
            slope_mean: 2.4,
            slope_p85: 2.8,
            slope_source: "wuhan_30m_slope_tif",
            suitability: 4
          },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        }
      ]
    });

    const edge = [...graph.edges.values()][0];
    expect(edge.baselineCost).toBeCloseTo(edge.lengthKm * 1.96, 4);
    expect(edge.impedanceBreakdown).toMatchObject({
      explicit: 10,
      slope: 6,
      constraint: 80
    });
    expect(edge.slopeMean).toBe(2.4);
    expect(edge.suitabilityScore).toBe(4);
  });

  test("filters steep normal roads while preserving the named Wuhan Yangtze River Bridge exception", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            highway: "primary",
            control_ok: 1,
            name: "普通陡坡路段",
            slope_mean: 5.2,
            slope_max: 7.1
          },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        },
        {
          type: "Feature",
          properties: {
            highway: "trunk",
            control_ok: 0,
            name: "武汉长江大桥",
            bridge: "T",
            slope_mean: 8.8,
            slope_max: 25.4
          },
          geometry: { type: "LineString", coordinates: [[114.29, 30.55], [114.3, 30.55]] }
        }
      ]
    });

    const edges = [...graph.edges.values()];
    const steepRoad = edges.find((edge) => edge.roadName === "普通陡坡路段");
    const bridge = edges.find((edge) => edge.roadName === "武汉长江大桥");

    expect(steepRoad?.slopeMax).toBe(7.1);
    expect(steepRoad?.competitionSuitable).toBe(false);
    expect(bridge?.isRequiredRiverBridge).toBe(true);
    expect(bridge?.competitionSuitable).toBe(true);
  });

  test("filters road features to a planning bounds", () => {
    const filtered = filterRoadGeoJsonByBounds(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "inside" },
            geometry: {
              type: "LineString",
              coordinates: [
                [114.3, 30.6],
                [114.31, 30.61]
              ]
            }
          },
          {
            type: "Feature",
            properties: { name: "outside" },
            geometry: {
              type: "LineString",
              coordinates: [
                [114.8, 30.9],
                [114.81, 30.91]
              ]
            }
          },
          {
            type: "Feature",
            properties: { name: "multi" },
            geometry: {
              type: "MultiLineString",
              coordinates: [
                [
                  [114.7, 30.9],
                  [114.71, 30.91]
                ],
                [
                  [114.32, 30.62],
                  [114.33, 30.63]
                ]
              ]
            }
          }
        ]
      },
      { minLon: 114.25, minLat: 30.55, maxLon: 114.4, maxLat: 30.65 }
    );

    expect(filtered.features.map((feature) => feature.properties?.name)).toEqual(["inside", "multi"]);
  });

  test("filters road features to a route corridor", () => {
    const filtered = filterRoadGeoJsonByRouteCorridor(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "near" },
            geometry: {
              type: "LineString",
              coordinates: [
                [114.3, 30.6005],
                [114.31, 30.6105]
              ]
            }
          },
          {
            type: "Feature",
            properties: { name: "far" },
            geometry: {
              type: "LineString",
              coordinates: [
                [114.5, 30.8],
                [114.51, 30.81]
              ]
            }
          }
        ]
      },
      [
        [114.3, 30.6],
        [114.31, 30.61]
      ],
      0.2
    );

    expect(filtered.features.map((feature) => feature.properties?.name)).toEqual(["near"]);
  });
});
