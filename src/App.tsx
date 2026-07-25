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
import { RouteWaypointPanel } from "./components/RouteWaypointPanel";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import { activeCityPackage, type CityPackage } from "./config/cityPackages";
import {
  buildFullOsmAllWaypointRouteAsync,
  getWaypointHitDistancesM,
  type FullOsmRouteProgressEvent
} from "./data/fullOsmAllWaypointRoute";
import type { WaypointRoutePlan } from "./data/profileRoutePlanner";
import { upsertGeneratedRoute } from "./domain/routeCollection";
import {
  compareRoutes,
  type MarathonRoute
} from "./domain/routeMetrics";
import { SuperMapMap, type MapLayerVisibility } from "./map/components/SuperMapMap";

interface AppProps {
  cityPackage?: CityPackage;
  initialLayerVisibility?: MapLayerVisibility;
}

export const routeCompareLimit = activeCityPackage.routePlans.length;

const waitForUiFrame = () => new Promise<void>((resolve) => window.setTimeout(resolve, 25));

export function updateComparedRouteIds(current: string[], id: string, limit = routeCompareLimit): string[] {
  if (current.includes(id)) return current;
  if (current.length >= limit) return current;
  return [...current, id];
}

function appendGeneratedComparedRouteId(current: string[], id: string, limit = routeCompareLimit): string[] {
  return [...current.filter((item) => item !== id).slice(-(limit - 1)), id];
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
  const routePlans = cityPackage.routePlans;
  const supportPoints = cityPackage.supportPoints;
  const cityRouteCompareLimit = routePlans.length;
  const [workspaceMode, setWorkspaceMode] = useState<GisWorkspaceMode>("selection");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [routes, setRoutes] = useState<MarathonRoute[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    const routingUrl = cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm;

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
  }, [cityPackage]);

  const generateRoute = (routeId: string) => {
    if (!roadGeoJson || isGenerating) return;

    const plan = routePlans.find((p) => p.id === routeId);
    if (!plan) return;

    setActiveRouteId(routeId);
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

  const generateDisabledReason = !roadGeoJson
    ? `Full OSM road network is still loading or failed. Check public/${cityPackage.superMap.routingRoadNetworkGeoJsonUrls.fullOsm}`
    : "";
  const hasCandidateRoutes = workspaceMode === "selection" && routes.length > 0;

  return (
    <main className={`app-shell gis-tool-shell ${workspaceMode} ${hasCandidateRoutes ? "has-candidates" : ""}`}>
      <header className="gis-app-header">
        <div className="gis-brand">
          <span>SuperMap WebGIS</span>
          <strong>{cityPackage.marathonName}</strong>
        </div>
        <GisModeNav mode={workspaceMode} onModeChange={setWorkspaceMode} />
      </header>

      <section className="gis-map-stage">
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
            />
            <RouteWaypointPanel activeRouteId={activeRouteId} routePlans={routePlans} />
          </aside>
        )}

        {hasCandidateRoutes && (
          <CandidateRouteDrawer
            routes={rankedRoutes}
            cityPackage={cityPackage}
            activeRouteId={activeRouteId}
            comparedRouteIds={comparedRouteIds}
            generationStatus={generationStatus}
            onSelectRoute={setActiveRouteId}
            onToggleCompare={toggleCompare}
            onAnalyzeRoute={analyzeRoute}
          />
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
    </main>
  );
}
