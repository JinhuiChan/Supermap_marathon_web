import { waypointRoutePlans, type WaypointRouteId } from "../data/profileRoutePlanner";

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
  settings: GisPlanningSettings;
  canGenerate: boolean;
  generateDisabledReason?: string;
  isGenerating?: boolean;
  onGenerateRoute: (routeId: WaypointRouteId) => void;
}

export const defaultGisPlanningSettings: GisPlanningSettings = {
  targetDistanceKm: 42.195,
  poiWeights: {},
  impedanceWeights: {},
  constraints: {
    corridor: "武汉铺装道路网络 · 高程与道路属性已校核",
    startFinish: "自动选择路网上的合规起点与终点",
    routeRules: [
      "42.195–42.237 km",
      "起终点净下降 ≤ 42.195 m",
      "累计爬升 ≤ 180 m",
      "最大坡度 ≤ 5%",
      "连续大坡 ≤ 1 km",
      "重复道路 0%",
      "自交 0",
      "局部绳结 0",
      "交叉口复访 0",
      "平行折返 0",
      "发卡掉头 0",
      "急弯密度 ≤ 1.5 次/km",
      "路网连续误差 ≤ 10 m",
      "道路几何贴合率 100%",
      "仅使用合规主次干道与绿道"
    ],
    mustPass: [],
    avoid: ["高架与匝道", "长隧道", "软质路面", "不可封闭道路"]
  }
};

export function GisSelectionPanel({
  settings,
  canGenerate,
  generateDisabledReason,
  isGenerating = false,
  onGenerateRoute
}: GisSelectionPanelProps) {
  const routeButtonTitle = !canGenerate && generateDisabledReason
    ? generateDisabledReason
    : isGenerating ? "正在搜索合规路线" : undefined;

  return (
    <aside className="gis-selection-panel" aria-label="武汉马拉松赛道选型">
      <div className="gis-panel-heading">
        <span>SuperMap WebGIS</span>
        <h2>武汉马拉松赛道选型</h2>
        <p>统一起点（三阳路沿江大道），途经点为廊道参考方向，路线由路网 Walk 算法沿合规道路生成。</p>
      </div>

      <section className="gis-tool-group gis-step-group">
        <h3>1. 选择路线</h3>
        <div className="gis-waypoint-route-grid">
          {waypointRoutePlans.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className="gis-waypoint-route-button"
              disabled={!canGenerate || isGenerating}
              title={routeButtonTitle}
              onClick={() => onGenerateRoute(plan.id)}
              style={{ borderLeftColor: plan.color }}
            >
              <strong style={{ color: plan.color }}>{plan.name}</strong>
              <span>{plan.targetDistanceKm.toFixed(1)} km · {plan.description}</span>
              <small>{plan.waypoints.length} 个途经控制点 · {plan.note}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="gis-tool-group gis-step-group">
        <h3>2. 硬性合规规则</h3>
        <div className="gis-rule-grid" aria-label="路线硬性合规规则">
          {settings.constraints.routeRules.map((rule) => <span key={rule}>✓ {rule}</span>)}
        </div>
        <div className="gis-chip-row avoid" aria-label="自动避让">
          {settings.constraints.avoid.map((item) => <span key={item}>避让：{item}</span>)}
        </div>
      </section>

      <section className="gis-tool-group gis-step-group gis-generate-step">
        <h3>3. 生成路线</h3>
        <p className="gis-tool-hint">点击上方路线按钮即可生成。系统将途经点吸附到最近路网节点，分段生成子路径后拼接为完整路线，并通过距离容差和质量闸门校验。</p>
        {isGenerating && <p className="gis-tool-hint">正在搜索合规路线</p>}
        {!canGenerate && generateDisabledReason && <p className="gis-tool-hint">{generateDisabledReason}</p>}
      </section>
    </aside>
  );
}
