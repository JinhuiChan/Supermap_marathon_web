import { routeSelectionProfiles, type RouteSelectionProfile } from "../domain/routeMetrics";

export interface GisPlanningSettings {
  targetDistanceKm: number;
  poiWeights: Record<string, number>;
  impedanceWeights: Record<string, number>;
  constraints: {
    corridor: string;
    startFinish: string;
    mustPass: string[];
    avoid: string[];
  };
}

interface GisSelectionPanelProps {
  activeProfile: RouteSelectionProfile;
  settings: GisPlanningSettings;
  canGenerate: boolean;
  onProfileChange: (profile: RouteSelectionProfile) => void;
  onWeightChange: (group: "poiWeights" | "impedanceWeights", key: string, value: number) => void;
  onGenerateRoutes: () => void;
}

export const defaultGisPlanningSettings: GisPlanningSettings = {
  targetDistanceKm: 42.195,
  poiWeights: {
    medical: 80,
    transit: 72,
    parking: 64,
    supply: 78,
    scenic: 58,
    park: 52,
    toilet: 46
  },
  impedanceWeights: {
    slope: 70,
    lowGradeRoad: 82,
    narrowRoad: 76,
    sharpTurn: 68,
    backtrack: 88,
    tunnel: 54
  },
  constraints: {
    corridor: "汉马核心道路走廊 1.5km 缓冲区",
    startFinish: "江滩起终点控制区",
    mustPass: ["长江主轴景观带", "东湖绿道服务廊道"],
    avoid: ["低等级支路密集区", "高架匝道交织区"]
  }
};

const poiLabels: Record<string, string> = {
  medical: "医疗救援点",
  transit: "轨道交通站点",
  parking: "停车与集散",
  supply: "补给服务点",
  scenic: "景观节点",
  park: "公园绿地",
  toilet: "公共厕所"
};

const impedanceLabels: Record<string, string> = {
  slope: "坡度阻力",
  lowGradeRoad: "低等级道路阻力",
  narrowRoad: "窄路阻力",
  sharpTurn: "急转弯阻力",
  backtrack: "自交/折返阻力",
  tunnel: "隧道通行阻力"
};

export function GisSelectionPanel({
  activeProfile,
  settings,
  canGenerate,
  onProfileChange,
  onWeightChange,
  onGenerateRoutes
}: GisSelectionPanelProps) {
  return (
    <aside className="gis-selection-panel" aria-label="GIS 智能选型参数">
      <div className="gis-panel-heading">
        <span>空间决策模型</span>
        <h2>赛道智能选型</h2>
        <p>基于 OSM 道路网络、POI 服务可达性、阻力因子和空间约束生成候选赛道。</p>
      </div>

      <section className="gis-tool-group">
        <h3>选型目标</h3>
        <div className="gis-profile-grid">
          {routeSelectionProfiles.map((profile) => (
            <button
              type="button"
              className={profile.id === activeProfile ? "active" : ""}
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

      <section className="gis-tool-group">
        <h3>空间约束</h3>
        <dl className="gis-constraint-list">
          <div>
            <dt>目标里程</dt>
            <dd>{settings.targetDistanceKm.toFixed(3)} km</dd>
          </div>
          <div>
            <dt>路网廊道</dt>
            <dd>{settings.constraints.corridor}</dd>
          </div>
          <div>
            <dt>起终点约束</dt>
            <dd>{settings.constraints.startFinish}</dd>
          </div>
        </dl>
        <div className="gis-chip-row" aria-label="必经控制点">
          {settings.constraints.mustPass.map((item) => (
            <span key={item}>必经：{item}</span>
          ))}
        </div>
        <div className="gis-chip-row avoid" aria-label="避让区">
          {settings.constraints.avoid.map((item) => (
            <span key={item}>避让：{item}</span>
          ))}
        </div>
      </section>

      <WeightGroup
        title="POI 服务权重"
        values={settings.poiWeights}
        labels={poiLabels}
        onChange={(key, value) => onWeightChange("poiWeights", key, value)}
      />

      <WeightGroup
        title="阻力因子"
        values={settings.impedanceWeights}
        labels={impedanceLabels}
        onChange={(key, value) => onWeightChange("impedanceWeights", key, value)}
      />

      <button type="button" className="gis-generate-button" disabled={!canGenerate} onClick={onGenerateRoutes}>
        运行空间选线模型
      </button>
    </aside>
  );
}

function WeightGroup({
  title,
  values,
  labels,
  onChange
}: {
  title: string;
  values: Record<string, number>;
  labels: Record<string, string>;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <section className="gis-tool-group">
      <h3>{title}</h3>
      <div className="gis-weight-list">
        {Object.entries(values).map(([key, value]) => (
          <label key={key}>
            <span>{labels[key] ?? key}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(event) => onChange(key, Number(event.currentTarget.value))}
            />
            <strong>{value}</strong>
          </label>
        ))}
      </div>
    </section>
  );
}
