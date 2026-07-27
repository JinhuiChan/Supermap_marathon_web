import { useEffect, useMemo, useState } from "react";
import { CandidateRouteDrawer } from "./components/CandidateRouteDrawer";
import type { CSSProperties } from "react";
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
import { RouteDeleteDialog } from "./components/RouteDeleteDialog";
import { RouteDetails } from "./components/RouteDetails";
import { RouteQualityPanel } from "./components/RouteQualityPanel";
import { ResizeHandle } from "./components/ResizeHandle";
import { RouteWaypointPanel } from "./components/RouteWaypointPanel";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import { activeCityPackage, type CityPackage } from "./config/cityPackages";
import {
  buildFullOsmAllWaypointRouteAsync,
  getWaypointHitDistancesM,
  type FullOsmRouteProgressEvent
} from "./data/fullOsmAllWaypointRoute";
import type { WaypointRoutePlan } from "./data/profileRoutePlanner";
import {
  removeGeneratedRoute,
  upsertGeneratedRoute
} from "./domain/routeCollection";
import {
  compareRoutes,
  type MarathonRoute
} from "./domain/routeMetrics";
import {
  WORKSPACE_SIZE_DEFAULTS,
  WORKSPACE_SIZE_LIMITS,
  WORKSPACE_STORAGE_KEYS,
  clampWorkspaceSize,
  getCandidateHeightMax,
  getSidebarWidthMax,
  getWaypointHeightMax,
  readStoredWorkspaceSize,
  writeStoredWorkspaceSize
} from "./layout/workspaceSizing";
import { SuperMapMap, type MapLayerVisibility } from "./map/components/SuperMapMap";

interface AppProps {
  cityPackage?: CityPackage;
  initialLayerVisibility?: MapLayerVisibility;
}

export const routeCompareLimit = activeCityPackage.routePlans.length;

const waitForUiFrame = () => new Promise<void>((resolve) => window.setTimeout(resolve, 25));
const viewportWidth = () => typeof window === "undefined" ? 1280 : window.innerWidth;
const viewportHeight = () => typeof window === "undefined" ? 720 : window.innerHeight;

function getWorkspaceStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function updateComparedRouteIds(current: string[], id: string, limit = routeCompareLimit): string[] {
  if (current.includes(id)) return current;
  if (current.length >= limit) return current;
  return [...current, id];
}

function appendGeneratedComparedRouteId(current: string[], id: string, limit = routeCompareLimit): string[] {
  return [...current.filter((item) => item !== id).slice(-(limit - 1)), id];
}

export function upsertManualRoutePlan(current: WaypointRoutePlan[], plan: WaypointRoutePlan): WaypointRoutePlan[] {
  const existingIndex = current.findIndex((item) => item.id === plan.id);
  if (existingIndex === -1) return [...current, plan];
  return current.map((item, index) => index === existingIndex ? plan : item);
}

function formatGenerationProgress(routeName: string, event: FullOsmRouteProgressEvent): string {
  switch (event.stage) {
    case "graph":
      return "Full OSM road graph is ready";
    case "snap":
      return `Snapped ${event.current}/${event.total} control points for ${routeName}`;
    case "controls":
      return `${routeName}: connected ${event.current}/${event.total} control-point legs`;
    case "filler":
      return `${routeName}: extending route to target distance`;
    case "metrics":
      return `${routeName}: computing route quality and waypoint hits`;
    case "complete":
      return `${routeName}: route generation complete`;
    default:
      return event.message;
  }
}

