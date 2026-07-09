import { describe, expect, test } from "vitest";
import { extractVectorBasemapFeatures, vectorBasemapStyle } from "./VectorBasemapLayer";

describe("VectorBasemapLayer", () => {
  test("extracts polygon and multipolygon layers as Leaflet coordinates", () => {
    const features = extractVectorBasemapFeatures(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Yangtze River" },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [114.3, 30.6],
                [114.31, 30.6],
                [114.31, 30.61],
                [114.3, 30.6]
              ]]
            }
          },
          {
            type: "Feature",
            properties: { name: "East Lake Park" },
            geometry: {
              type: "MultiPolygon",
              coordinates: [[[
                [114.4, 30.55],
                [114.41, 30.55],
                [114.41, 30.56],
                [114.4, 30.55]
              ]]]
            }
          }
        ]
      },
      "park"
    );

    expect(features).toHaveLength(2);
    expect(features[0]).toMatchObject({
      kind: "park",
      label: "Yangtze River",
      geometryType: "polygon"
    });
    expect(features[0].coordinates[0][0]).toEqual([30.6, 114.3]);
  });

  test("extracts line layers for rivers and rail-like constraints", () => {
    const features = extractVectorBasemapFeatures(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Han River" },
            geometry: {
              type: "MultiLineString",
              coordinates: [
                [
                  [114.28, 30.58],
                  [114.29, 30.59]
                ]
              ]
            }
          }
        ]
      },
      "waterLine"
    );

    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      kind: "waterLine",
      label: "Han River",
      geometryType: "polyline"
    });
    expect(features[0].coordinates[0]).toEqual([30.58, 114.28]);
  });

  test("styles vector basemap layers like a readable street map", () => {
    expect(vectorBasemapStyle("waterArea")).toMatchObject({
      fillColor: "#b9def4",
      fillOpacity: 0.72
    });
    expect(vectorBasemapStyle("park")).toMatchObject({
      fillColor: "#cfead3",
      fillOpacity: 0.7
    });
    expect(vectorBasemapStyle("commercial")).toMatchObject({
      fillColor: "#f4ead1"
    });
  });
});
