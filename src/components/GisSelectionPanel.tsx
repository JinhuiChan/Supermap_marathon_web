import { routeSelectionProfiles, type RouteSelectionProfile } from "../domain/routeMetrics";

export interface GisPlanningSettings {
  targetDistanceKm: number;
  poiWeights: Record<string, number>;
  impedanceWeights: Record<string, number>;
  constraints: {
    corridor: string;
    startFinish: string;
    routeRules: string[];
    mustPass: string[];
    avoid: string[];
  };
}

interface GisSelectionPanelProps {
  activeProfile: RouteSelectionProfile;
  settings: GisPlanningSettings;
  canGenerate: boolean;
  generateDisabledReason?: string;
  isGenerating?: boolean;
  onProfileChange: (profile: RouteSelectionProfile) => void;
  onGenerateRoutes: () => void;
}

export const defaultGisPlanningSettings: GisPlanningSettings = {
  targetDistanceKm: 42.195,
  poiWeights: {},
  impedanceWeights: {},
  constraints: {
    corridor: "武汉铺装道路网络 · 高程与道路属性已校核",
    startFinish: "自动选择合规终点；起终点直线距离不超过全程 50%",
    routeRules: [
      "42.195–42.237 km",
      "起终点直线距离 ≤ 21.0975 km",
      "起终点净下降 ≤ 42.195 m",
      "累计爬升 ≤ 180 m",
      "最大坡度 ≤ 5%",
      "连续大坡 ≤ 1 km",
      "重复道路 0%",
      "自交 0",
      "局部绳结 0",
      "路网连续误差 ≤ 10 m",
      "道路几何贴合率 100%"
    ],
    mustPass: [],
    avoid: ["高架与匝道", "长隧道", "软质路面", "不可封闭道路"]
  }
};

export function GisSelectionPanel({
  activeProfile,
  settings,
  canGenerate,
  generateDisabledReason,
  isGenerating = false,
  onProfileChange,
  onGenerateRoutes
}: GisSelectionPanelProps) {
  return (
    <aside className="gis-selection-panel" aria-label="GIS 智能选型参数">
      <div className="gis-panel-heading">
        <span>规划合规优先</span>
        <h2>赛道智能选型</h2>
        <p>先通过统一质量闸门，再按赛事目标排序。未通过的连接线、短路线和漂移路线不会进入候选列表。</p>
      </div>

      <section className="gis-tool-group gis-step-group">
        <h3>1. 选择目标</h3>
        <p className="gis-tool-hint">三种目标共享同一组硬性合规规则，仅改变合格路线的排序偏好。</p>
        <div className="gis-profile-grid">
          {routeSelectionProfiles.map((profile) => (
            <button
              type="button"
              className={`gis-profile-option ${profile.id === activeProfile ? "active" : ""}`}
              aria-pressed={profile.id === activeProfile}
              key={profile.id}
              onClick={() => onProfileChange(profile.id)}
            >
              <strong>{profile.label}</strong>
              <span>{profile.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="gis-tool-group gis-step-group">
        <h3>2. 核对硬规则</h3>
        <dl className="gis-constraint-list">
          <div><dt>标准距离</dt><dd>{settings.targetDistanceKm.toFixed(3)} km</dd></div>
          <div><dt>道路数据</dt><dd>{settings.constraints.corridor}</dd></div>
          <div><dt>起终点</dt><dd>{settings.constraints.startFinish}</dd></div>
        </dl>
        <div className="gis-rule-grid" aria-label="路线硬性合规规则">
          {settings.constraints.routeRules.map((rule) => <span key={rule}>✓ {rule}</span>)}
        </div>
        <div className="gis-chip-row avoid" aria-label="自动避让">
          {settings.constraints.avoid.map((item) => <span key={item}>避让：{item}</span>)}
        </div>
      </section>

      <section className="gis-tool-group gis-step-group gis-generate-step">
        <h3>3. 生成路线</h3>
        <p className="gis-tool-hint">系统依次执行路网搜索、里程闭合和质量校验，只保存全部通过的方案。</p>
        <button
          type="button"
          className="gis-generate-button"
          disabled={!canGenerate || isGenerating}
          title={!canGenerate ? generateDisabledReason : undefined}
          onClick={onGenerateRoutes}
        >
          {isGenerating ? "正在搜索合规路线..." : "生成当前目标路线"}
        </button>
        {!canGenerate && !isGenerating && generateDisabledReason ? (
          <p className="gis-generate-disabled-reason">{generateDisabledReason}</p>
        ) : null}
      </section>
    </aside>
  );
}
