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
    weight: isActive ? 5 : isCompared ? 2.6 : 1.8,
    opacity: isActive ? 1.0 : isCompared ? 0.58 : 0.28
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

export interface RouteDirectionMarker {
  coordinate: Coordinate;
  angleDeg: number;
}

export function buildRouteDirectionMarkers(
  route: MarathonRoute,
  markerCount = 8
): RouteDirectionMarker[] {
  if (route.coordinates.length < 2 || markerCount <= 0) return [];

  const segmentLengths = route.coordinates.slice(1).map((coordinate, index) =>
    Math.hypot(coordinate[0] - route.coordinates[index][0], coordinate[1] - route.coordinates[index][1])
  );
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);
  if (totalLength === 0) return [];

  const markers: RouteDirectionMarker[] = [];
  for (let markerIndex = 1; markerIndex <= markerCount; markerIndex++) {
    const targetLength = (totalLength * markerIndex) / (markerCount + 1);
    const marker = interpolateMarkerAtLength(route.coordinates, segmentLengths, targetLength);
    if (marker) markers.push(marker);
  }
  return markers;
}

function interpolateMarkerAtLength(
  coordinates: Coordinate[],
  segmentLengths: number[],
  targetLength: number
): RouteDirectionMarker | null {
  let walked = 0;

  for (let index = 0; index < segmentLengths.length; index++) {
    const segmentLength = segmentLengths[index];
    if (walked + segmentLength < targetLength) {
      walked += segmentLength;
      continue;
    }

    const start = coordinates[index];
    const end = coordinates[index + 1];
    const ratio = segmentLength === 0 ? 0 : (targetLength - walked) / segmentLength;
    return {
      coordinate: [
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio
      ],
      angleDeg: Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI
    };
  }

  return null;
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
