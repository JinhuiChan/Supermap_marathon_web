import { describe, expect, it } from "vitest";
import { superMapConfig } from "./supermap";

describe("superMapConfig", () => {
  it("uses the DEM-only WMS sublayer so route geometry is controlled by the vector overlay", () => {
    expect(superMapConfig.wmsLayerName).toBe("0.0");
  });
});
