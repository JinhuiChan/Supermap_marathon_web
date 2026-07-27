import type { MarathonRoute } from "./routeMetrics";

const routeDisplayColorPalette = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#be185d",
  "#4f46e5",
  "#65a30d",
  "#ea580c"
];

export function upsertGeneratedRoute(routes: MarathonRoute[], route: MarathonRoute): MarathonRoute[] {
  const withoutSameId = routes.filter((item) => item.id !== route.id);
  return [...withoutSameId, withDistinctRouteColor(route, withoutSameId)];
}

export interface RouteWorkspaceState {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
}

export function removeGeneratedRoute(
  routes: MarathonRoute[],
  activeRouteId: string,
  comparedRouteIds: string[],
  routeId: string
): RouteWorkspaceState {
  const nextRoutes = routes.filter((route) => route.id !== routeId);
  return {
    routes: nextRoutes,
    activeRouteId: activeRouteId === routeId ? nextRoutes[0]?.id ?? "" : activeRouteId,
    comparedRouteIds: comparedRouteIds.filter((id) => id !== routeId)
  };
}

function withDistinctRouteColor(route: MarathonRoute, existingRoutes: MarathonRoute[]): MarathonRoute {
  const existingColors = existingRoutes.map((item) => item.color);
  if (isDistinctFromAll(route.color, existingColors)) return route;

  const color = routeDisplayColorPalette.find((candidate) =>
    isDistinctFromAll(candidate, existingColors)
  ) ?? route.color;
  return { ...route, color };
}

function isDistinctFromAll(color: string, existingColors: string[]): boolean {
  return existingColors.every((existing) => colorDistance(color, existing) >= 85);
}

function colorDistance(first: string, second: string): number {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  if (!a || !b) return first.toLowerCase() === second.toLowerCase() ? 0 : Number.POSITIVE_INFINITY;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hexToRgb(color: string): [number, number, number] | null {
  const match = color.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