export default function App({ cityPackage = activeCityPackage, initialLayerVisibility }: AppProps = {}) {
  const supportPoints = cityPackage.supportPoints;
  const [manualRoutePlans, setManualRoutePlans] = useState<WaypointRoutePlan[]>([]);
  const routePlans = useMemo(
    () => [...cityPackage.routePlans, ...manualRoutePlans],
    [cityPackage.routePlans, manualRoutePlans]
  );
  const cityRouteCompareLimit = routePlans.length;
  const [workspaceMode, setWorkspaceMode] = useState<GisWorkspaceMode>("selection");
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredWorkspaceSize(
    getWorkspaceStorage(),
    WORKSPACE_STORAGE_KEYS.sidebarWidth,
    WORKSPACE_SIZE_DEFAULTS.sidebarWidth,
    WORKSPACE_SIZE_LIMITS.sidebarWidth.min,
    WORKSPACE_SIZE_LIMITS.sidebarWidth.max
  ));
  const [waypointHeight, setWaypointHeight] = useState(() => readStoredWorkspaceSize(
    getWorkspaceStorage(),
    WORKSPACE_STORAGE_KEYS.waypointHeight,
    WORKSPACE_SIZE_DEFAULTS.waypointHeight,
    WORKSPACE_SIZE_LIMITS.waypointHeight.min,
    WORKSPACE_SIZE_LIMITS.waypointHeight.max
  ));
  const [candidateHeight, setCandidateHeight] = useState(() => readStoredWorkspaceSize(
    getWorkspaceStorage(),
    WORKSPACE_STORAGE_KEYS.candidateHeight,
    WORKSPACE_SIZE_DEFAULTS.candidateHeight,
    WORKSPACE_SIZE_LIMITS.candidateHeight.min,
    WORKSPACE_SIZE_LIMITS.candidateHeight.max
  ));
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [routes, setRoutes] = useState<MarathonRoute[]>([]);
  const [pendingDeleteRouteId, setPendingDeleteRouteId] = useState("");
  const [roadGeoJson, setRoadGeoJson] = useState<unknown>(null);
  const [generationStatus, setGenerationStatus] = useState(`正在加载${cityPackage.name}道路矢量网络`);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
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
  const pendingDeleteRoute = routes.find((route) => route.id === pendingDeleteRouteId) ?? null;

  useEffect(() => {
    writeStoredWorkspaceSize(getWorkspaceStorage(), WORKSPACE_STORAGE_KEYS.sidebarWidth, sidebarWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    writeStoredWorkspaceSize(getWorkspaceStorage(), WORKSPACE_STORAGE_KEYS.waypointHeight, waypointHeight);
  }, [waypointHeight]);

  useEffect(() => {
    writeStoredWorkspaceSize(getWorkspaceStorage(), WORKSPACE_STORAGE_KEYS.candidateHeight, candidateHeight);
  }, [candidateHeight]);

  useEffect(() => {
    const constrainLayoutToViewport = () => {
      setSidebarWidth((current) => clampWorkspaceSize(
        current,
        WORKSPACE_SIZE_LIMITS.sidebarWidth.min,
        getSidebarWidthMax(viewportWidth())
      ));
      setWaypointHeight((current) => clampWorkspaceSize(
        current,
        WORKSPACE_SIZE_LIMITS.waypointHeight.min,
        getWaypointHeightMax(viewportHeight())
      ));
      setCandidateHeight((current) => clampWorkspaceSize(
        current,
        WORKSPACE_SIZE_LIMITS.candidateHeight.min,
        getCandidateHeightMax(viewportHeight())
      ));
    };

    window.addEventListener("resize", constrainLayoutToViewport);
    constrainLayoutToViewport();
    return () => window.removeEventListener("resize", constrainLayoutToViewport);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const routingUrl = cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm;

    setRoadGeoJson(null);
    setRoutes([]);
    setManualRoutePlans([]);
    setPendingDeleteRouteId("");
    setActiveRouteId("");
    setComparedRouteIds([]);
    setGenerationStatus("Loading full OSM road network for route generation");

    fetch(routingUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        setRoadGeoJson(geojson);
        setGenerationStatus("Full OSM road network loaded. Ready to generate routes.");
      })
      .catch(() => {
        if (!cancelled) {
          setRoutes([]);
          setGenerationStatus("Full OSM road network data was not found.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cityPackage]);

  const generateRoute = (routeId: string) => {
    if (!roadGeoJson || isGenerating) return;

    const plan = routePlans.find((p) => p.id === routeId);
    if (!plan) return;

    startRouteGeneration(plan);
  };

  const generateManualRoute = (plan: WaypointRoutePlan) => {
    setManualRoutePlans((current) => upsertManualRoutePlan(current, plan));
    startRouteGeneration(plan);
  };

  const startRouteGeneration = (plan: WaypointRoutePlan) => {
    if (!roadGeoJson || isGenerating) return;

    setActiveRouteId(plan.id);
    setGenerationStatus(`Generating ${plan.name} with ${plan.waypoints.length} control points`);
    setGenerationProgress(8);
    setIsGenerating(true);

    window.setTimeout(() => {
      void runRouteGeneration(plan);
    }, 50);
  };

  const runRouteGeneration = async (plan: WaypointRoutePlan) => {
    if (!roadGeoJson) return;

    try {
      await waitForUiFrame();

      const route = await buildFullOsmAllWaypointRouteAsync(roadGeoJson, plan, {
        onProgress: (event) => {
          setGenerationProgress(event.percent);
          setGenerationStatus(formatGenerationProgress(plan.name, event));
        }
      });
      if (!route) {
        setGenerationStatus(`${plan.name} generation failed: road network is not connected between control points.`);
        setGenerationProgress(null);
        return;
      }

      const hitDistances = getWaypointHitDistancesM(route, plan);
      const hitCount = hitDistances.filter((item) => item.hit).length;
      setRoutes((current) => upsertGeneratedRoute(current, route));
      setGenerationProgress(100);
      setGenerationStatus(`Full OSM generated ${route.name}: ${route.lengthKm.toFixed(1)} km, hit ${hitCount}/${plan.waypoints.length} control points`);
      setActiveRouteId(route.id);
      setComparedRouteIds((current) => appendGeneratedComparedRouteId(current, route.id, cityRouteCompareLimit));
    } catch {
      setGenerationStatus("Route generation failed. Check full OSM road network connectivity.");
      setGenerationProgress(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const analyzeRoute = (id: string) => {
    setActiveRouteId(id);
    setComparedRouteIds((current) => updateComparedRouteIds(current, id));
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
      return updateComparedRouteIds(current, id, cityRouteCompareLimit);
    });
  };

  const confirmDeleteRoute = () => {
    if (!pendingDeleteRoute) {
      setPendingDeleteRouteId("");
      return;
    }

    const next = removeGeneratedRoute(
      routes,
      activeRouteId,
      comparedRouteIds,
      pendingDeleteRoute.id
    );
    setRoutes(next.routes);
    setActiveRouteId(next.activeRouteId);
    setComparedRouteIds(next.comparedRouteIds);
    setGenerationStatus(`已删除 ${pendingDeleteRoute.name}，可使用原控制点重新生成。`);
    setPendingDeleteRouteId("");
  };

  const generateDisabledReason = !roadGeoJson
    ? `Full OSM road network is still loading or failed. Check public/${cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm}`
    : "";
  const hasCandidateRoutes = workspaceMode === "selection" && routes.length > 0;
  const workspaceStyle = {
    "--gis-sidebar-width": `${sidebarWidth}px`,
    "--gis-waypoint-height": `${waypointHeight}px`,
    "--gis-candidate-height": `${candidateHeight}px`
  } as CSSProperties;

  const resizeSidebar = (delta: number) => setSidebarWidth((current) =>
    clampWorkspaceSize(
      current + delta,
      WORKSPACE_SIZE_LIMITS.sidebarWidth.min,
      getSidebarWidthMax(viewportWidth())
    )
  );
  const resizeWaypointPanel = (delta: number) => setWaypointHeight((current) =>
    clampWorkspaceSize(
      current - delta,
      WORKSPACE_SIZE_LIMITS.waypointHeight.min,
      getWaypointHeightMax(viewportHeight())
    )
  );
  const resizeCandidatePanel = (delta: number) => setCandidateHeight((current) =>
    clampWorkspaceSize(
      current - delta,
      WORKSPACE_SIZE_LIMITS.candidateHeight.min,
      getCandidateHeightMax(viewportHeight())
    )
  );

  return (
    <main className={`app-shell gis-tool-shell ${workspaceMode} ${hasCandidateRoutes ? "has-candidates" : ""}`}>
      <header className="gis-app-header">
        <div className="gis-brand">
          <span>SuperMap WebGIS</span>
          <strong>{cityPackage.marathonName}</strong>
        </div>
        <GisModeNav mode={workspaceMode} onModeChange={setWorkspaceMode} />
      </header>

      <section className="gis-map-stage" style={workspaceStyle}>
        <SuperMapMap
          cityPackage={cityPackage}
          routePlans={routePlans}
          routes={routes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          layerVisibility={mapLayerVisibility}
          isGenerating={isGenerating}
          generationProgress={generationProgress}
          generationStatus={generationStatus}
          onSelectRoute={setActiveRouteId}
        />

        {workspaceMode === "selection" && (
          <aside className="gis-selection-dock" aria-label="Route selection workspace">
            <GisSelectionPanel
              cityPackage={cityPackage}
              settings={defaultGisPlanningSettings}
              routePlans={routePlans}
              canGenerate={Boolean(roadGeoJson)}
              generateDisabledReason={generateDisabledReason}
              isGenerating={isGenerating}
              onGenerateRoute={generateRoute}
              onGenerateManualRoute={generateManualRoute}
            />
            <ResizeHandle
              orientation="horizontal"
              ariaLabel="调整控制点面板高度"
              value={waypointHeight}
              min={WORKSPACE_SIZE_LIMITS.waypointHeight.min}
              max={getWaypointHeightMax(viewportHeight())}
              className="waypoint-resize-handle"
              onResize={resizeWaypointPanel}
              onReset={() => setWaypointHeight(WORKSPACE_SIZE_DEFAULTS.waypointHeight)}
            />
            <RouteWaypointPanel activeRouteId={activeRouteId} routePlans={routePlans} />
          </aside>
        )}

        {hasCandidateRoutes && (
          <>
            <ResizeHandle
              orientation="horizontal"
              ariaLabel="调整候选方案面板高度"
              value={candidateHeight}
              min={WORKSPACE_SIZE_LIMITS.candidateHeight.min}
              max={getCandidateHeightMax(viewportHeight())}
              className="candidate-resize-handle"
              onResize={resizeCandidatePanel}
              onReset={() => setCandidateHeight(WORKSPACE_SIZE_DEFAULTS.candidateHeight)}
            />
            <CandidateRouteDrawer
              routes={rankedRoutes}
              cityPackage={cityPackage}
              activeRouteId={activeRouteId}
              comparedRouteIds={comparedRouteIds}
              generationStatus={generationStatus}
              onSelectRoute={setActiveRouteId}
              onToggleCompare={toggleCompare}
              onAnalyzeRoute={analyzeRoute}
              onDeleteRoute={setPendingDeleteRouteId}
            />
          </>
        )}

        {workspaceMode === "analysis" && (
          <aside className="gis-analysis-dock" aria-label="Route analysis panel">
            <button type="button" className="back-to-selection" onClick={() => setWorkspaceMode("selection")}>
              返回智能选型
            </button>
            {activeRoute ? (
              <>
                <RouteDetails route={activeRoute} />
                <RouteAnalysisPanel route={activeRoute} supportPoints={supportPoints} />
                <ComparisonPanel routes={comparedRoutes} selectionProfile="balanced" />
                <ExportPanel routes={comparedRoutes} supportPoints={supportPoints} cityPackage={cityPackage} />
              </>
            ) : (
              <section className="side-section empty-analysis">
                <h2>No route generated</h2>
                <p className="muted">Return to route selection and generate a Full OSM route before analysis.</p>
              </section>
            )}
          </aside>
        )}

        <ResizeHandle
          orientation="vertical"
          ariaLabel="调整侧边栏宽度"
          value={sidebarWidth}
          min={WORKSPACE_SIZE_LIMITS.sidebarWidth.min}
          max={getSidebarWidthMax(viewportWidth())}
          className="sidebar-resize-handle"
          onResize={resizeSidebar}
          onReset={() => setSidebarWidth(WORKSPACE_SIZE_DEFAULTS.sidebarWidth)}
        />

        <details className="gis-utility-details" aria-label="GIS layers and services">
          <summary>GIS 详情</summary>
          <aside className="gis-utility-dock">
            <RouteQualityPanel route={activeRoute} />
            <SuperMapStatusPanel cityPackage={cityPackage} />
            <LayerControlPanel
              cityPackage={cityPackage}
              visibility={mapLayerVisibility}
              onChange={setMapLayerVisibility}
            />
            <DataPackagePanel cityPackage={cityPackage} />
          </aside>
        </details>
      </section>
      {pendingDeleteRoute && (
        <RouteDeleteDialog
          routeName={pendingDeleteRoute.name}
          onCancel={() => setPendingDeleteRouteId("")}
          onConfirm={confirmDeleteRoute}
        />
      )}
    </main>
  );
}
