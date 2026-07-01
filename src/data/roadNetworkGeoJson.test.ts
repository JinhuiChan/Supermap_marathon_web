import { describe, expect, test } from "vitest";
import {
  buildRoadGraphFromGeoJson,
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
});
