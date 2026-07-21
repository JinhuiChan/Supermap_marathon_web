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
  defaultGisPlanningSettings,
  type RoutingNetworkMode
} from "./components/GisSelectionPanel";
import { LayerControlPanel } from "./components/LayerControlPanel";
import { RouteAnalysisPanel } from "./components/RouteAnalysisPanel";
import { RouteDetails } from "./components/RouteDetails";
import { RouteQualityPanel } from "./components/RouteQualityPanel";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import { superMapConfig } from "./config/supermap";
import { buildFullOsmAllWaypointRoute, getWaypointHitDistancesM } from "./data/fullOsmAllWaypointRoute";
import { buildWaypointRoute, waypointRoutePlans, type WaypointRouteId } from "./data/profileRoutePlanner";
import { supportPoints } from "./data/supportPoints";
import { upsertGeneratedRoute } from "./domain/routeCollection";
import {
  compareRoutes,
  type MarathonRoute
} from "./domain/routeMetrics";
import { Scene3DPanel } from "./map/components/Scene3DPanel";
import { SuperMapMap, type MapLayerVisibility } from "./map/components/SuperMapMap";

interface AppProps {
  initialLayerVisibility?: MapLayerVisibility;
}

const waitForUiFrame = () => new Promise<void>((resolve) => window.setTimeout(resolve, 25));

export default function App({ initialLayerVisibility }: AppProps = {}) {
  const [workspaceMode, setWorkspaceMode] = useState<GisWorkspaceMode>("selection");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [routes, setRoutes] = useState<MarathonRoute[]>([]);
  const [routingNetworkMode, setRoutingNetworkMode] = useState<RoutingNetworkMode>("area");
  const [roadGeoJson, setRoadGeoJson] = useState<unknown>(null);
  const [generationStatus, setGenerationStatus] = useState("正在加载武汉道路矢量网络");
  const [isGenerating, setIsGenerating] = useState(false);
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
    return compareRoutes(routes, "balanced")
      .map((score) => routeById.get(score.id))
      .filter((route): route is MarathonRoute => Boolean(route));
  }, [routes]);

  useEffect(() => {
    let cancelled = false;
    const routingUrl = superMapConfig.routingRoadNetworkGeoJsonUrls[routingNetworkMode];

    setRoadGeoJson(null);
    setRoutes([]);
    setActiveRouteId("");
    setComparedRouteIds([]);
    setGenerationStatus(routingNetworkMode === "fullOsm"
      ? "Loading full OSM road network for experimental routing"
      : "姝ｅ湪鍔犺浇姝︽眽閬撹矾鐭㈤噺缃戠粶");

    fetch(routingUrl)
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
  }, [routingNetworkMode]);

  const generateRoute = (routeId: WaypointRouteId) => {
    if (!roadGeoJson || isGenerating) return;

    const plan = waypointRoutePlans.find((p) => p.id === routeId);
    if (!plan) return;

    setGenerationStatus(`正在沿 ${plan.waypoints.length} 个途经点生成「${plan.name}」…`);
    setIsGenerating(true);

    window.setTimeout(() => {
      void runRouteGeneration(plan);
    }, 50);
  };

  const runRouteGeneration = async (plan: typeof waypointRoutePlans[number]) => {
    if (!roadGeoJson) return;

    try {
      await waitForUiFrame();

      const route = routingNetworkMode === "fullOsm"
        ? buildFullOsmAllWaypointRoute(roadGeoJson, plan)
        : buildWaypointRoute(roadGeoJson, plan, { maxAttempts: 5 });
      if (!route) {
        setGenerationStatus(`「${plan.name}」生成失败：路网数据在途经点之间无法连通，请检查道路覆盖范围`);
        return;
      }

      const hitDistances = getWaypointHitDistancesM(route, plan);
      const hitCount = hitDistances.filter((item) => item.hit).length;
      setRoutes((current) => upsertGeneratedRoute(current, route));
      setGenerationStatus(
        routingNetworkMode === "fullOsm"
          ? `Full OSM generated ${route.name}: ${route.lengthKm.toFixed(1)} km, hit ${hitCount}/${plan.waypoints.length} control points`
          : `Generated ${route.name}: ${route.lengthKm.toFixed(1)} km`
      );
      setActiveRouteId(route.id);
      setComparedRouteIds((current) => [...current.filter((id) => id !== route.id).slice(-4), route.id]);
    } catch {
      setGenerationStatus("路线生成失败，请检查道路网络连通性");
    } finally {
      setIsGenerating(false);
    }
  };

  const applyRecommendation = () => {
    const ranked = compareRoutes(routes, "balanced");
    if (ranked.length === 0) return;
    setActiveRouteId(ranked[0].id);
    setComparedRouteIds(ranked.slice(0, 3).map((route) => route.id));
  };

  const analyzeRoute = (id: string) => {
    setActiveRouteId(id);
    setComparedRouteIds((current) => (current.includes(id) ? current : [...current.slice(-4), id]));
    setWorkspaceMode("analysis");
    setDetailPanelOpen(true);
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
              settings={defaultGisPlanningSettings}
              canGenerate={Boolean(roadGeoJson)}
              generateDisabledReason={generateDisabledReason}
              isGenerating={isGenerating}
              routingNetworkMode={routingNetworkMode}
              onRoutingNetworkModeChange={setRoutingNetworkMode}
              onGenerateRoute={generateRoute}
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
                <ComparisonPanel routes={comparedRoutes} selectionProfile="balanced" />
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

        <details className="gis-utility-details" aria-label="GIS 图层与服务">
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
