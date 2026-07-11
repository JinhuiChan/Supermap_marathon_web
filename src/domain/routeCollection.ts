import type { MarathonRoute } from "./routeMetrics";

export function upsertGeneratedRoute(routes: MarathonRoute[], route: MarathonRoute): MarathonRoute[] {
  const routeGeometryKey = geometryKey(route);
  const withoutSameRoute = routes.filter((item) => item.id !== route.id && geometryKey(item) !== routeGeometryKey);
  return [...withoutSameRoute, route];
}

function geometryKey(route: MarathonRoute): string {
  return route.coordinates
    .map((coordinate) => `${coordinate[0].toFixed(5)},${coordinate[1].toFixed(5)}`)
    .join("|");
}
