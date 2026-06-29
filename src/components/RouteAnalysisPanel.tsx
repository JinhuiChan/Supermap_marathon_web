import type { MarathonRoute } from "../domain/routeMetrics";
import type { SupportPoint } from "../data/supportPoints";
import { analyzeRoute } from "../domain/routeAnalysis";

interface RouteAnalysisPanelProps {
  route: MarathonRoute;
  supportPoints: SupportPoint[];
}

export function RouteAnalysisPanel({ route, supportPoints }: RouteAnalysisPanelProps) {
  const analysis = analyzeRoute(route, supportPoints);

  return (
    <section className="side-section route-analysis">
      <h2>路线研判</h2>
      <div className="analysis-summary">
        <span>当前方案</span>
        <strong>{analysis.routeName}</strong>
        <p>{analysis.recommendation}</p>
      </div>
      <div className="analysis-card-grid">
        {analysis.dimensionCards.map((card) => (
          <article className="analysis-card" key={card.id}>
            <div>
              <span>{card.label}</span>
              <strong>{card.score}</strong>
            </div>
            <b>{card.level}</b>
            <p>{card.evidence}</p>
          </article>
        ))}
      </div>
      <div className="analysis-list">
        <strong>推荐理由</strong>
        {analysis.highlights.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <div className="analysis-list risk">
        <strong>风险提示</strong>
        {analysis.risks.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
