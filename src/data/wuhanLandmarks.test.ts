import { describe, expect, it } from "vitest";
import { wuhanLandmarkPoiLabels } from "./wuhanLandmarks";

describe("wuhanLandmarkPoiLabels", () => {
  it("adds named Wuhan landmarks and scenic POIs with high display priority", () => {
    const names = wuhanLandmarkPoiLabels.map((poi) => poi.name);

    expect(names).toContain("黄鹤楼");
    expect(names).toContain("东湖绿道");
    expect(names).toContain("武汉长江大桥");
    expect(wuhanLandmarkPoiLabels.every((poi) => typeof poi.priority === "number" && poi.priority >= 90)).toBe(true);
  });
});
