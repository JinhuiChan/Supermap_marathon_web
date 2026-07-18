import type { MarathonRoute } from "./routeMetrics";

export function upsertGeneratedRoute(routes: MarathonRoute[], route: MarathonRoute): MarathonRoute[] {
  // Only dedupe by ID — different route plans may share geometry near the start
  const withoutSameId = routes.filter((item) => item.id !== route.id);
  return [...withoutSameId, route];
}
