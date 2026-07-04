import { scoreRoute, type MarathonRoute } from "../domain/routeMetrics";

interface CandidateRouteDrawerProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  generationStatus: string;
  onSelectRoute: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onAnalyzeRoute: (id: string) => void;
}

export function CandidateRouteDrawer({
  routes,
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
            <strong>请先在地图上设置起点和终点</strong>
            <p>系统会基于武汉道路网络、道路等级、POI 服务权重和阻力因子生成候选赛道。</p>
          </div>
        )}
        {routes.map((route) => {
          const score = scoreRoute(route);
          const selected = comparedRouteIds.includes(route.id);
          const venueScore = route.metrics.competitionReadinessScore ?? Math.round((100 - score.difficultyScore) * 0.45 + score.supportScore * 0.55);
          const risks = [
            (route.metrics.selfIntersectionCount ?? 0) > 0 ? "交织风险" : null,
            (route.metrics.localBacktrackCount ?? 0) > 0 ? "局部折返" : null,
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
                <span>{route.closedLoop ? "闭环赛道" : "非闭环赛道"}</span>
                <span>{route.lineage?.roadAligned ? "路网贴合" : "待贴合"}</span>
              </div>
              <div className="drawer-score-grid">
                <span><strong>{score.recommendationScore}</strong>推荐</span>
                <span><strong>{venueScore}</strong>办赛</span>
                <span><strong>{score.supportScore}</strong>保障</span>
              </div>
              <div className="drawer-risk-tags">
                {(risks.length > 0 ? risks : ["空间形态稳定"]).map((risk) => (
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
