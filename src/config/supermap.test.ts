import { describe, expect, it } from "vitest";
import { superMapConfig } from "./supermap";

describe("superMapConfig", () => {
  it("keeps the iDesktop-published WMS endpoint for health checks and fallback", () => {
    expect(superMapConfig.wmsMapUrl).toBe("http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/wms111");
    expect(superMapConfig.wmsLayerName).toBe("0");
  });

  it("loads SuperMap iClient for JavaScript from the local iServer package", () => {
    expect(superMapConfig.iClientJavaScriptUrl).toBe("http://127.0.0.1:8090/iserver/iClient/forJavaScript/web/index.html");
    expect(superMapConfig.iClientLeafletScripts).toEqual([
      "http://127.0.0.1:8090/iserver/iClient/forJavaScript/web/libs/leaflet/1.9.4/leaflet.js",
      "http://127.0.0.1:8090/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet-es6.min.js"
    ]);
    expect(superMapConfig.iClientLeafletStyleUrls).toEqual([
      "http://127.0.0.1:8090/iserver/iClient/forJavaScript/web/libs/leaflet/1.9.4/leaflet.css",
      "http://127.0.0.1:8090/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet.min.css"
    ]);
    expect(superMapConfig.iClientLeafletScripts.join(" ")).not.toContain("unpkg.com");
    expect(superMapConfig.iClientLeafletScripts.join(" ")).not.toContain("include-leaflet.js");
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
    expect(superMapConfig.routingRoadNetworkGeoJsonUrls.area).toBe("data/local-wuhan-marathon-area-roads.geojson");
    expect(superMapConfig.routingRoadNetworkGeoJsonUrls.fullOsm).toBe("data/local-wuhan-road-network-osm.geojson");
  });

  it("tracks the planned Wuhan GIS foundation services", () => {
    expect(superMapConfig.serviceUrls.roadMapWms).toContain("map-wuhan-road-network/wms111");
    expect(superMapConfig.serviceUrls.roadDataRest).toContain("data-wuhan-road-network/rest");
    expect(superMapConfig.serviceUrls.poiDataRest).toContain("data-wuhan-poi/rest");
    expect(superMapConfig.serviceUrls.constraintMapRest).toContain("map-wuhan-constraints/rest");
    expect(superMapConfig.serviceUrls.demSlopeMapRest).toContain("map-wuhan-dem-slope/rest");
  });
});
