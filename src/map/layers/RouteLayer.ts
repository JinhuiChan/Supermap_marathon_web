import type { MarathonRoute, Coordinate } from "../../domain/routeMetrics";

export interface RouteFeatureStyle {
  [key: string]: string | number | undefined;
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

function distanceToSegment(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const x = x1 + t * dx;
  const y = y1 + t * dy;

  return Math.hypot(px - x, py - y);
}

export function findNearestRouteId(
  routes: MarathonRoute[],
  coordinate: Coordinate,
  thresholdDegrees = 0.008
): string | null {
  let closest: string | null = null;
  let closestDistance = Infinity;

  for (const route of routes) {
    for (let index = 0; index < route.coordinates.length - 1; index += 1) {
      const distance = distanceToSegment(coordinate, route.coordinates[index], route.coordinates[index + 1]);
      if (distance < thresholdDegrees && distance < closestDistance) {
        closestDistance = distance;
        closest = route.id;
      }
    }
  }

  return closest;
}
