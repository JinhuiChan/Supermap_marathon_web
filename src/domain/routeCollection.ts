import type { MarathonRoute } from "./routeMetrics";

export function upsertGeneratedRoute(routes: MarathonRoute[], route: MarathonRoute): MarathonRoute[] {
  // Only dedupe by ID — different route plans may share geometry near the start
  const withoutSameId = routes.filter((item) => item.id !== route.id);
  return [...withoutSameId, route];
}

function geometryKey(route: MarathonRoute): string {
  return route.coordinates
    .map((coordinate) => `${coordinate[0].toFixed(5)},${coordinate[1].toFixed(5)}`)
    .join("|");
}
