import type { CityPackage } from "./cityPackages";

export type CityPackageChecklistStatus = "ready" | "blocking";

export interface CityPackageChecklistItem {
  id:
    | "identity"
    | "map-view"
    | "supermap-services"
    | "road-network"
    | "route-plans"
    | "support-points"
    | "landmarks"
    | "routing-profile"
    | "terrain-and-constraints";
  label: string;
  status: CityPackageChecklistStatus;
  evidence: string;
}

export interface CityPackageChecklistSummary {
  ready: number;
  total: number;
  blocking: number;
}

export function getCityPackageChecklist(cityPackage: CityPackage): CityPackageChecklistItem[] {
  const superMapServiceCount = Object.values(cityPackage.superMap.serviceUrls).filter(hasText).length;
  const constraintLayerCount = Object.values(cityPackage.superMap.constraintLayerUrls).filter(hasText).length;
  const hasRoadNetwork = [
    cityPackage.superMap.displayRoadNetworkGeoJsonUrl,
    cityPackage.superMap.routingRoadNetworkGeoJsonUrl,
    cityPackage.superMap.routingRoadNetworkGeoJsonUrls.area,
    cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm
  ].every(hasText);
  const hasTerrainAndConstraints =
    hasText(cityPackage.superMap.demDataPath) &&
    hasText(cityPackage.superMap.slopeDataPath) &&
    constraintLayerCount === Object.keys(cityPackage.superMap.constraintLayerUrls).length;
  const hasRoutingProfile =
    cityPackage.routingProfile.cityId === cityPackage.id &&
    cityPackage.routingProfile.landmarkInfluenceRadiusKm > 0 &&
    cityPackage.routingProfile.requiredRiverBridges.length > 0 &&
    cityPackage.routingProfile.landmarks.length > 0;

  return [
    item("identity", "城市身份", hasText(cityPackage.id) && hasText(cityPackage.name) && hasText(cityPackage.marathonName), cityPackage.marathonName),
    item("map-view", "地图视图", isFiniteCoordinate(cityPackage.mapCenter) && cityPackage.mapZoom > 0, `${cityPackage.mapCenter.join(", ")} / zoom ${cityPackage.mapZoom}`),
    item("supermap-services", "SuperMap 服务", superMapServiceCount === Object.keys(cityPackage.superMap.serviceUrls).length, `${superMapServiceCount} 个 iServer 服务 URL`),
    item("road-network", "道路网络", hasRoadNetwork, cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm || "缺少路网 GeoJSON"),
    item("route-plans", "路线模板", cityPackage.routePlans.length > 0, `${cityPackage.routePlans.length} 条路线模板`),
    item("support-points", "保障服务点", cityPackage.supportPoints.length > 0, `${cityPackage.supportPoints.length} 个服务点`),
    item("landmarks", "地标 POI", cityPackage.landmarks.length > 0, `${cityPackage.landmarks.length} 个地标`),
    item("routing-profile", "算法策略", hasRoutingProfile, `${cityPackage.routingProfile.requiredRiverBridges.length} 条必经桥梁规则`),
    item("terrain-and-constraints", "地形与约束", hasTerrainAndConstraints, `${constraintLayerCount} 个约束图层`)
  ];
}

export function summarizeCityPackageChecklist(items: CityPackageChecklistItem[]): CityPackageChecklistSummary {
  const ready = items.filter((item) => item.status === "ready").length;
  const blocking = items.filter((item) => item.status === "blocking").length;
  return { ready, total: items.length, blocking };
}

function item(
  id: CityPackageChecklistItem["id"],
  label: string,
  ready: boolean,
  evidence: string
): CityPackageChecklistItem {
  return {
    id,
    label,
    status: ready ? "ready" : "blocking",
    evidence
  };
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteCoordinate(value: [number, number]): boolean {
  return value.length === 2 && value.every(Number.isFinite);
}
