import { useEffect, useMemo, useState } from "react";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { CandidateRouteDrawer } from "./components/CandidateRouteDrawer";
import { DataPackagePanel } from "./components/DataPackagePanel";
import { ExportPanel } from "./components/ExportPanel";
import {
  GisModeNav,
  type GisWorkspaceMode
} from "./components/GisModeNav";
import {
  GisSelectionPanel,
  defaultGisPlanningSettings,
  type GisPlanningSettings,
  type PlanningPointTool
} from "./components/GisSelectionPanel";
import { LayerControlPanel } from "./components/LayerControlPanel";
import { RouteAnalysisPanel } from "./components/RouteAnalysisPanel";
import { RouteDetails } from "./components/RouteDetails";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import type { BasemapMode } from "./config/supermap";
import { superMapConfig } from "./config/supermap";
import { buildOsmMarathonCandidateRoutes } from "./data/osmMarathonRoute";
import { supportPoints } from "./data/supportPoints";
import {
  compareRoutes,
  type Coordinate,
  type MarathonRoute,
  type RouteSelectionProfile
} from "./domain/routeMetrics";
import type { MapLayerVisibility } from "./map/components/SuperMapMap";
import { SuperMapMap } from "./map/components/SuperMapMap";
import { Scene3DPanel } from "./map/components/Scene3DPanel";

interface AppProps {
  initialLayerVisibility?: MapLayerVisibility;
}

