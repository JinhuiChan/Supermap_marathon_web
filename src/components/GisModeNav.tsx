export type GisWorkspaceMode = "selection" | "analysis";

interface GisModeNavProps {
  mode: GisWorkspaceMode;
  onModeChange: (mode: GisWorkspaceMode) => void;
}

export function GisModeNav({ mode, onModeChange }: GisModeNavProps) {
  return (
    <nav className="gis-mode-nav" aria-label="GIS 工作模式">
      <button
        type="button"
        className={mode === "selection" ? "active" : ""}
        aria-pressed={mode === "selection"}
        onClick={() => onModeChange("selection")}
      >
        智能选型
      </button>
      <button
        type="button"
        className={mode === "analysis" ? "active" : ""}
        aria-pressed={mode === "analysis"}
        onClick={() => onModeChange("analysis")}
      >
        赛道分析
      </button>
    </nav>
  );
}
