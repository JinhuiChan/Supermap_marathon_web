import type { MarathonRoute } from "../domain/routeMetrics";
import { scoreRoute } from "../domain/routeMetrics";

interface RouteDetailsProps {
  route: MarathonRoute;
}

export function RouteDetails({ route }: RouteDetailsProps) {
  const score = scoreRoute(route);
  const metrics = route.metrics;

  return (
    <section className="side-section">
      <h2>单路线详情</h2>
      <div className="score-summary">
        <strong>{score.difficultyLabel}</strong>
        <span>综合推荐 {score.recommendationScore}</span>
      </div>
      <dl className="metric-grid">
        <div>
          <dt>总爬升</dt>
          <dd>{metrics.totalClimbM} m</dd>
        </div>
        <div>
          <dt>平均坡度</dt>
          <dd>{metrics.avgSlopePercent}%</dd>
        </div>
        <div>
          <dt>最大坡度</dt>
          <dd>{metrics.maxSlopePercent}%</dd>
        </div>
        <div>
          <dt>补给覆盖</dt>
          <dd>{Math.round(metrics.supplyCoverageRatio * 100)}%</dd>
        </div>
        <div>
          <dt>医疗间隔</dt>
          <dd>{metrics.medicalAvgIntervalKm} km</dd>
        </div>
        <div>
          <dt>遮阴覆盖</dt>
          <dd>{Math.round(metrics.shadeCoverageRatio * 100)}%</dd>
        </div>
      </dl>
    </section>
  );
}
