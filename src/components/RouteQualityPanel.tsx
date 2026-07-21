import type { MarathonRoute } from "../domain/routeMetrics";
import { evaluateRouteQuality } from "../domain/routeQuality";

export function RouteQualityPanel({ route }: { route: MarathonRoute | null }) {
  if (!route) {
    return (
      <section className="side-section route-quality-panel empty">
        <span className="quality-eyebrow">规划合规检查</span>
        <h2>等待合规路线</h2>
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
      <span className="quality-eyebrow">规划合规检查</span>
      <h2>{report.passed ? "质量闸门已通过" : "质量闸门未通过"}</h2>
      <p className="quality-route-name">{route.name}</p>
      <dl className="quality-fact-grid">
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      {report.issues.length > 0 ? (
        <ul className="quality-issues">
          {report.issues.map((issue) => <li key={issue.code}>{issue.label}未达标</li>)}
        </ul>
      ) : null}
      <CertificationNotice />
    </section>
  );
}

function CertificationNotice() {
  return <p className="certification-notice">规划结果不替代 World Athletics / AIMS 认证测量；正式赛道须由合资格测量员沿最短可跑线实测。</p>;
}
