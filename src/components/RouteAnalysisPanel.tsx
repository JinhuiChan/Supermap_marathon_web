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
      <h2>赛道分析</h2>
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
            <small className={`analysis-reliability ${card.reliability}`}>{card.reliability}</small>
            <p>{card.evidence}</p>
            <p className="analysis-source">来源：{card.source}</p>
            <p className="analysis-inputs">输入：{card.inputs.join(" / ")}</p>
          </article>
        ))}
      </div>
      <div className="analysis-list">
        <strong>事实摘要</strong>
        {analysis.highlights.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <div className="analysis-list risk">
        <strong>复核项</strong>
        {analysis.risks.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <div className="analysis-list support-plan">
        <strong>保障规划建议</strong>
        {analysis.supportPlan.map((item) => (
          <article key={item.type} className="support-plan-item">
            <b>{item.type}</b>
            <p>{item.recommendation}</p>
            <small>{item.basis}</small>
          </article>
        ))}
      </div>
      <div className="analysis-list evidence-scope">
        <strong>数据来源</strong>
        {analysis.dataSources.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
      <div className="analysis-list data-gaps">
        <strong>数据缺口</strong>
        {analysis.dataGaps.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
