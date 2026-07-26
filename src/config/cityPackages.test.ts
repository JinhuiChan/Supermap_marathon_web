import { describe, expect, it } from "vitest";
import { activeCityPackage, cityPackages, wuhanCityPackage } from "./cityPackages";

describe("cityPackages", () => {
  it("exposes Wuhan as the first reusable city package", () => {
    expect(activeCityPackage).toBe(wuhanCityPackage);
    expect(cityPackages).toEqual([wuhanCityPackage]);
    expect(wuhanCityPackage).toMatchObject({
      id: "wuhan",
      name: "武汉",
      mapCenter: [114.32, 30.58],
      mapZoom: 12
    });
  });

  it("keeps city-specific data and SuperMap services behind one package boundary", () => {
    expect(wuhanCityPackage.routePlans).toHaveLength(4);
    expect(wuhanCityPackage.routePlans.slice(0, 3).map((plan) => plan.id)).toEqual([
      "waypoint-east-lake",
      "waypoint-riverside",
      "waypoint-city-scenic"
    ]);
    expect(wuhanCityPackage.routePlans[3]).toMatchObject({
      id: "waypoint-auto-recommended",
      controlPointMode: "auto-recommended"
    });
    expect(wuhanCityPackage.supportPoints.length).toBeGreaterThan(0);
    expect(wuhanCityPackage.landmarks.length).toBeGreaterThan(0);
    expect(wuhanCityPackage.routingProfile.cityId).toBe("wuhan");
    expect(wuhanCityPackage.superMap.serviceUrls.roadMapWms).toContain("map-wuhan-road-network/wms111");
    expect(wuhanCityPackage.superMap.displayRoadNetworkGeoJsonUrl).toBe("data/local-wuhan-road-network-osm.geojson");
    expect(wuhanCityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm).toBe("data/local-wuhan-road-network-osm.geojson");
  });
});
