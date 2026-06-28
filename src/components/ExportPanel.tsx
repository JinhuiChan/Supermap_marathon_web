import type { MarathonRoute } from "../domain/routeMetrics";
import { compareRoutes } from "../domain/routeMetrics";

interface ExportPanelProps {
  routes: MarathonRoute[];
}

export function ExportPanel({ routes }: ExportPanelProps) {
  const scores = compareRoutes(routes);
  const report = [
    "马拉松赛道多路线对比分析报告",
    "",
    ...scores.map(
      (score) =>
        `${score.rank}. ${score.name}：推荐分 ${score.recommendationScore}，难度 ${score.difficultyScore}，保障 ${score.supportScore}，适配 ${score.runnerFit}`
    )
  ].join("\n");

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
