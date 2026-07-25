import type { MarathonRoute } from "../domain/routeMetrics";
import { activeCityPackage, type CityPackage } from "../config/cityPackages";

interface CandidateRouteDrawerProps {
  routes: MarathonRoute[];
  cityPackage?: CityPackage;
  activeRouteId: string;
  comparedRouteIds: string[];
  generationStatus: string;
  onSelectRoute: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onAnalyzeRoute: (id: string) => void;
}

export function CandidateRouteDrawer({
  routes,
  cityPackage = activeCityPackage,
  activeRouteId,
  comparedRouteIds,
  generationStatus,
  onSelectRoute,
  onToggleCompare,
  onAnalyzeRoute
}: CandidateRouteDrawerProps) {
  return (
    <aside className="candidate-route-drawer" aria-label="候选方案抽屉">
      <div className="drawer-heading">
        <span>候选方案</span>
        <strong>{generationStatus}</strong>
      </div>
      <div className="drawer-route-list">
        {routes.length === 0 && (
          <div className="drawer-empty-state">
            <strong>请先生成推荐路线库</strong>
            <p>{`系统会基于${cityPackage.name}道路网络、POI 服务、阻力因子、赛事约束和参考廊道特征生成当前目标下的最优赛道。`}</p>
          </div>
        )}
        {routes.map((route) => {
          const selected = comparedRouteIds.includes(route.id);
          const risks = [
            (route.metrics.selfIntersectionCount ?? 0) > 0 ? "交织风险" : null,
            (route.metrics.localKnotCount ?? 0) > 0 ? "局部绕结" : null,
            (route.metrics.repeatedRoadRatio ?? 0) > 0 ? "道路重复" : null,
            route.metrics.sharpTurnRatio > 0.2 ? "急转偏多" : null
          ].filter((item): item is string => Boolean(item));

          return (
            <article className={`drawer-route-card ${route.id === activeRouteId ? "active" : ""}`} key={route.id}>
              <button type="button" className="route-title" onClick={() => onSelectRoute(route.id)}>
                <span style={{ backgroundColor: route.color }} />
                {route.name}
              </button>
              <div className="drawer-route-meta">
                <span>{route.lengthKm.toFixed(3)} km</span>
                <span>{route.lineage?.roadAligned ? "路网贴合" : "待贴合"}</span>
              </div>
              <div className="drawer-quality-grid">
                <span>爬升 {route.metrics.totalClimbM.toFixed(0)} m</span>
                <span>重复 {((route.metrics.repeatedRoadRatio ?? 0) * 100).toFixed(0)}%</span>
                <span>自交 {route.metrics.selfIntersectionCount ?? 0}</span>
                <span>连续误差 {(route.metrics.maxContinuityGapM ?? 0).toFixed(1)} m</span>
              </div>
              <div className="drawer-score-grid">
                <span><strong>{count(route.metrics.landmarkPassedCount)}</strong>控制点</span>
                <span><strong>{percent(route.metrics.roadAlignedRatio)}</strong>贴合</span>
                <span><strong>{percent(passableRoadRatio(route))}</strong>通行路</span>
              </div>
              <div className="drawer-risk-tags">
                {(risks.length > 0 ? risks : ["硬规则已通过"]).map((risk) => (
                  <b key={risk}>{risk}</b>
                ))}
              </div>
              <div className="drawer-actions">
                <label>
                  <input type="checkbox" checked={selected} onChange={() => onToggleCompare(route.id)} />
                  加入对比
                </label>
                <button type="button" onClick={() => onAnalyzeRoute(route.id)}>进入分析</button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function percent(value: number | undefined): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
}

function count(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

function passableRoadRatio(route: MarathonRoute): number | undefined {
  if (typeof route.metrics.mainRoadRatio === "number") return route.metrics.mainRoadRatio;
  if (typeof route.metrics.narrowRoadRatio !== "number") return undefined;
  return Math.max(0, 1 - route.metrics.narrowRoadRatio - (route.metrics.unsuitableRoadRatio ?? 0));
}
