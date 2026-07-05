import { describe, expect, test } from "vitest";
import {
  buildRoadGraphFromGeoJson,
  filterRoadGeoJsonByBounds,
  filterRoadGeoJsonByRouteCorridor,
  mapOsmHighwayToRoadLevel
} from "./roadNetworkGeoJson";

describe("roadNetworkGeoJson", () => {
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
    expect(mapOsmHighwayToRoadLevel("unclassified")).toBe("residential");
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
            slope_mean: 4.5
          },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        }
      ]
    });

    const edge = [...graph.edges.values()][0];
    expect(edge.competitionSuitable).toBe(false);
    expect(edge.baselineCost).toBeCloseTo(edge.lengthKm * 1.72);
    expect(edge.suitabilityScore).toBe(28);
    expect(edge.slopeMean).toBe(4.5);
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
