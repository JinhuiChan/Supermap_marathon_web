import { describe, expect, it } from "vitest";
import sourceText from "./osmMarathonRoute.ts?raw";

describe("osmMarathonRoute routing profile boundary", () => {
  it("reads routing landmarks through the active city routing profile instead of importing Wuhan landmarks directly", () => {
    expect(sourceText).toContain("activeCityRoutingProfile");
    expect(sourceText).not.toContain("wuhanLandmarkPoiLabels");
  });
});
