import type { SupportPoint } from "../data/supportPoints";
import type { MarathonRoute } from "../domain/routeMetrics";
import { buildDecisionReport } from "../domain/routeAnalysis";

interface ExportPanelProps {
  routes: MarathonRoute[];
  supportPoints: SupportPoint[];
}

export function ExportPanel({ routes, supportPoints }: ExportPanelProps) {
  const report = buildDecisionReport(routes, supportPoints);

  const download = () => {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "marathon-route-comparison-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="side-section export-panel">
      <h2>成果导出</h2>
      <textarea readOnly value={report} aria-label="对比报告预览" />
      <button type="button" onClick={download} disabled={routes.length < 2}>
        导出对比报告
      </button>
    </section>
  );
}