export default function App({ initialLayerVisibility }: AppProps = {}) {
  const [workspaceMode, setWorkspaceMode] = useState<GisWorkspaceMode>("selection");
  const [planningSettings, setPlanningSettings] = useState<GisPlanningSettings>(defaultGisPlanningSettings);
  const [planningStartPoint, setPlanningStartPoint] = useState<Coordinate | null>(null);
  const [planningEndPoint, setPlanningEndPoint] = useState<Coordinate | null>(null);
  const [activePointTool, setActivePointTool] = useState<PlanningPointTool | null>(null);
  const [osmRoutes, setOsmRoutes] = useState<MarathonRoute[]>([]);
  const [osmRoadGeoJson, setOsmRoadGeoJson] = useState<unknown>(null);
  const [generationStatus, setGenerationStatus] = useState("正在加载 OSM 道路网络");
  const [isGeneratingRoutes, setIsGeneratingRoutes] = useState(false);
  const [selectionProfile, setSelectionProfile] = useState<RouteSelectionProfile>("balanced");
  const [activeRouteId, setActiveRouteId] = useState("");
  const [comparedRouteIds, setComparedRouteIds] = useState<string[]>([]);
  const [mapLayerVisibility, setMapLayerVisibility] = useState<MapLayerVisibility>(
    initialLayerVisibility ?? {
      routes: true,
      supportPoints: true,
      roadNetwork: true
    }
  );
  const [basemapMode, setBasemapMode] = useState<BasemapMode>(superMapConfig.defaultBasemap);

  const allRoutes = useMemo(() => osmRoutes, [osmRoutes]);
  const activeRoute = useMemo(
    () => allRoutes.find((route) => route.id === activeRouteId) ?? allRoutes[0] ?? null,
    [allRoutes, activeRouteId]
  );
  const comparedRoutes = useMemo(
    () => allRoutes.filter((route) => comparedRouteIds.includes(route.id)),
    [allRoutes, comparedRouteIds]
  );
  const rankedRoutes = useMemo(() => {
    const routeById = new Map(allRoutes.map((route) => [route.id, route]));
    return compareRoutes(allRoutes, selectionProfile)
      .map((score) => routeById.get(score.id))
      .filter((route): route is MarathonRoute => Boolean(route));
  }, [allRoutes, selectionProfile]);

  useEffect(() => {
    let cancelled = false;

    fetch("data/local-wuhan-marathon-corridor-roads.geojson")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        setOsmRoadGeoJson(geojson);
        setGenerationStatus("道路网络已加载，请先在地图上设置起点和终点");
      })
      .catch(() => {
        if (!cancelled) {
          setOsmRoutes([]);
          setGenerationStatus("未找到本地 OSM 道路网络数据");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const clearGeneratedRoutes = () => {
    setOsmRoutes([]);
    setActiveRouteId("");
    setComparedRouteIds([]);
  };

  const generateOsmCandidates = () => {
    if (!osmRoadGeoJson || !planningStartPoint || !planningEndPoint || isGeneratingRoutes) return;

    setGenerationStatus("正在执行路网拓扑搜索与阻力因子评价");
    setIsGeneratingRoutes(true);

    window.setTimeout(() => {
      try {
        const routes = buildOsmMarathonCandidateRoutes(osmRoadGeoJson, {
          targetDistanceKm: planningSettings.targetDistanceKm,
          startPoint: planningStartPoint,
          endPoint: planningEndPoint
        });
        const ranked = compareRoutes(routes, selectionProfile);

        setOsmRoutes(routes);
        setGenerationStatus(routes.length > 0 ? `已生成 ${routes.length} 条道路网络候选路线` : "未生成可用候选路线，请调整起终点或约束条件");

        if (ranked.length > 0) {
          setActiveRouteId(ranked[0].id);
          setComparedRouteIds(ranked.slice(0, 3).map((route) => route.id));
        } else {
          setActiveRouteId("");
          setComparedRouteIds([]);
        }
      } catch {
        setOsmRoutes([]);
        setActiveRouteId("");
        setComparedRouteIds([]);
        setGenerationStatus("路网选线模型运行失败，请检查道路网络或起终点位置");
      } finally {
        setIsGeneratingRoutes(false);
      }
    }, 50);
  };

  const applyRecommendation = (profile = selectionProfile) => {
    const ranked = compareRoutes(allRoutes, profile);
    if (ranked.length === 0) return;
    setActiveRouteId(ranked[0].id);
    setComparedRouteIds(ranked.slice(0, 3).map((route) => route.id));
  };

  const changeSelectionProfile = (profile: RouteSelectionProfile) => {
    setSelectionProfile(profile);
    applyRecommendation(profile);
  };

  const changePlanningWeight = (group: "poiWeights" | "impedanceWeights", key: string, value: number) => {
    setPlanningSettings((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value
      }
    }));
  };

  const handleMapCoordinateSelect = (coordinate: Coordinate) => {
    if (activePointTool === "start") {
      setPlanningStartPoint(coordinate);
      setGenerationStatus(planningEndPoint ? "起点已更新，可运行路网选线模型" : "起点已设置，请继续设置终点");
    }

    if (activePointTool === "end") {
      setPlanningEndPoint(coordinate);
      setGenerationStatus(planningStartPoint ? "终点已更新，可运行路网选线模型" : "终点已设置，请继续设置起点");
    }

    clearGeneratedRoutes();
    setActivePointTool(null);
    setWorkspaceMode("selection");
  };

  const clearPlanningPoints = () => {
    setPlanningStartPoint(null);
    setPlanningEndPoint(null);
    setActivePointTool(null);
    clearGeneratedRoutes();
    setGenerationStatus(osmRoadGeoJson ? "请先在地图上设置起点和终点" : "正在加载 OSM 道路网络");
  };

  const analyzeRoute = (id: string) => {
    setActiveRouteId(id);
    setComparedRouteIds((current) => (current.includes(id) ? current : [...current.slice(-4), id]));
    setWorkspaceMode("analysis");
  };

  const toggleCompare = (id: string) => {
    setComparedRouteIds((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        if (id === activeRouteId) {
          setActiveRouteId(next[0] ?? "");
        }
        return next;
      }
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  return (
    <main className={`app-shell gis-tool-shell ${workspaceMode}`}>
      <header className="gis-app-header">
        <div className="gis-brand">
          <span>SuperMap WebGIS</span>
          <strong>武汉马拉松赛道空间选线平台</strong>
        </div>
        <GisModeNav mode={workspaceMode} onModeChange={setWorkspaceMode} />
        <button type="button" className="gis-header-action" disabled={allRoutes.length === 0} onClick={() => applyRecommendation()}>
          采用当前推荐
        </button>
      </header>

      <section className="gis-map-stage">
        <SuperMapMap
          routes={allRoutes}
          supportPoints={supportPoints}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          layerVisibility={mapLayerVisibility}
          basemapMode={basemapMode}
          planningStartPoint={planningStartPoint}
          planningEndPoint={planningEndPoint}
          activePointTool={activePointTool}
          onSelectRoute={setActiveRouteId}
          onMapCoordinateSelect={handleMapCoordinateSelect}
        />

        {workspaceMode === "selection" && (
          <aside className="gis-selection-dock" aria-label="智能选型工作区">
            <GisSelectionPanel
              activeProfile={selectionProfile}
              settings={planningSettings}
              canGenerate={Boolean(osmRoadGeoJson && planningStartPoint && planningEndPoint)}
              startPoint={planningStartPoint}
              endPoint={planningEndPoint}
              activePointTool={activePointTool}
              isGenerating={isGeneratingRoutes}
              onProfileChange={changeSelectionProfile}
              onWeightChange={changePlanningWeight}
              onPointToolChange={setActivePointTool}
              onClearPlanningPoints={clearPlanningPoints}
              onGenerateRoutes={generateOsmCandidates}
            />
            <CandidateRouteDrawer
              routes={rankedRoutes}
              activeRouteId={activeRouteId}
              comparedRouteIds={comparedRouteIds}
              generationStatus={generationStatus}
              onSelectRoute={setActiveRouteId}
              onToggleCompare={toggleCompare}
              onAnalyzeRoute={analyzeRoute}
            />
          </aside>
        )}

        {workspaceMode === "analysis" && (
          <aside className="gis-analysis-dock" aria-label="赛道分析面板">
            <button type="button" className="back-to-selection" onClick={() => setWorkspaceMode("selection")}>
              返回智能选型
            </button>
            {activeRoute ? (
              <>
                <RouteDetails route={activeRoute} />
                <RouteAnalysisPanel route={activeRoute} supportPoints={supportPoints} />
                <ComparisonPanel routes={comparedRoutes} selectionProfile={selectionProfile} />
                <ExportPanel routes={comparedRoutes} supportPoints={supportPoints} />
              </>
            ) : (
              <section className="side-section empty-analysis">
                <h2>尚未生成赛道</h2>
                <p className="muted">请返回智能选型，在地图上设置起点和终点后运行路网选线模型。</p>
              </section>
            )}
          </aside>
        )}

        <aside className="gis-utility-dock" aria-label="GIS 图层与服务">
          <SuperMapStatusPanel />
          <LayerControlPanel
            visibility={mapLayerVisibility}
            basemapMode={basemapMode}
            supportPointCount={supportPoints.length}
            onChange={setMapLayerVisibility}
            onBasemapChange={setBasemapMode}
          />
          <DataPackagePanel />
          {workspaceMode === "analysis" && <Scene3DPanel />}
        </aside>
      </section>
    </main>
  );
}
