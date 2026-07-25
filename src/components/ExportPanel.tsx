import type { SupportPoint } from "../data/supportPoints";
import type { MarathonRoute } from "../domain/routeMetrics";
import {
  buildRouteComparisonHtmlReport,
  buildSingleRouteHtmlReport
} from "../domain/routeAnalysis";

interface ExportPanelProps {
  routes: MarathonRoute[];
  supportPoints: SupportPoint[];
}

export function ExportPanel({ routes, supportPoints }: ExportPanelProps) {
  const primaryRoute = routes[0] ?? null;
  const singleRouteReport = primaryRoute
    ? buildSingleRouteHtmlReport(primaryRoute, supportPoints)
    : "";
  const comparisonReport = routes.length >= 2
    ? buildRouteComparisonHtmlReport(routes, supportPoints)
    : "";

  const downloadHtml = (content: string, filename: string) => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="side-section export-panel">
      <h2>成果导出</h2>

      <div className="export-report-group">
        <h3>单路线分析报告</h3>
        <p className="muted">包含路线概况、指标表、风险复核项、保障规划建议、数据来源和认证测量边界说明。</p>
        <button
          type="button"
          onClick={() => downloadHtml(singleRouteReport, "marathon-single-route-analysis.html")}
          disabled={!primaryRoute}
        >
          导出单路线 HTML 报告
        </button>
      </div>

      <div className="export-report-group">
        <h3>多路线比选报告</h3>
        <p className="muted">包含综合排序、路线摘要、风险复核项和统一数据来源说明，可用浏览器打印为 PDF。</p>
        <button
          type="button"
          onClick={() => downloadHtml(comparisonReport, "marathon-route-comparison.html")}
          disabled={routes.length < 2}
        >
          导出多路线 HTML 报告
        </button>
      </div>

      <textarea
        readOnly
        value={singleRouteReport || comparisonReport || "生成候选路线后可导出 HTML 报告。"}
        aria-label="HTML 报告预览"
      />
    </section>
  );
}
