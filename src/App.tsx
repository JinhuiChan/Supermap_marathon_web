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
import {
  buildFullOsmAllWaypointRouteAsync,
  getWaypointHitDistancesM,
  type FullOsmRouteProgressEvent
} from "./data/fullOsmAllWaypointRoute";
import { waypointRoutePlans, type WaypointRouteId } from "./data/profileRoutePlanner";
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

export default function App({ initialLayerVisibility }: AppProps = {}) {
  const [workspaceMode, setWorkspaceMode] = useState<GisWorkspaceMode>("selection");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [routes, setRoutes] = useState<MarathonRoute[]>([]);
  const [roadGeoJson, setRoadGeoJson] = useState<unknown>(null);
  const [generationStatus, setGenerationStatus] = useState("姝ｅ湪鍔犺浇姝︽眽閬撹矾鐭㈤噺缃戠粶");
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

  useEffect(() => {
    let cancelled = false;
    const routingUrl = superMapConfig.routingRoadNetworkGeoJsonUrls.fullOsm;

    setRoadGeoJson(null);
    setRoutes([]);
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
  }, []);

  const generateRoute = (routeId: WaypointRouteId) => {
    if (!roadGeoJson || isGenerating) return;

    const plan = waypointRoutePlans.find((p) => p.id === routeId);
    if (!plan) return;

    setGenerationStatus(`Generating ${plan.name} with ${plan.waypoints.length} control points`);
    setGenerationProgress(8);
    setIsGenerating(true);

    window.setTimeout(() => {
      void runRouteGeneration(plan);
    }, 50);
  };

  const runRouteGeneration = async (plan: typeof waypointRoutePlans[number]) => {
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
      setComparedRouteIds((current) => [...current.filter((id) => id !== route.id).slice(-4), route.id]);
    } catch {
      setGenerationStatus("Route generation failed. Check full OSM road network connectivity.");
      setGenerationProgress(null);
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
    ? "Full OSM road network is still loading or failed. Check public/data/local-wuhan-road-network-osm.geojson"
    : "";

  return (
    <main className={`app-shell gis-tool-shell ${workspaceMode}`}>
      <header className="gis-app-header">
        <div className="gis-brand">
          <span>SuperMap WebGIS</span>
          <strong>姝︽眽椹媺鏉捐禌閬撶┖闂撮€夌嚎骞冲彴</strong>
        </div>
        <GisModeNav mode={workspaceMode} onModeChange={setWorkspaceMode} />
        <button type="button" className="gis-header-action" disabled={routes.length === 0} onClick={() => applyRecommendation()}>
          閲囩敤褰撳墠鎺ㄨ崘
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
          <aside className="gis-selection-dock" aria-label="Route selection workspace">
            <GisSelectionPanel
              settings={defaultGisPlanningSettings}
              canGenerate={Boolean(roadGeoJson)}
              generateDisabledReason={generateDisabledReason}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
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
          <aside className="gis-analysis-dock" aria-label="Route analysis panel">
            <button type="button" className="back-to-selection" onClick={() => setWorkspaceMode("selection")}>
              杩斿洖鏅鸿兘閫夊瀷
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
                <h2>No route generated</h2>
                <p className="muted">Return to route selection and generate a Full OSM route before analysis.</p>
              </section>
            )}
          </aside>
        )}

        <details className="gis-utility-details" aria-label="GIS layers and services">
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
