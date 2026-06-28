import { describe, expect, it } from "vitest";
import { superMapConfig } from "./supermap";

describe("superMapConfig", () => {
  it("uses the DEM-only WMS sublayer so route geometry is controlled by the vector overlay", () => {
    expect(superMapConfig.wmsLayerName).toBe("0.0");
  });

  it("defaults to an online real-world basemap for the quick demo version", () => {
    expect(superMapConfig.defaultBasemap).toBe("online");
    expect(superMapConfig.onlineBasemap.tileUrl).toContain("openstreetmap.org");
    expect(superMapConfig.onlineBasemap.attribution).toContain("OpenStreetMap");
  });
});
