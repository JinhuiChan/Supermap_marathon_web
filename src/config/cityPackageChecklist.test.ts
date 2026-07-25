import { describe, expect, it } from "vitest";
import { activeCityPackage, type CityPackage } from "./cityPackages";
import { getCityPackageChecklist, summarizeCityPackageChecklist } from "./cityPackageChecklist";

describe("cityPackageChecklist", () => {
  it("marks the active Wuhan package as ready across required city data categories", () => {
    const checklist = getCityPackageChecklist(activeCityPackage);
    const summary = summarizeCityPackageChecklist(checklist);

    expect(summary).toEqual({ ready: checklist.length, total: checklist.length, blocking: 0 });
    expect(checklist.map((item) => item.id)).toEqual([
      "identity",
      "map-view",
      "supermap-services",
      "road-network",
      "route-plans",
      "support-points",
      "landmarks",
      "routing-profile",
      "terrain-and-constraints"
    ]);
  });

  it("reports blocking gaps for an incomplete new city package", () => {
    const incompletePackage: CityPackage = {
      ...activeCityPackage,
      id: "test-city",
      name: "测试城市",
      displayName: "测试城市马拉松",
      marathonName: "测试城市马拉松选线平台",
      mapCenter: [0, 0],
      routePlans: [],
      supportPoints: [],
      landmarks: [],
      routingProfile: {
        id: "test-routing",
        cityId: "test-city",
        landmarks: [],
        landmarkInfluenceRadiusKm: 0,
        riverBridgeNamePattern: /^$/,
        requiredRiverBridges: []
      },
      superMap: {
        ...activeCityPackage.superMap,
        displayRoadNetworkGeoJsonUrl: "",
        routingRoadNetworkGeoJsonUrl: "",
        routingRoadNetworkGeoJsonUrls: { area: "", fullOsm: "" },
        constraintLayerUrls: {
          waterArea: "",
          waterLine: "",
          sensitiveHospital: "",
          sensitiveSchool: "",
          parks: "",
          commercialPotential: "",
          trafficStation: ""
        },
        demDataPath: "",
        slopeDataPath: ""
      }
    };

    const checklist = getCityPackageChecklist(incompletePackage);
    const blockingIds = checklist.filter((item) => item.status === "blocking").map((item) => item.id);

    expect(blockingIds).toEqual([
      "road-network",
      "route-plans",
      "support-points",
      "landmarks",
      "routing-profile",
      "terrain-and-constraints"
    ]);
    expect(summarizeCityPackageChecklist(checklist)).toMatchObject({ blocking: 6 });
  });
});
