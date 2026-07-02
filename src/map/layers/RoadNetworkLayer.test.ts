import { describe, expect, test } from "vitest";
import { extractRoadNetworkLines, roadNetworkStyle } from "./RoadNetworkLayer";

describe("RoadNetworkLayer", () => {
  test("extracts LineString and MultiLineString coordinates as Leaflet lat-lngs", () => {
    const lines = extractRoadNetworkLines({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary" },
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
          properties: { highway: "secondary" },
          geometry: {
            type: "MultiLineString",
            coordinates: [
              [
                [114.32, 30.62],
                [114.33, 30.63]
              ]
            ]
          }
        }
      ]
    });

    expect(lines).toEqual([
      [
        [30.6, 114.3],
        [30.61, 114.31]
      ],
      [
        [30.62, 114.32],
        [30.63, 114.33]
      ]
    ]);
  });

  test("prioritizes stronger road classes when limiting the overlay", () => {
    const lines = extractRoadNetworkLines(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { highway: "service" },
            geometry: { type: "LineString", coordinates: [[114.1, 30.1], [114.11, 30.11]] }
          },
          {
            type: "Feature",
            properties: { highway: "trunk" },
            geometry: { type: "LineString", coordinates: [[114.2, 30.2], [114.21, 30.21]] }
          }
        ]
      },
      1
    );

    expect(lines).toEqual([[[30.2, 114.2], [30.21, 114.21]]]);
  });

  test("uses a subtle non-interactive style", () => {
    expect(roadNetworkStyle()).toMatchObject({
      color: "#5f6f7f",
      interactive: false
    });
  });
});
