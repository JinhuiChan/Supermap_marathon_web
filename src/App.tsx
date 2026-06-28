import { useMemo, useState } from "react";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { ExportPanel } from "./components/ExportPanel";
import { RouteDetails } from "./components/RouteDetails";
import { RouteLibrary } from "./components/RouteLibrary";
import { RouteMap } from "./components/RouteMap";
import { demoRoutes } from "./data/routes";

export default function App() {
  const [activeRouteId, setActiveRouteId] = useState(demoRoutes[0].id);
  const [comparedRouteIds, setComparedRouteIds] = useState<string[]>([demoRoutes[0].id, demoRoutes[1].id]);
  const activeRoute = useMemo(
    () => demoRoutes.find((route) => route.id === activeRouteId) ?? demoRoutes[0],
    [activeRouteId]
  );
  const comparedRoutes = useMemo(
    () => demoRoutes.filter((route) => comparedRouteIds.includes(route.id)),
    [comparedRouteIds]
  );

  const toggleCompare = (id: string) => {
    setComparedRouteIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  return (
    <main className="app-shell">
      <aside className="left-panel">
        <RouteLibrary
          routes={demoRoutes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          onSelectRoute={setActiveRouteId}
          onToggleCompare={toggleCompare}
        />
        <RouteDetails route={activeRoute} />
      </aside>
      <RouteMap
        routes={demoRoutes}
        activeRouteId={activeRouteId}
        comparedRouteIds={comparedRouteIds}
        onSelectRoute={setActiveRouteId}
      />
      <aside className="right-panel">
        <ComparisonPanel routes={comparedRoutes} />
        <ExportPanel routes={comparedRoutes} />
      </aside>
    </main>
  );
}
