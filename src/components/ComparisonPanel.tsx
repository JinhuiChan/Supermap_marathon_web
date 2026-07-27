import type { MarathonRoute, RouteScore, RouteSelectionProfile } from "../domain/routeMetrics";
import { compareRoutes } from "../domain/routeMetrics";

interface ComparisonPanelProps {
  routes: MarathonRoute[];
  selectionProfile?: RouteSelectionProfile;
}

export interface ComparisonRow extends RouteScore {
  comparisonIndex: number;
}

export function buildComparisonRows(scores: RouteScore[]): ComparisonRow[] {
  if (scores.length === 0) return [];

  const targetScores = scores.map((score) => score.profileScore);
  const minScore = Math.min(...targetScores);
  const maxScore = Math.max(...targetScores);

  if (maxScore === minScore) {
    return scores.map((score) => ({ ...score, comparisonIndex: 80 }));
  }

  return scores.map((score) => ({
    ...score,
    comparisonIndex: Math.round(65 + ((score.profileScore - minScore) / (maxScore - minScore)) * 25)
  }));
}

export function ComparisonPanel({ routes, selectionProfile = "balanced" }: ComparisonPanelProps) {
  const scores = compareRoutes(routes, selectionProfile);
  const rows = buildComparisonRows(scores);
  const winner = rows[0];

  if (routes.length < 2) {
    return (
      <section className="side-section">
        <h2>多路线对比</h2>
        <p className="muted">当前仅有 {routes.length} 条候选路线，生成或导入至少 2 条后可进行多路线比选。</p>
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
          原始目标分 {winner.profileScore}，对比指数 {winner.comparisonIndex}，推荐分 {winner.recommendationScore}，适配：{winner.runnerFit}
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
            <th>对比</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((score) => (
            <tr key={score.id}>
              <td>{score.rank}</td>
              <td>{score.name}</td>
              <td>{score.difficultyScore}</td>
              <td>{score.supportScore}</td>
              <td>{score.profileScore}</td>
              <td>{score.comparisonIndex}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bar-chart">
        <p className="comparison-note">对比指数用于当前候选方案内横向比较；原始目标分仍基于路线指标计算。</p>
        {rows.map((score) => (
          <div className="bar-row" key={score.id}>
            <span>
              {score.name}
              <small>原始目标分 {score.profileScore}</small>
            </span>
            <div>
              <i style={{ width: `${score.comparisonIndex}%` }} />
            </div>
            <b>{score.comparisonIndex}</b>
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
