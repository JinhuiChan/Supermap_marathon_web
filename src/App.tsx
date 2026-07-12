import { useEffect, useMemo, useState } from "react";
import { CandidateRouteDrawer } from "./components/CandidateRouteDrawer";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { DataPackagePanel } from "./components/DataPackagePanel";
import { ExportPanel } from "./components/ExportPanel";
import {
  GisModeNav,
  type GisWorkspaceMode
} from "./components/GisModeNav";
import {
  GisSelectionPanel,
  defaultGisPlanningSettings
} from "./components/GisSelectionPanel";
import { LayerControlPanel } from "./components/LayerControlPanel";
import { RouteAnalysisPanel } from "./components/RouteAnalysisPanel";
import { RouteDetails } from "./components/RouteDetails";
import { RouteQualityPanel } from "./components/RouteQualityPanel";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import { superMapConfig } from "./config/supermap";
import { buildBestRouteForSelectionProfile } from "./data/profileRoutePlanner";
import { supportPoints } from "./data/supportPoints";
import { upsertGeneratedRoute } from "./domain/routeCollection";
import {
  compareRoutes,
  type MarathonRoute,
  type RouteSelectionProfile
} from "./domain/routeMetrics";
import { Scene3DPanel } from "./map/components/Scene3DPanel";
import { SuperMapMap, type MapLayerVisibility } from "./map/components/SuperMapMap";

interface AppProps {
  initialLayerVisibility?: MapLayerVisibility;
}

const waitForUiFrame = () => new Promise<void>((resolve) => window.setTimeout(resolve, 25));

export default function App({ initialLayerVisibility }: AppProps = {}) {
  const [workspaceMode, setWorkspaceMode] = useState<GisWorkspaceMode>("selection");
  const [routes, setRoutes] = useState<MarathonRoute[]>([]);
  const [roadGeoJson, setRoadGeoJson] = useState<unknown>(null);
  const [generationStatus, setGenerationStatus] = useState("正在加载武汉道路矢量网络");
  const [isGeneratingRoutes, setIsGeneratingRoutes] = useState(false);
  const [selectionProfile, setSelectionProfile] = useState<RouteSelectionProfile>("pb-friendly");
  const [activeRouteId, setActiveRouteId] = useState("");
  const [comparedRouteIds, setComparedRouteIds] = useState<string[]>([]);
  const [mapLayerVisibility, setMapLayerVisibility] = useState<MapLayerVisibility>(
    initialLayerVisibility ?? {
      routes: true,
      roadNetwork: true
    }
  );

  const activeRoute = useMemo(
    () => routes.find((route) => route.id === activeRouteId) ?? routes[0] ?? null,
    [routes, activeRouteId]
  );
  const comparedRoutes = useMemo(
    () => routes.filter((route) => comparedRouteIds.includes(route.id)),
    [routes, comparedRouteIds]
  );
  const rankedRoutes = useMemo(() => {
    const routeById = new Map(routes.map((route) => [route.id, route]));
    return compareRoutes(routes, selectionProfile)
      .map((score) => routeById.get(score.id))
      .filter((route): route is MarathonRoute => Boolean(route));
  }, [routes, selectionProfile]);

  useEffect(() => {
    let cancelled = false;

    fetch(superMapConfig.routingRoadNetworkGeoJsonUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        setRoadGeoJson(geojson);
        setGenerationStatus("道路网络已加载，可生成推荐路线库");
      })
      .catch(() => {
        if (!cancelled) {
          setRoutes([]);
          setGenerationStatus("未找到武汉道路矢量网络数据");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const generateProfileBestRoute = () => {
    if (!roadGeoJson || isGeneratingRoutes) return;

    setGenerationStatus("已接收生成任务，正在按当前选型目标计算最优路线");
    setIsGeneratingRoutes(true);

    window.setTimeout(() => {
      void runProfileBestRouteGeneration();
    }, 50);
  };

  const runProfileBestRouteGeneration = async () => {
    if (!roadGeoJson) return;

    try {
      setGenerationStatus("正在计算当前选型目标的阻力、POI 影响、参考廊道相似度和赛事约束");
      await waitForUiFrame();

      const route = buildBestRouteForSelectionProfile(roadGeoJson, selectionProfile);
      if (!route) {
        setGenerationStatus("未生成符合当前选型目标和全马赛事约束的路线，请检查道路网络连通性、里程误差、坡度与禁用道路条件");
        return;
      }

      setRoutes((current) => upsertGeneratedRoute(current, route));
      setGenerationStatus(`已生成并保存 ${route.name}，候选方案会保留其他选型目标的结果`);
      setActiveRouteId(route.id);
      setComparedRouteIds((current) => {
        const next = current.filter((id) => id !== route.id);
        return [...next.slice(-4), route.id];
      });
    } catch {
      setGenerationStatus("路网选线模型运行失败，请检查道路网络连通性");
    } finally {
      setIsGeneratingRoutes(false);
    }
  };

  const applyRecommendation = (profile = selectionProfile) => {
    const ranked = compareRoutes(routes, profile);
    if (ranked.length === 0) return;
    setActiveRouteId(ranked[0].id);
    setComparedRouteIds(ranked.slice(0, 3).map((route) => route.id));
  };

  const changeSelectionProfile = (profile: RouteSelectionProfile) => {
    setSelectionProfile(profile);
    setGenerationStatus("已切换选型目标；已生成的候选路线会继续保留，可继续生成当前目标的最优路线");
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

  const generateDisabledReason = !roadGeoJson
    ? "道路网络数据仍在加载或加载失败，请检查 public/data/local-wuhan-marathon-area-roads.geojson"
    : "";

  return (
    <main className={`app-shell gis-tool-shell ${workspaceMode}`}>
      <header className="gis-app-header">
        <div className="gis-brand">
          <span>SuperMap WebGIS</span>
          <strong>武汉马拉松赛道空间选线平台</strong>
        </div>
        <GisModeNav mode={workspaceMode} onModeChange={setWorkspaceMode} />
        <button type="button" className="gis-header-action" disabled={routes.length === 0} onClick={() => applyRecommendation()}>
          采用当前推荐
        </button>
      </header>

      <section className="gis-map-stage">
        <SuperMapMap
          routes={routes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          layerVisibility={mapLayerVisibility}
          onSelectRoute={setActiveRouteId}
        />

        {workspaceMode === "selection" && (
          <aside className="gis-selection-dock" aria-label="智能选型工作区">
            <GisSelectionPanel
              activeProfile={selectionProfile}
              settings={defaultGisPlanningSettings}
              canGenerate={Boolean(roadGeoJson)}
              generateDisabledReason={generateDisabledReason}
              isGenerating={isGeneratingRoutes}
              onProfileChange={changeSelectionProfile}
              onGenerateRoutes={generateProfileBestRoute}
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
                <p className="muted">请返回智能选型，生成推荐路线库后再从候选路线进入分析。</p>
              </section>
            )}
          </aside>
        )}

        <details className="gis-utility-details" aria-label="GIS 图层与服务" open>
          <summary>GIS 详情</summary>
          <aside className="gis-utility-dock">
            <RouteQualityPanel route={activeRoute} />
            <SuperMapStatusPanel />
            <LayerControlPanel
              visibility={mapLayerVisibility}
              onChange={setMapLayerVisibility}
            />
            <DataPackagePanel />
            {workspaceMode === "analysis" && <Scene3DPanel />}
          </aside>
        </details>
      </section>
    </main>
  );
}
