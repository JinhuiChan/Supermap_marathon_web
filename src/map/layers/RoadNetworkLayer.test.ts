import { describe, expect, test } from "vitest";
import {
  DEFAULT_ROAD_NETWORK_LINE_LIMIT,
  extractRoadNetworkFeatures,
  extractRoadNetworkLines,
  formatRoadNetworkPopup,
  roadLabelKey,
  roadNetworkStyle,
  shouldShowRoadLabel
} from "./RoadNetworkLayer";

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

  test("keeps road attributes for labels and inspection popups", () => {
    const roads = extractRoadNetworkFeatures({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            name: "Yanjiang Avenue",
            highway: "primary",
            fclass: "primary",
            bridge: "yes",
            impedance: 12.5,
            suitability: 88
          },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.61]] }
        }
      ]
    });

    expect(roads).toHaveLength(1);
    expect(roads[0]).toMatchObject({
      label: "Yanjiang Avenue",
      highway: "primary",
      isBridge: true,
      impedance: 12.5,
      suitability: 88
    });
    expect(formatRoadNetworkPopup(roads[0])).toContain("Yanjiang Avenue");
    expect(formatRoadNetworkPopup(roads[0])).toContain("primary");
    expect(formatRoadNetworkPopup(roads[0])).toContain("88");
  });

  test("keeps enough default road lines for a full Wuhan network overlay", () => {
    expect(DEFAULT_ROAD_NETWORK_LINE_LIMIT).toBeGreaterThan(50000);
  });

  test("keeps permanent labels sparse and deduplicated for highway segments", () => {
    const roads = extractRoadNetworkFeatures({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "4th Ring Road", highway: "trunk" },
          geometry: { type: "LineString", coordinates: [[114.3, 30.6], [114.31, 30.6]] }
        },
        {
          type: "Feature",
          properties: { name: "4th Ring Road", highway: "trunk" },
          geometry: { type: "LineString", coordinates: [[114.31, 30.6], [114.32, 30.6]] }
        },
        {
          type: "Feature",
          properties: { name: "Neighborhood Lane", highway: "residential" },
          geometry: { type: "LineString", coordinates: [[114.32, 30.6], [114.33, 30.6]] }
        }
      ]
    });

    const shown = new Set<string>();
    const visibleLabels = roads.filter((road) => {
      const key = roadLabelKey(road);
      if (!key || shown.has(key)) return false;
      if (!shouldShowRoadLabel(road, shown.size)) return false;
      shown.add(key);
      return true;
    });

    expect(visibleLabels.map((road) => road.label)).toEqual(["4th Ring Road"]);
  });

  test("styles arterial roads like a readable vector basemap", () => {
    expect(roadNetworkStyle({ highway: "primary" })).toMatchObject({
      color: "#f2f4f7",
      weight: 4.2,
      interactive: true
    });
  });
});
