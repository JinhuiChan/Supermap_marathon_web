import { describe, expect, it } from "vitest";
import { activeCityPackage } from "./cityPackages";
import { parseCityPackageImportText } from "./cityPackageImport";

describe("cityPackageImport", () => {
  it("builds a runtime city package from imported JSON while preserving SuperMap defaults", () => {
    const result = parseCityPackageImportText(JSON.stringify({
      id: "changsha",
      name: "长沙",
      displayName: "长沙马拉松",
      marathonName: "长沙马拉松选线平台",
      mapCenter: [112.94, 28.23],
      mapZoom: 12,
      routingRoadNetworkGeoJsonUrl: "data/changsha/roads.geojson",
      displayRoadNetworkGeoJsonUrl: "data/changsha/roads.geojson",
      supportPointsUrl: "data/changsha/support.geojson",
      landmarksUrl: "data/changsha/landmarks.geojson"
    }), activeCityPackage);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cityPackage.name).toBe("长沙");
    expect(result.cityPackage.mapCenter).toEqual([112.94, 28.23]);
    expect(result.cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm).toBe("data/changsha/roads.geojson");
    expect(result.cityPackage.superMap.displayRoadNetworkGeoJsonUrl).toBe("data/changsha/roads.geojson");
    expect(result.cityPackage.superMap.iServerBaseUrl).toBe(activeCityPackage.superMap.iServerBaseUrl);
    expect(result.summary).toContain("长沙");
    expect(result.summary).toContain("roads.geojson");
  });

  it("rejects city packages without a city name or map center", () => {
    const result = parseCityPackageImportText(JSON.stringify({ name: "缺少中心点" }), activeCityPackage);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("mapCenter");
  });

  it("derives iClient Leaflet assets from an imported iServer base URL", () => {
    const result = parseCityPackageImportText(JSON.stringify({
      name: "Test City",
      mapCenter: [114, 30],
      iServerBaseUrl: "http://localhost:18090/iserver"
    }), activeCityPackage);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cityPackage.superMap.iClientJavaScriptUrl).toBe(
      "http://localhost:18090/iserver/iClient/forJavaScript/web/index.html"
    );
    expect(result.cityPackage.superMap.iClientLeafletScripts).toEqual([
      "http://localhost:18090/iserver/iClient/forJavaScript/web/libs/leaflet/1.9.4/leaflet.js",
      "http://localhost:18090/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet-es6.min.js"
    ]);
    expect(result.cityPackage.superMap.iClientLeafletStyleUrls).toEqual([
      "http://localhost:18090/iserver/iClient/forJavaScript/web/libs/leaflet/1.9.4/leaflet.css",
      "http://localhost:18090/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet.min.css"
    ]);
  });
});
