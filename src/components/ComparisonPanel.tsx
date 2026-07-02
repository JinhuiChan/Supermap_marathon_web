import type { MarathonRoute, RouteSelectionProfile } from "../domain/routeMetrics";
import { compareRoutes } from "../domain/routeMetrics";

interface ComparisonPanelProps {
  routes: MarathonRoute[];
  selectionProfile?: RouteSelectionProfile;
}

export function ComparisonPanel({ routes, selectionProfile = "balanced" }: ComparisonPanelProps) {
  const scores = compareRoutes(routes, selectionProfile);
  const winner = scores[0];

  if (routes.length < 2) {
    return (
      <section className="side-section">
        <h2>多路线对比</h2>
        <p className="muted">请选择至少 2 条赛道加入对比。</p>
      </section>
    );
  }

  return (
    <section className="side-section comparison">
      <h2>多路线对比</h2>
      <div className="recommendation">
        <span>推荐方案</span>
        <strong>{winner.name}</strong>
        <p>
          目标分 {winner.profileScore}，推荐分 {winner.recommendationScore}，适配：{winner.runnerFit}
        </p>
      </div>
      <table className="compare-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>路线</th>
            <th>难度</th>
            <th>保障</th>
            <th>目标</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score) => (
            <tr key={score.id}>
              <td>{score.rank}</td>
              <td>{score.name}</td>
              <td>{score.difficultyScore}</td>
              <td>{score.supportScore}</td>
              <td>{score.profileScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bar-chart">
        {scores.map((score) => (
          <div className="bar-row" key={score.id}>
            <span>{score.name}</span>
            <div>
              <i style={{ width: `${score.profileScore}%` }} />
            </div>
            <b>{score.profileScore}</b>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 100 42" className="profile-chart" role="img" aria-label="多路线坡度剖面对比">
        <line x1="0" y1="38" x2="100" y2="38" />
        <line x1="0" y1="8" x2="100" y2="8" />
        {routes.map((route) => {
          const points = route.elevationProfile
            .map((point) => `${(point.km / 42.195) * 100},${38 - Math.min(point.elevation, 95) * 0.32}`)
            .join(" ");
          return <polyline key={route.id} points={points} fill="none" stroke={route.color} strokeWidth="1.5" />;
        })}
      </svg>
    </section>
  );
}
