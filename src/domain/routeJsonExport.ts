import type { CityPackage } from "../config/cityPackages";
import { controlPointSourceLabelForPlan, type WaypointRoutePlan } from "../data/profileRoutePlanner";
import type { MarathonRoute } from "./routeMetrics";

export function buildRouteJsonExport(route: MarathonRoute, cityPackage: CityPackage): string {
  return stableJson({
    schema: "supermap-marathon-route@1",
    routeId: route.id,
    routeName: route.name,
    cityPackage: {
      id: cityPackage.id,
      name: cityPackage.name,
      displayName: cityPackage.displayName
    },
    dataSource: [
      "SuperMap iServer",
      "SuperMap iServer WMS",
      "SuperMap iClient for JavaScript",
      "full road-network GeoJSON",
      "route metrics and topology analysis"
    ],
    geometry: {
      type: "LineString",
      coordinates: route.coordinates
    },
    metrics: {
      lengthKm: route.lengthKm,
      targetDistanceKm: route.targetDistanceKm ?? 42.195,
      totalClimbM: route.metrics.totalClimbM,
      maxSlopePercent: route.metrics.maxSlopePercent,
      repeatedRoadRatio: route.metrics.repeatedRoadRatio ?? 0,
      selfIntersectionCount: route.metrics.selfIntersectionCount ?? 0,
      roadAlignedRatio: route.metrics.roadAlignedRatio ?? 0
    },
    lineage: route.lineage ?? null
  });
}

export function buildRoutePlanJsonExport(plan: WaypointRoutePlan, cityPackage: CityPackage): string {
  return stableJson({
    schema: "supermap-marathon-control-points@1",
    routeId: plan.id,
    routeName: plan.name,
    cityPackage: {
      id: cityPackage.id,
      name: cityPackage.name,
      displayName: cityPackage.displayName
    },
    controlPointSource: controlPointSourceLabelForPlan(plan),
    targetDistanceKm: plan.targetDistanceKm,
    controlPoints: plan.waypoints.map((point) => ({
      name: point.label,
      lon: point.coordinate[0],
      lat: point.coordinate[1]
    }))
  });
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
