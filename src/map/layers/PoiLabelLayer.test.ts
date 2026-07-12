import { describe, expect, test } from "vitest";
import {
  extractPoiLabelsFromGeoJson,
  extractPoiLabelsFromSuperMapFeatures,
  formatPoiLabel,
  poiLabelDisplayMode,
  poiLabelVisual,
  shouldShowPoiLabelAtZoom,
  visiblePoiLimitForZoom
} from "./PoiLabelLayer";

describe("PoiLabelLayer", () => {
  test("extracts named point POIs directly", () => {
    const pois = extractPoiLabelsFromGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "三阳路", fclass: "station" },
            geometry: { type: "Point", coordinates: [114.303, 30.602] }
          }
        ]
      },
      "traffic"
    );

    expect(pois).toEqual([
      {
        id: "traffic-0",
        name: "三阳路",
        kind: "traffic",
        coordinate: [114.303, 30.602],
        minZoom: 10,
        priority: 100,
        source: "local"
      }
    ]);
  });

  test("creates POI labels from polygon centers for named area datasets", () => {
    const pois = extractPoiLabelsFromGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "解放公园" },
            geometry: {
              type: "Polygon",
              coordinates: [[
                [114.29, 30.61],
                [114.31, 30.61],
                [114.31, 30.63],
                [114.29, 30.63],
                [114.29, 30.61]
              ]]
            }
          }
        ]
      },
      "park"
    );

    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBe("解放公园");
    expect(pois[0].coordinate[0]).toBeCloseTo(114.3, 2);
    expect(pois[0].coordinate[1]).toBeCloseTo(30.62, 2);
  });

  test("formats Gaode-like icon labels by POI type", () => {
    expect(formatPoiLabel({ id: "h", name: "协和医院", kind: "hospital", coordinate: [114.3, 30.6] })).toContain("协和医院");
    expect(formatPoiLabel({ id: "h", name: "协和医院", kind: "hospital", coordinate: [114.3, 30.6] }, "icon")).not.toContain("map-poi-name");
    expect(poiLabelVisual("hospital")).toMatchObject({
      symbol: "医",
      color: "#d94b42"
    });
    expect(poiLabelVisual("traffic")).toMatchObject({
      symbol: "铁",
      color: "#2f6fd6"
    });
  });

  test("extracts POI labels from SuperMap iServer feature records with concrete names", () => {
    const pois = extractPoiLabelsFromSuperMapFeatures(
      [
        {
          fieldNames: ["SMID", "POINT_NAME", "POINT_TYPE"],
          fieldValues: ["1", "三阳路地铁站", "地铁站"],
          geometry: {
            center: { x: 114.303, y: 30.602 },
            type: "POINT"
          }
        },
        {
          fieldNames: ["FID", "LEVEL1_CN", "LEVEL2_CN"],
          fieldValues: ["2", "交通设施", "交通场站用地"],
          geometry: {
            center: { x: 114.31, y: 30.61 },
            type: "REGION"
          }
        }
      ],
      "traffic",
      { minZoom: 12 }
    );

    expect(pois).toHaveLength(1);
    expect(pois[0]).toMatchObject({
      id: "traffic-1",
      name: "三阳路地铁站",
      kind: "traffic",
      coordinate: [114.303, 30.602],
      minZoom: 12,
      source: "iserver"
    });
  });

  test("filters normal POI labels by zoom while preserving high-priority labels", () => {
    expect(shouldShowPoiLabelAtZoom({ id: "a", name: "协和医院", kind: "hospital", coordinate: [114.3, 30.6], minZoom: 10 }, 9)).toBe(false);
    expect(shouldShowPoiLabelAtZoom({ id: "a", name: "协和医院", kind: "hospital", coordinate: [114.3, 30.6], minZoom: 10 }, 10)).toBe(true);
    expect(shouldShowPoiLabelAtZoom({ id: "b", name: "大型交通点", kind: "traffic", coordinate: [114.3, 30.6], minZoom: 13, priority: 100 }, 11)).toBe(true);
  });

  test("does not label generic land-use area POIs without a concrete name", () => {
    const pois = extractPoiLabelsFromGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { Lon: 114.303, Lat: 30.602, Level2_cn: "医疗卫生用地" },
            geometry: { type: "Polygon", coordinates: [[[114.2, 30.5], [114.4, 30.5], [114.4, 30.7], [114.2, 30.5]]] }
          }
        ]
      },
      "hospital"
    );

    expect(pois).toHaveLength(0);
  });

  test("filters generic land-use names even when they appear in name fields", () => {
    const pois = extractPoiLabelsFromGeoJson(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "商业服务用地", Lon: 114.303, Lat: 30.602 },
            geometry: { type: "Point", coordinates: [114.303, 30.602] }
          },
          {
            type: "Feature",
            properties: { name: "首义广场", Lon: 114.31, Lat: 30.61 },
            geometry: { type: "Point", coordinates: [114.31, 30.61] }
          }
        ]
      },
      "commercial"
    );

    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBe("首义广场");
  });

  test("uses icon-only POIs at low zoom and expands text labels at high zoom", () => {
    const hospital = { id: "a", name: "协和医院", kind: "hospital" as const, coordinate: [114.3, 30.6] as [number, number], minZoom: 10 };
    const commercial = { id: "b", name: "楚河汉街", kind: "commercial" as const, coordinate: [114.3, 30.6] as [number, number], minZoom: 13 };

    expect(poiLabelDisplayMode(hospital, 10)).toBe("icon");
    expect(poiLabelDisplayMode(hospital, 13)).toBe("label");
    expect(poiLabelDisplayMode(commercial, 12)).toBe("hidden");
    expect(poiLabelDisplayMode(commercial, 13)).toBe("icon");
    expect(poiLabelDisplayMode(commercial, 15)).toBe("label");
  });

  test("raises the visible POI cap as users zoom in", () => {
    expect(visiblePoiLimitForZoom(10)).toBeLessThan(visiblePoiLimitForZoom(13));
    expect(visiblePoiLimitForZoom(13)).toBeLessThan(visiblePoiLimitForZoom(15));
  });
});
