import { useState } from "react";
import { activeCityPackage, type CityPackage } from "../config/cityPackages";
import {
  buildManualControlPointRoutePlan,
  createManualControlPointRow,
  manualControlPointExampleRows,
  parseManualControlPointText,
  updateManualControlPointRow,
  type ManualControlPointRow
} from "../data/manualControlPointPlan";
import { controlPointSourceLabelForPlan, type WaypointRoutePlan } from "../data/profileRoutePlanner";

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
  cityPackage?: CityPackage;
  settings: GisPlanningSettings;
  routePlans: WaypointRoutePlan[];
  canGenerate: boolean;
  generateDisabledReason?: string;
  isGenerating?: boolean;
  onGenerateRoute: (routeId: string) => void;
  onGenerateManualRoute?: (plan: WaypointRoutePlan) => void;
}

export const defaultGisPlanningSettings: GisPlanningSettings = {
  targetDistanceKm: 42.195,
  poiWeights: {},
  impedanceWeights: {},
  constraints: {
    corridor: "铺装道路网络 · 高程与道路属性已校核",
    startFinish: "自动选择路网上的合规起点与终点",
    routeRules: [
      "全马 42.195–42.237 km",
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

function formatRouteDistance(distanceKm: number): string {
  return distanceKm < 25 ? distanceKm.toFixed(4) : distanceKm.toFixed(3);
}

export function GisSelectionPanel({
  cityPackage = activeCityPackage,
  settings,
  routePlans,
  canGenerate,
  generateDisabledReason,
  isGenerating = false,
  onGenerateRoute,
  onGenerateManualRoute
}: GisSelectionPanelProps) {
  const [manualRouteName, setManualRouteName] = useState("手动推荐线");
  const [manualRows, setManualRows] = useState<ManualControlPointRow[]>(manualControlPointExampleRows);
  const [manualRouteSerial, setManualRouteSerial] = useState(1);
  const [manualError, setManualError] = useState("");
  const [manualImportText, setManualImportText] = useState("");
  const [manualImportMessage, setManualImportMessage] = useState("");
  const [manualImportOpen, setManualImportOpen] = useState(false);
  const routeButtonTitle = !canGenerate && generateDisabledReason
    ? generateDisabledReason
    : isGenerating ? "正在搜索合规路线" : undefined;
  const manualRouteDisabled = !canGenerate || isGenerating || !onGenerateManualRoute;

  function updateManualRow(id: string, field: keyof Omit<ManualControlPointRow, "id">, value: string) {
    setManualRows((current) => updateManualControlPointRow(current, id, field, value));
  }

  function addManualRow() {
    setManualRows((current) => [
      ...current,
      createManualControlPointRow(`控制点 ${current.length + 1}`)
    ]);
  }

  function removeManualRow(id: string) {
    setManualRows((current) => current.filter((row) => row.id !== id));
  }

  function resetManualRowsToExample() {
    setManualRouteName("手动推荐线");
    setManualRows(manualControlPointExampleRows);
    setManualError("");
    setManualImportMessage("");
  }

  function applyManualImport(text: string) {
    const result = parseManualControlPointText(text);
    if (!result.ok) {
      setManualImportMessage(result.error);
      return;
    }

    setManualRows(result.rows);
    if (result.routeName) setManualRouteName(result.routeName);
    setManualImportMessage(`已读取 ${result.rows.length} 个控制点`);
    setManualError("");
  }

  function readManualControlPointFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setManualImportText(text);
      setManualImportOpen(true);
      applyManualImport(text);
    };
    reader.onerror = () => setManualImportMessage("读取本地文件失败");
    reader.readAsText(file, "utf-8");
  }

  function generateManualRoute() {
    const result = buildManualControlPointRoutePlan({
      id: `manual-user-${manualRouteSerial}`,
      name: manualRouteName,
      rows: manualRows
    });

    if (!result.ok) {
      setManualError(result.error);
      return;
    }

    setManualError("");
    setManualRouteSerial((current) => current + 1);
    onGenerateManualRoute?.(result.plan);
  }

  return (
    <aside className="gis-selection-panel" aria-label={`${cityPackage.displayName}赛道选型`}>
      <div className="gis-panel-heading">
        <span>SuperMap WebGIS</span>
        <h2>{cityPackage.displayName}赛道选型</h2>
        <p>统一起点与途经点作为廊道参考方向，路线由路网 Walk 算法沿合规道路生成。</p>
      </div>

      <section className="gis-tool-group gis-step-group">
        <h3>1. 选择路线</h3>
        <div className="gis-routing-source-control" aria-label="Routing data source">
          <span>Routing data</span>
          <strong>Full OSM</strong>
          <small>38MB / 52649 roads, experimental</small>
        </div>
        <div className="gis-waypoint-route-grid">
          {routePlans.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className="gis-waypoint-route-button"
              disabled={!canGenerate || isGenerating}
              title={routeButtonTitle}
              onClick={() => onGenerateRoute(plan.id)}
              style={{ borderLeftColor: plan.color }}
            >
              <em className="gis-route-source-badge">{controlPointSourceLabelForPlan(plan)}</em>
              <strong style={{ color: plan.color }}>{plan.name}</strong>
              <span>{formatRouteDistance(plan.targetDistanceKm)} km · {plan.description}</span>
              <small>{plan.waypoints.length} 个途经控制点 · {plan.audience}</small>
              <small>{plan.features[0]}</small>
            </button>
          ))}
        </div>

        <div className="manual-control-point-builder">
          <div className="manual-builder-heading">
            <strong>手动输入控制点</strong>
            <span>用户手动输入控制点 · 示例控制点已填入</span>
          </div>
          <label className="manual-route-name-field">
            <span>路线名称</span>
            <input
              type="text"
              value={manualRouteName}
              onChange={(event) => setManualRouteName(event.currentTarget.value)}
            />
          </label>
          <div className="manual-import-actions">
            <button type="button" onClick={() => setManualImportOpen((current) => !current)}>输入数据</button>
            <label>
              读取本地 JSON/MD
              <input
                type="file"
                accept=".json,.md,.markdown,.txt"
                onChange={(event) => readManualControlPointFile(event.currentTarget.files?.[0])}
              />
            </label>
          </div>
          {manualImportOpen && (
            <div className="manual-import-editor">
              <label className="manual-import-field">
                <span>JSON / Markdown 控制点</span>
                <textarea
                  value={manualImportText}
                  placeholder='JSON 示例：[{"name":"起点","lon":114.30230,"lat":30.60287}]'
                  onChange={(event) => setManualImportText(event.currentTarget.value)}
                />
              </label>
              <button type="button" onClick={() => applyManualImport(manualImportText)}>应用输入数据</button>
            </div>
          )}
          {manualImportMessage && <p className="manual-import-message">{manualImportMessage}</p>}
          <div className="manual-control-point-table" aria-label="手动输入控制点表">
            <div className="manual-control-point-header">
              <span>名称</span>
              <span>经度</span>
              <span>纬度</span>
              <span>操作</span>
            </div>
            {manualRows.map((row, index) => (
              <div className="manual-control-point-row" key={row.id}>
                <input
                  type="text"
                  aria-label={`第 ${index + 1} 个控制点名称`}
                  value={row.label}
                  onChange={(event) => updateManualRow(row.id, "label", event.currentTarget.value)}
                />
                <input
                  type="number"
                  step="0.00001"
                  aria-label={`第 ${index + 1} 个控制点经度`}
                  value={row.longitude}
                  onChange={(event) => updateManualRow(row.id, "longitude", event.currentTarget.value)}
                />
                <input
                  type="number"
                  step="0.00001"
                  aria-label={`第 ${index + 1} 个控制点纬度`}
                  value={row.latitude}
                  onChange={(event) => updateManualRow(row.id, "latitude", event.currentTarget.value)}
                />
                <button type="button" onClick={() => removeManualRow(row.id)} disabled={manualRows.length <= 2}>
                  删除
                </button>
              </div>
            ))}
          </div>
          <div className="manual-control-point-actions">
            <button type="button" onClick={addManualRow}>添加控制点</button>
            <button type="button" onClick={resetManualRowsToExample}>恢复示例控制点</button>
            <button type="button" className="primary" onClick={generateManualRoute} disabled={manualRouteDisabled}>
              生成手动路线
            </button>
          </div>
          <p className="gis-tool-hint">系统会按输入顺序吸附到最近路网节点，再分段生成完整路线。</p>
          {manualError && <p className="manual-control-point-error">{manualError}</p>}
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
        <p className="gis-tool-hint">点击上方路线按钮即可生成。系统将途经点吸附到最近路网节点，分段生成子路径后拼接为完整路线，并通过距离容差和质量复核校验。</p>
        {isGenerating && <p className="gis-tool-hint">正在搜索合规路线</p>}
        {!canGenerate && generateDisabledReason && <p className="gis-tool-hint">{generateDisabledReason}</p>}
      </section>
    </aside>
  );
}
