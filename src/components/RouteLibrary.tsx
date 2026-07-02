import { scoreRoute, type MarathonRoute } from "../domain/routeMetrics";

interface RouteLibraryProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  generationStatus: string;
  canGenerate: boolean;
  onSelectRoute: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onGenerateRoutes: () => void;
}

export function RouteLibrary({
  routes,
  activeRouteId,
  comparedRouteIds,
  generationStatus,
  canGenerate,
  onSelectRoute,
  onToggleCompare,
  onGenerateRoutes
}: RouteLibraryProps) {
  return (
    <section className="side-section">
      <h2>候选赛道库</h2>
      <div className="route-generator-actions">
        <button type="button" disabled={!canGenerate} onClick={onGenerateRoutes}>
          生成 OSM 候选路线
        </button>
        <span>{generationStatus}</span>
      </div>
      <div className="route-list">
        {routes.map((route) => {
          const selected = comparedRouteIds.includes(route.id);
          const roadAligned = route.lineage?.roadAligned === true;
          const score = scoreRoute(route);
          const venueScore = route.metrics.competitionReadinessScore ?? Math.round((100 - score.difficultyScore) * 0.45 + score.supportScore * 0.55);

          return (
            <article className={`route-card ${route.id === activeRouteId ? "active" : ""}`} key={route.id}>
              <button type="button" className="route-title" onClick={() => onSelectRoute(route.id)}>
                <span style={{ backgroundColor: route.color }} />
                {route.name}
              </button>
              <span className={`route-lineage ${roadAligned ? "aligned" : "pending"}`}>
                {roadAligned ? "来自道路网络" : "待贴合真实路网"}
              </span>
              <p>
                {route.lengthKm.toFixed(3)} km · {route.closedLoop ? "闭环" : "非闭环"}
              </p>
              <div className="route-score-strip" aria-label={`${route.name}评分`}>
                <span>
                  <strong>{score.recommendationScore}</strong>
                  推荐
                </span>
                <span>
                  <strong>{score.difficultyScore}</strong>
                  难度
                </span>
                <span>
                  <strong>{score.supportScore}</strong>
                  保障
                </span>
                <span>
                  <strong>{venueScore}</strong>
                  办赛
                </span>
              </div>
              <label className="compare-toggle">
                <input type="checkbox" checked={selected} onChange={() => onToggleCompare(route.id)} />
                加入对比
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
