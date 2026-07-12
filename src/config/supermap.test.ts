import { describe, expect, it } from "vitest";
import { superMapConfig } from "./supermap";

describe("superMapConfig", () => {
  it("uses the iDesktop-published WMS map layer as the SuperMap basemap", () => {
    expect(superMapConfig.wmsMapUrl).toBe("http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/wms111");
    expect(superMapConfig.wmsLayerName).toBe("0");
  });

  it("defaults to the iDesktop-published map and exposes no alternate public basemaps", () => {
    expect(superMapConfig.defaultBasemap).toBe("supermapDem");
    expect(superMapConfig.basemapPolicy).toContain("iDesktop");
    expect("localVectorBasemap" in superMapConfig).toBe(false);
    expect("onlineBasemap" in superMapConfig).toBe(false);
  });

  it("separates the full Wuhan road display layer from the lighter routing network", () => {
    expect(superMapConfig.displayRoadNetworkGeoJsonUrl).toBe("data/local-wuhan-road-network-osm.geojson");
    expect(superMapConfig.routingRoadNetworkGeoJsonUrl).toBe("data/local-wuhan-marathon-area-roads.geojson");
  });

  it("tracks the planned Wuhan GIS foundation services", () => {
    expect(superMapConfig.serviceUrls.roadMapWms).toContain("map-wuhan-road-network/wms111");
    expect(superMapConfig.serviceUrls.roadDataRest).toContain("data-wuhan-road-network/rest");
    expect(superMapConfig.serviceUrls.poiDataRest).toContain("data-wuhan-poi/rest");
    expect(superMapConfig.serviceUrls.constraintMapRest).toContain("map-wuhan-constraints/rest");
    expect(superMapConfig.serviceUrls.demSlopeMapRest).toContain("map-wuhan-dem-slope/rest");
  });
});
