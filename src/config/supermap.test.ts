import { describe, expect, it } from "vitest";
import { superMapConfig } from "./supermap";

describe("superMapConfig", () => {
  it("uses the iDesktop-published WMS map layer as the SuperMap basemap", () => {
    expect(superMapConfig.wmsMapUrl).toBe("http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/wms111");
    expect(superMapConfig.wmsLayerName).toBe("0");
  });

  it("defaults to the iDesktop-published map while keeping OpenStreetMap as a fallback option", () => {
    expect(superMapConfig.defaultBasemap).toBe("supermapDem");
    expect(superMapConfig.onlineBasemap.tileUrl).toContain("openstreetmap.org");
    expect(superMapConfig.onlineBasemap.attribution).toContain("OpenStreetMap");
  });

  it("separates the full Wuhan road display layer from the lighter routing network", () => {
    expect(superMapConfig.displayRoadNetworkGeoJsonUrl).toBe("data/local-wuhan-road-network-osm.geojson");
    expect(superMapConfig.routingRoadNetworkGeoJsonUrl).toBe("data/local-wuhan-marathon-area-roads.geojson");
  });
});
