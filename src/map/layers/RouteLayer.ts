import type { MarathonRoute, Coordinate } from "../../domain/routeMetrics";

export interface RouteFeatureStyle {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
}

export function toLeafletLatLngs(coordinates: Coordinate[]): [number, number][] {
  return coordinates.map(([lon, lat]) => [lat, lon]);
}

export function computeRouteStyle(
  route: MarathonRoute,
  isActive: boolean,
  isCompared: boolean
): RouteFeatureStyle {
  return {
    color: route.color,
    weight: isActive ? 5 : isCompared ? 3.5 : 2,
    opacity: isActive || isCompared ? 1.0 : 0.42
  };
}

export function formatRouteLabel(route: MarathonRoute): string {
  const km = route.lengthKm.toFixed(1);
  return `${route.name} (${km} km${route.closedLoop ? " 闭环" : ""})`;
}
