import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wuhanCityPackage } from "./cityPackages";

const autoPublishScript = readFileSync(
  new URL("../../scripts/auto_publish.py", import.meta.url),
  "utf8"
);

describe("SuperMap workspace publishing assets", () => {
  it("publishes every polygon constraint layer through the SuperMap workspace script", () => {
    for (const layerUrl of Object.values(wuhanCityPackage.superMap.constraintLayerUrls)) {
      const filename = layerUrl.split("/").at(-1);
      expect(filename).toBeTruthy();
      expect(autoPublishScript).toContain(filename);
    }

    expect(autoPublishScript).toContain("CONSTRAINT_MAP_NAME");
    expect(autoPublishScript).toContain("map-wuhan-constraints");
  });

  it("documents the iServer service names expected by the frontend", () => {
    expect(autoPublishScript).toContain("map-wuhan-road-network");
    expect(autoPublishScript).toContain("map-wuhan-constraints");
    expect(autoPublishScript).toContain("map-wuhan-dem-slope");
  });
});
