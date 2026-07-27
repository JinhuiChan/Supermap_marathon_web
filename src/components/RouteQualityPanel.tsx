import type { MarathonRoute } from "../domain/routeMetrics";
import { evaluateRouteQuality, type RouteQualityIssue } from "../domain/routeQuality";

export function RouteQualityPanel({ route }: { route: MarathonRoute | null }) {
  if (!route) {
    return (
      <section className="side-section route-quality-panel empty">
        <span className="quality-eyebrow">候选赛道风险复核</span>
        <h2>等待候选路线</h2>
        <p>生成路线后，这里会逐项展示距离、坡度、道路贴合、交叉口复访和折返检测证据。</p>
        <CertificationNotice />
      </section>
    );
  }

  const report = evaluateRouteQuality(route, { targetDistanceKm: route.targetDistanceKm });
  const metrics = route.metrics;
  const rows = [
    ["规划里程", `${route.lengthKm.toFixed(3)} km`],
    ["起终点直线距离（参考）", `${report.endpointSeparationKm.toFixed(3)} km`],
    ["累计爬升", `${metrics.totalClimbM.toFixed(0)} m`],
    ["最大坡度", `${metrics.maxSlopePercent.toFixed(1)}%`],
    ["重复道路", `${((metrics.repeatedRoadRatio ?? 0) * 100).toFixed(0)}%`],
    ["自交", `${metrics.selfIntersectionCount ?? 0}`],
    ["局部绳结", `${metrics.localKnotCount ?? 0}`],
    ["交叉口复访", `${metrics.revisitedNodeCount ?? 0}`],
    ["平行折返", `${metrics.parallelBacktrackCount ?? 0}`],
    ["发卡掉头", `${metrics.hairpinTurnCount ?? 0}`],
    ["急弯密度", `${(metrics.sharpTurnDensityPerKm ?? 0).toFixed(2)} 次/km`],
    ["连续误差", `${(metrics.maxContinuityGapM ?? 0).toFixed(1)} m`],
    ["路网贴合", `${((metrics.roadAlignedRatio ?? 0) * 100).toFixed(0)}%`]
  ];

  return (
    <section className={`side-section route-quality-panel ${report.passed ? "passed" : "failed"}`}>
      <span className="quality-eyebrow">候选赛道风险复核</span>
      <h2>{report.passed ? "核心指标通过" : "风险复核项"}</h2>
      <p className="quality-route-name">{route.name} · 候选赛道</p>
      <dl className="quality-fact-grid">
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {report.issues.length > 0 ? (
        <table className="quality-issue-table">
          <thead>
            <tr>
              <th>复核项</th>
              <th>当前值</th>
              <th>阈值</th>
              <th>风险等级</th>
              <th>处理建议</th>
            </tr>
          </thead>
          <tbody>
            {report.issues.map((issue) => (
              <tr key={issue.code}>
                <td>{issue.label}</td>
                <td>{formatIssueActual(issue)}</td>
                <td>{formatIssueLimit(issue)}</td>
                <td>{getIssueSeverity(issue)}</td>
                <td>{getIssueAction(issue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <CertificationNotice />
    </section>
  );
}

function formatIssueActual(issue: RouteQualityIssue) {
  if (typeof issue.actual === "boolean") return issue.actual ? "是" : "否/缺失";
  if (issue.code === "repeated-road" || issue.code === "terrain-coverage") return `${Math.round(issue.actual * 100)}%`;
  if (issue.code === "distance" || issue.code === "continuous-steep") return `${issue.actual.toFixed(3)} km`;
  if (issue.code === "net-drop" || issue.code === "total-climb" || issue.code === "continuity-gap") return `${issue.actual.toFixed(1)} m`;
  if (issue.code === "max-grade") return `${issue.actual.toFixed(1)}%`;
  if (issue.code === "sharp-turn-density") return `${issue.actual.toFixed(2)} 次/km`;
  return `${issue.actual}`;
}

function formatIssueLimit(issue: RouteQualityIssue) {
  if (typeof issue.limit === "boolean") return issue.limit ? "应为是" : "应为否";
  if (issue.code === "terrain-coverage") return `≥ ${Math.round(issue.limit * 100)}%`;
  if (issue.code === "repeated-road") return `≤ ${Math.round(issue.limit * 100)}%`;
  if (issue.code === "distance") return `≤ ${issue.limit.toFixed(3)} km`;
  if (issue.code === "continuous-steep") return `≤ ${issue.limit.toFixed(1)} km`;
  if (issue.code === "net-drop" || issue.code === "total-climb" || issue.code === "continuity-gap") return `≤ ${issue.limit.toFixed(1)} m`;
  if (issue.code === "max-grade") return `≤ ${issue.limit.toFixed(0)}%`;
  if (issue.code === "sharp-turn-density") return `≤ ${issue.limit.toFixed(1)} 次/km`;
  return `≤ ${issue.limit}`;
}

function getIssueSeverity(issue: RouteQualityIssue) {
  if (issue.code === "max-grade" || issue.code === "hairpin-turn" || issue.code === "road-alignment") return "较高";
  if (typeof issue.actual === "number" && typeof issue.limit === "number" && issue.limit > 0 && issue.actual > issue.limit * 1.2) return "较高";
  return "中等";
}

function getIssueAction(issue: RouteQualityIssue) {
  const actionByCode: Partial<Record<RouteQualityIssue["code"], string>> = {
    distance: "微调补线或截短，复核最终里程",
    "max-grade": "改走缓坡道路或设置坡段现场复核",
    "repeated-road": "拆分重复路段，优先选择并行替代路",
    "local-knot": "局部重算控制点连接，消除绕行绳结",
    "node-revisit": "调整交叉口进出方向，减少复访冲突",
    "parallel-backtrack": "替换平行折返路段，优化交通组织",
    "hairpin-turn": "避开发卡掉头，必要时设人工折返点"
  };
  const action = actionByCode[issue.code] ?? "按现场踏勘结果调整路线";
  return `${action}；需现场复核/优化`;
}

function CertificationNotice() {
  return <p className="certification-notice">规划结果不替代 World Athletics / AIMS 认证测量；正式赛道须由合资格测量员沿最短可跑线实测。</p>;
}
