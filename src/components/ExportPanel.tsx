import type { SupportPoint } from "../data/supportPoints";
import type { MarathonRoute } from "../domain/routeMetrics";
import { activeCityPackage, type CityPackage } from "../config/cityPackages";
import {
  buildRouteComparisonHtmlReport,
  buildSingleRouteHtmlReport
} from "../domain/routeAnalysis";
import { buildRouteJsonExport } from "../domain/routeJsonExport";

interface ExportPanelProps {
  primaryRoute?: MarathonRoute | null;
  routes: MarathonRoute[];
  supportPoints: SupportPoint[];
  cityPackage?: CityPackage;
}

export function ExportPanel({ primaryRoute, routes, supportPoints, cityPackage = activeCityPackage }: ExportPanelProps) {
  const singleReportRoute = primaryRoute ?? routes[0] ?? null;
  const reportOptions = {
    reportBrand: cityPackage.marathonName,
    dataBasis: `数据依据：${cityPackage.name} CityPackage、SuperMap iServer 服务、道路网络 GeoJSON、路线几何、道路等级、坡度/爬升、拓扑检测与本地服务点 GeoJSON。`
  };
  const singleRouteReport = singleReportRoute
    ? buildSingleRouteHtmlReport(singleReportRoute, supportPoints, reportOptions)
    : "";
  const comparisonReport = routes.length >= 2
    ? buildRouteComparisonHtmlReport(routes, supportPoints, reportOptions)
    : "";
  const routeJson = singleReportRoute ? buildRouteJsonExport(singleReportRoute, cityPackage) : "";

  const downloadHtml = (content: string, filename: string) => {
    if (!content) return;
    downloadText(content, filename, "text/html;charset=utf-8");
  };

  const downloadJson = (content: string, filename: string) => {
    if (!content) return;
    downloadText(content, filename, "application/json;charset=utf-8");
  };

  const downloadText = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
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
        <div className="export-actions">
          <button
            type="button"
            onClick={() => downloadHtml(singleRouteReport, "marathon-single-route-analysis.html")}
            disabled={!singleReportRoute}
          >
            导出 HTML 报告
          </button>
          <button
            type="button"
            onClick={() => downloadJson(routeJson, "marathon-current-route.json")}
            disabled={!singleReportRoute}
          >
            保存路线 JSON
          </button>
        </div>
      </div>

      <div className="export-report-group">
        <h3>多路线比选报告</h3>
        <p className="muted">包含综合排序、路线摘要、风险复核项和统一数据来源说明，可用浏览器打印为 PDF。</p>
        <div className="export-actions">
          <button
            type="button"
            onClick={() => downloadHtml(comparisonReport, "marathon-route-comparison.html")}
            disabled={routes.length < 2}
          >
            导出多路线 HTML 报告
          </button>
        </div>
      </div>

      <textarea
        readOnly
        value={singleRouteReport || comparisonReport || "生成候选路线后可导出 HTML 报告。"}
        aria-label="HTML 报告预览"
      />
    </section>
  );
}
