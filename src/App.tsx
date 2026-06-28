import { useMemo, useState } from "react";
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
        <section className="side-section">
          <h2>多路线对比</h2>
          <p className="muted">下一步接入指标表格、图表和推荐结论。</p>
        </section>
      </aside>
    </main>
  );
}
