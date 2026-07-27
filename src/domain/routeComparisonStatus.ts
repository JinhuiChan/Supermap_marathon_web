import type { MarathonRoute } from "./routeMetrics";

export function countComparedCandidateRoutes(routes: MarathonRoute[], comparedRouteIds: string[]): number {
  const candidateRouteIds = new Set(routes.map((route) => route.id));
  const comparedCandidateRouteIds = new Set(comparedRouteIds.filter((id) => candidateRouteIds.has(id)));
  return comparedCandidateRouteIds.size;
}
