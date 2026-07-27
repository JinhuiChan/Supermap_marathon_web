import type { MarathonRoute } from "../domain/routeMetrics";
import type { SupportPoint } from "../data/supportPoints";
import {
  analyzeRoute,
  routeAnalysisScoreWeights,
  superMapEvidenceChain,
  type RouteRiskLocationNote
} from "../domain/routeAnalysis";
import { evaluateRouteQuality } from "../domain/routeQuality";

interface RouteAnalysisPanelProps {
  route: MarathonRoute;
  supportPoints: SupportPoint[];
  onSelectRiskLocation?: (note: RouteRiskLocationNote) => void;
}

export function RouteAnalysisPanel({ route, supportPoints, onSelectRiskLocation }: RouteAnalysisPanelProps) {
  const analysis = analyzeRoute(route, supportPoints);
  const quality = evaluateRouteQuality(route, { targetDistanceKm: route.targetDistanceKm });
  const targetDistanceKm = route.targetDistanceKm ?? 42.195;
  const distanceDeltaM = Math.round((route.lengthKm - targetDistanceKm) * 1000);
  const roadAlignedPercent = Math.round((route.metrics.roadAlignedRatio ?? 0) * 100);

  return (
    <section className="side-section route-analysis">
      <h2>赛道分析</h2>
      <div className={`analysis-decision ${quality.passed ? "ready" : "review"}`}>
        <div>
          <span>路线状态</span>
          <strong>候选方案</strong>
          <p>{quality.passed ? "核心指标通过，可作为推荐方案进入比选。" : "存在风险复核项，需人工复核后再作为推荐方案。"}</p>
        </div>
        <dl>
          <div>
            <dt>推荐分</dt>
            <dd>{analysis.recommendationScore}/100</dd>
          </div>
          <div>
            <dt>里程偏差</dt>
            <dd>{distanceDeltaM >= 0 ? "+" : ""}{distanceDeltaM} m</dd>
          </div>
          <div>
            <dt>风险项</dt>
            <dd>{quality.issues.length}</dd>
          </div>
          <div>
            <dt>路网贴合</dt>
            <dd>{roadAlignedPercent}%</dd>
          </div>
        </dl>
        <p className="analysis-decision-note">
          是否建议进入比选：{quality.passed ? "建议进入比选" : "建议复核后进入比选"}；正式赛道需现场复核与认证测量。
        </p>
      </div>
      <div className="analysis-summary">
        <span>当前方案</span>
        <strong>{analysis.routeName}</strong>
        <p>{analysis.recommendation}</p>
      </div>
      <div className="analysis-list score-weights">
        <strong>评分体系</strong>
        <div className="score-weight-grid">
          {routeAnalysisScoreWeights.map((item) => (
            <article key={item.label} className="score-weight-item">
              <b>{item.label} {item.weight}%</b>
              <span style={{ width: `${item.weight}%` }} />
              <p>{item.basis}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="analysis-list supermap-evidence-chain">
        <strong>SuperMap 数据链路</strong>
        {superMapEvidenceChain.map((item) => (
          <p key={item}>{item}</p>
        ))}
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
      <div className="analysis-list segment-analysis">
        <strong>分段分析</strong>
        <div className="segment-analysis-grid">
          {analysis.segmentAnalysis.map((segment) => (
            <article key={segment.id} className={`segment-analysis-item risk-${segment.riskLevel}`}>
              <div>
                <b>{segment.rangeLabel}</b>
                <span>{segment.riskLevel}风险</span>
              </div>
              <strong>{segment.focus}</strong>
              <p>{segment.finding}</p>
              <small>{segment.recommendation}</small>
            </article>
          ))}
        </div>
      </div>
      <div className="analysis-list risk-location">
        <strong>风险定位说明</strong>
        {analysis.riskLocationNotes.length > 0 ? (
          analysis.riskLocationNotes.map((item) => (
            <article key={item.id} className="risk-location-item">
              <div>
                <b>{item.issue}</b>
                <button type="button" onClick={() => onSelectRiskLocation?.(item)}>定位到地图</button>
              </div>
              <p>{item.mileageHint}</p>
              <small>{item.mapHint} {item.action}</small>
            </article>
          ))
        ) : (
          <p>暂无硬性风险项；仍需结合地图里程标注完成现场复核。</p>
        )}
      </div>
      <div className="analysis-list optimization-actions">
        <strong>修改建议闭环</strong>
        {analysis.optimizationActions.map((item) => (
          <article key={item.id} className={`optimization-action priority-${item.priority}`}>
            <div>
              <b>{item.title}</b>
              <span>{item.priority}优先级</span>
            </div>
            <p>{item.trigger}</p>
            <small>{item.recommendation}</small>
          </article>
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
      <div className="analysis-list implementation-notes">
        <strong>落地复核与保障细化</strong>
        {analysis.implementationNotes.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
