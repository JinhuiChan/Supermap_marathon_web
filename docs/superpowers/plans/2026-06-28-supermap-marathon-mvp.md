# SuperMap Marathon MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first runnable WebGIS competition MVP for marathon route selection, with route display, route metrics, 2-5 route comparison, charts, recommendation output, and an exportable report view.

**Architecture:** Start with a browser-only Vite + React + TypeScript app using local mock route data so the judging demo is stable before iServer integration. Keep GIS access behind a `mapAdapter` boundary so the UI can run with a lightweight SVG map placeholder during early development and later switch to SuperMap iClient/iServer layers without rewriting route comparison logic.

**Tech Stack:** Vite, React, TypeScript, Vitest, CSS modules/plain CSS, browser local data, SuperMap iClient JavaScript/iClient3D integration boundary.

---

## File Structure

- Create `E:\SuperMap\超图\Supermap_marathon_web\package.json`: npm scripts and project dependencies.
- Create `E:\SuperMap\超图\Supermap_marathon_web\index.html`: Vite HTML entry.
- Create `E:\SuperMap\超图\Supermap_marathon_web\tsconfig.json`: TypeScript app settings.
- Create `E:\SuperMap\超图\Supermap_marathon_web\vite.config.ts`: Vite and Vitest configuration.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\main.tsx`: React entry.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\App.tsx`: application shell and state wiring.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\styles.css`: complete workbench styling.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\data\routes.ts`: Wuhan marathon demo route data.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\domain\routeMetrics.ts`: scoring, ranking, runner-fit, and comparison logic.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\domain\routeMetrics.test.ts`: Vitest coverage for scoring and comparison.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\components\RouteMap.tsx`: route map display boundary.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\components\RouteLibrary.tsx`: route selection and compare-list management.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\components\RouteDetails.tsx`: single route metric panel.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\components\ComparisonPanel.tsx`: multi-route table, bars, profile chart, and recommendation.
- Create `E:\SuperMap\超图\Supermap_marathon_web\src\components\ExportPanel.tsx`: report text generation and download.
- Modify `E:\SuperMap\超图\Supermap_marathon_web\README.md`: development, run, and competition demo instructions.

## Task 1: Scaffold the Frontend App

**Files:**
- Create: `E:\SuperMap\超图\Supermap_marathon_web\package.json`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\index.html`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\tsconfig.json`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\vite.config.ts`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\main.tsx`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\App.tsx`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\styles.css`

- [ ] **Step 1: Create npm project metadata**

Create `package.json`:

```json
{
  "name": "supermap-marathon-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create Vite entry files**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SuperMap 马拉松赛道选型系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node"
  }
});
```

- [ ] **Step 3: Create the minimal React entry**

Create `src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <section className="empty-state">
        <h1>SuperMap 马拉松赛道选型系统</h1>
        <p>正在搭建第一版比赛演示工作台。</p>
      </section>
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #17202a;
  background: #f4f7fb;
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
}

.empty-state {
  max-width: 720px;
  padding: 32px;
  text-align: center;
}
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
npm.cmd install
```

Expected: `node_modules` and `package-lock.json` are created without dependency resolution errors.

- [ ] **Step 5: Verify the scaffold**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript and Vite build complete and create `dist`.

- [ ] **Step 6: Commit the scaffold**

```powershell
git add package.json package-lock.json index.html tsconfig.json vite.config.ts src
git commit -m "feat: scaffold marathon web app"
```

## Task 2: Add Route Data and Metric Logic

**Files:**
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\data\routes.ts`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\domain\routeMetrics.ts`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\domain\routeMetrics.test.ts`

- [ ] **Step 1: Write failing tests for route scoring**

Create `src/domain/routeMetrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compareRoutes, getDifficultyLabel, scoreRoute } from "./routeMetrics";

const easyRoute = {
  id: "easy",
  name: "江滩平缓线",
  color: "#1f77b4",
  lengthKm: 42.195,
  closedLoop: true,
  coordinates: [
    [0, 0],
    [1, 1]
  ] as [number, number][],
  elevationProfile: [
    { km: 0, elevation: 24, slope: 0.2 },
    { km: 1, elevation: 25, slope: 0.4 }
  ],
  metrics: {
    totalClimbM: 88,
    avgSlopePercent: 0.7,
    maxSlopePercent: 2.4,
    longSteepRatio: 0.04,
    sharpTurnRatio: 0.08,
    narrowRoadRatio: 0.06,
    supplyCoverageRatio: 0.92,
    medicalAvgIntervalKm: 4.2,
    parkingServiceScore: 86,
    shadeCoverageRatio: 0.68
  }
};

const hardRoute = {
  ...easyRoute,
  id: "hard",
  name: "东湖爬坡线",
  metrics: {
    ...easyRoute.metrics,
    totalClimbM: 410,
    avgSlopePercent: 3.8,
    maxSlopePercent: 8.2,
    longSteepRatio: 0.34,
    supplyCoverageRatio: 0.58,
    medicalAvgIntervalKm: 8.8
  }
};

describe("routeMetrics", () => {
  it("scores an easier route lower than a harder route", () => {
    expect(scoreRoute(easyRoute).difficultyScore).toBeLessThan(scoreRoute(hardRoute).difficultyScore);
  });

  it("labels difficulty from score", () => {
    expect(getDifficultyLabel(22)).toBe("精英 PB 友好");
    expect(getDifficultyLabel(52)).toBe("大众稳健完赛");
    expect(getDifficultyLabel(82)).toBe("高难度挑战");
  });

  it("sorts compared routes by recommendation score descending", () => {
    const result = compareRoutes([hardRoute, easyRoute]);
    expect(result[0].id).toBe("easy");
    expect(result[0].rank).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test
```

Expected: FAIL because `routeMetrics.ts` does not exist.

- [ ] **Step 3: Add domain types and scoring implementation**

Create `src/domain/routeMetrics.ts`:

```ts
export type Coordinate = [number, number];

export interface ElevationPoint {
  km: number;
  elevation: number;
  slope: number;
}

export interface RouteMetrics {
  totalClimbM: number;
  avgSlopePercent: number;
  maxSlopePercent: number;
  longSteepRatio: number;
  sharpTurnRatio: number;
  narrowRoadRatio: number;
  supplyCoverageRatio: number;
  medicalAvgIntervalKm: number;
  parkingServiceScore: number;
  shadeCoverageRatio: number;
}

export interface MarathonRoute {
  id: string;
  name: string;
  color: string;
  lengthKm: number;
  closedLoop: boolean;
  coordinates: Coordinate[];
  elevationProfile: ElevationPoint[];
  metrics: RouteMetrics;
}

export interface RouteScore {
  id: string;
  name: string;
  difficultyScore: number;
  supportScore: number;
  recommendationScore: number;
  difficultyLabel: string;
  runnerFit: string;
  rank: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);

export function getDifficultyLabel(score: number) {
  if (score < 35) return "精英 PB 友好";
  if (score < 70) return "大众稳健完赛";
  return "高难度挑战";
}

export function scoreRoute(route: MarathonRoute): RouteScore {
  const m = route.metrics;
  const terrain =
    clamp(m.totalClimbM / 5) * 0.3 +
    clamp(m.avgSlopePercent * 14) * 0.25 +
    clamp(m.maxSlopePercent * 8) * 0.2 +
    clamp(m.longSteepRatio * 100) * 0.25;
  const passage = clamp(m.sharpTurnRatio * 100) * 0.45 + clamp(m.narrowRoadRatio * 100) * 0.55;
  const support =
    clamp(m.supplyCoverageRatio * 100) * 0.38 +
    clamp(100 - m.medicalAvgIntervalKm * 8) * 0.34 +
    clamp(m.parkingServiceScore) * 0.16 +
    clamp(m.shadeCoverageRatio * 100) * 0.12;
  const difficultyScore = clamp(terrain * 0.58 + passage * 0.22 + (100 - support) * 0.2);
  const recommendationScore = clamp(100 - difficultyScore * 0.72 + support * 0.28);

  return {
    id: route.id,
    name: route.name,
    difficultyScore: Math.round(difficultyScore),
    supportScore: Math.round(support),
    recommendationScore: Math.round(recommendationScore),
    difficultyLabel: getDifficultyLabel(difficultyScore),
    runnerFit: getDifficultyLabel(difficultyScore),
    rank: 0
  };
}

export function compareRoutes(routes: MarathonRoute[]): RouteScore[] {
  return routes
    .map(scoreRoute)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
```

- [ ] **Step 4: Add demo route data**

Create `src/data/routes.ts` with three Wuhan demo routes using the `MarathonRoute` type and distinct colors:

```ts
import type { MarathonRoute } from "../domain/routeMetrics";

export const demoRoutes: MarathonRoute[] = [
  {
    id: "river-loop",
    name: "两江四岸平缓线",
    color: "#1f77b4",
    lengthKm: 42.195,
    closedLoop: true,
    coordinates: [
      [114.292, 30.584],
      [114.305, 30.598],
      [114.328, 30.61],
      [114.35, 30.594],
      [114.333, 30.57],
      [114.305, 30.563],
      [114.292, 30.584]
    ],
    elevationProfile: [
      { km: 0, elevation: 24, slope: 0.2 },
      { km: 5, elevation: 26, slope: 0.4 },
      { km: 10, elevation: 28, slope: 0.3 },
      { km: 15, elevation: 30, slope: 0.6 },
      { km: 20, elevation: 27, slope: -0.4 },
      { km: 25, elevation: 25, slope: -0.2 },
      { km: 30, elevation: 29, slope: 0.5 },
      { km: 35, elevation: 27, slope: -0.3 },
      { km: 42.195, elevation: 24, slope: -0.2 }
    ],
    metrics: {
      totalClimbM: 96,
      avgSlopePercent: 0.8,
      maxSlopePercent: 2.7,
      longSteepRatio: 0.05,
      sharpTurnRatio: 0.1,
      narrowRoadRatio: 0.07,
      supplyCoverageRatio: 0.93,
      medicalAvgIntervalKm: 4.1,
      parkingServiceScore: 88,
      shadeCoverageRatio: 0.62
    }
  },
  {
    id: "east-lake",
    name: "东湖绿道景观线",
    color: "#2ca02c",
    lengthKm: 42.195,
    closedLoop: true,
    coordinates: [
      [114.365, 30.548],
      [114.395, 30.56],
      [114.43, 30.575],
      [114.45, 30.555],
      [114.418, 30.528],
      [114.382, 30.532],
      [114.365, 30.548]
    ],
    elevationProfile: [
      { km: 0, elevation: 32, slope: 0.3 },
      { km: 5, elevation: 45, slope: 1.8 },
      { km: 10, elevation: 66, slope: 2.4 },
      { km: 15, elevation: 51, slope: -1.6 },
      { km: 20, elevation: 58, slope: 1.2 },
      { km: 25, elevation: 72, slope: 2.1 },
      { km: 30, elevation: 47, slope: -2.3 },
      { km: 35, elevation: 40, slope: -1.1 },
      { km: 42.195, elevation: 32, slope: -0.5 }
    ],
    metrics: {
      totalClimbM: 258,
      avgSlopePercent: 2.1,
      maxSlopePercent: 5.9,
      longSteepRatio: 0.21,
      sharpTurnRatio: 0.16,
      narrowRoadRatio: 0.11,
      supplyCoverageRatio: 0.81,
      medicalAvgIntervalKm: 5.6,
      parkingServiceScore: 78,
      shadeCoverageRatio: 0.76
    }
  },
  {
    id: "urban-core",
    name: "城市核心保障线",
    color: "#d62728",
    lengthKm: 42.195,
    closedLoop: true,
    coordinates: [
      [114.27, 30.59],
      [114.292, 30.612],
      [114.322, 30.62],
      [114.35, 30.604],
      [114.345, 30.576],
      [114.31, 30.555],
      [114.276, 30.566],
      [114.27, 30.59]
    ],
    elevationProfile: [
      { km: 0, elevation: 26, slope: 0.2 },
      { km: 5, elevation: 29, slope: 0.5 },
      { km: 10, elevation: 37, slope: 1.2 },
      { km: 15, elevation: 35, slope: -0.3 },
      { km: 20, elevation: 42, slope: 1.3 },
      { km: 25, elevation: 39, slope: -0.6 },
      { km: 30, elevation: 31, slope: -0.7 },
      { km: 35, elevation: 28, slope: -0.4 },
      { km: 42.195, elevation: 26, slope: -0.2 }
    ],
    metrics: {
      totalClimbM: 148,
      avgSlopePercent: 1.2,
      maxSlopePercent: 4.1,
      longSteepRatio: 0.1,
      sharpTurnRatio: 0.23,
      narrowRoadRatio: 0.18,
      supplyCoverageRatio: 0.96,
      medicalAvgIntervalKm: 3.2,
      parkingServiceScore: 92,
      shadeCoverageRatio: 0.48
    }
  }
];
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```powershell
npm.cmd test
```

Expected: three route metric tests pass.

- [ ] **Step 6: Commit metric logic**

```powershell
git add src/domain src/data
git commit -m "feat: add marathon route metrics"
```

## Task 3: Build the WebGIS Workbench Layout

**Files:**
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\src\App.tsx`
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\src\styles.css`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\components\RouteMap.tsx`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\components\RouteLibrary.tsx`
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\components\RouteDetails.tsx`

- [ ] **Step 1: Create route map component**

Create `src/components/RouteMap.tsx`:

```tsx
import type { MarathonRoute } from "../domain/routeMetrics";

interface RouteMapProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  onSelectRoute: (id: string) => void;
}

export function RouteMap({ routes, activeRouteId, comparedRouteIds, onSelectRoute }: RouteMapProps) {
  const minLon = 114.25;
  const maxLon = 114.47;
  const minLat = 30.52;
  const maxLat = 30.63;
  const project = ([lon, lat]: [number, number]) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
    return `${x},${y}`;
  };

  return (
    <section className="map-panel" aria-label="武汉马拉松赛道地图">
      <div className="map-toolbar">
        <span>武汉 WebGIS 赛道工作台</span>
        <strong>{comparedRouteIds.length}/5 已加入对比</strong>
      </div>
      <svg viewBox="0 0 100 100" role="img" aria-label="路线示意图">
        <rect x="0" y="0" width="100" height="100" rx="0" className="map-bg" />
        <path d="M7 48 C22 38 32 62 46 49 S74 40 92 55" className="river" />
        <path d="M14 20 L86 84 M10 74 L88 22 M24 8 L40 92 M62 5 L70 95" className="road-grid" />
        {routes.map((route) => {
          const points = route.coordinates.map(project).join(" ");
          const isActive = route.id === activeRouteId;
          const isCompared = comparedRouteIds.includes(route.id);
          return (
            <polyline
              key={route.id}
              points={points}
              fill="none"
              stroke={route.color}
              strokeWidth={isActive ? 2.8 : isCompared ? 2.2 : 1.3}
              opacity={isActive || isCompared ? 1 : 0.42}
              className="route-line"
              onClick={() => onSelectRoute(route.id)}
            />
          );
        })}
      </svg>
    </section>
  );
}
```

- [ ] **Step 2: Create route library component**

Create `src/components/RouteLibrary.tsx`:

```tsx
import type { MarathonRoute } from "../domain/routeMetrics";

interface RouteLibraryProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  onSelectRoute: (id: string) => void;
  onToggleCompare: (id: string) => void;
}

export function RouteLibrary({
  routes,
  activeRouteId,
  comparedRouteIds,
  onSelectRoute,
  onToggleCompare
}: RouteLibraryProps) {
  return (
    <section className="side-section">
      <h2>候选赛道库</h2>
      <div className="route-list">
        {routes.map((route) => {
          const selected = comparedRouteIds.includes(route.id);
          return (
            <article className={`route-card ${route.id === activeRouteId ? "active" : ""}`} key={route.id}>
              <button type="button" className="route-title" onClick={() => onSelectRoute(route.id)}>
                <span style={{ backgroundColor: route.color }} />
                {route.name}
              </button>
              <p>{route.lengthKm.toFixed(3)} km · {route.closedLoop ? "闭环" : "非闭环"}</p>
              <label className="compare-toggle">
                <input type="checkbox" checked={selected} onChange={() => onToggleCompare(route.id)} />
                加入对比
              </label>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create route details component**

Create `src/components/RouteDetails.tsx`:

```tsx
import type { MarathonRoute } from "../domain/routeMetrics";
import { scoreRoute } from "../domain/routeMetrics";

interface RouteDetailsProps {
  route: MarathonRoute;
}

export function RouteDetails({ route }: RouteDetailsProps) {
  const score = scoreRoute(route);
  const metrics = route.metrics;

  return (
    <section className="side-section">
      <h2>单路线详情</h2>
      <div className="score-summary">
        <strong>{score.difficultyLabel}</strong>
        <span>综合推荐 {score.recommendationScore}</span>
      </div>
      <dl className="metric-grid">
        <div><dt>总爬升</dt><dd>{metrics.totalClimbM} m</dd></div>
        <div><dt>平均坡度</dt><dd>{metrics.avgSlopePercent}%</dd></div>
        <div><dt>最大坡度</dt><dd>{metrics.maxSlopePercent}%</dd></div>
        <div><dt>补给覆盖</dt><dd>{Math.round(metrics.supplyCoverageRatio * 100)}%</dd></div>
        <div><dt>医疗间隔</dt><dd>{metrics.medicalAvgIntervalKm} km</dd></div>
        <div><dt>遮阴覆盖</dt><dd>{Math.round(metrics.shadeCoverageRatio * 100)}%</dd></div>
      </dl>
    </section>
  );
}
```

- [ ] **Step 4: Wire layout in App**

Replace `src/App.tsx`:

```tsx
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
          <p>下一任务接入指标表格、图表和推荐结论。</p>
        </section>
      </aside>
    </main>
  );
}
```

- [ ] **Step 5: Replace base styles with workbench layout**

Replace `src/styles.css` with a complete responsive workbench stylesheet containing `.app-shell`, `.left-panel`, `.right-panel`, `.map-panel`, `.route-card`, `.metric-grid`, `.score-summary`, `.route-line`, `.river`, `.road-grid`, and mobile breakpoints.

- [ ] **Step 6: Verify layout build**

Run:

```powershell
npm.cmd run build
```

Expected: build passes.

- [ ] **Step 7: Commit layout**

```powershell
git add src/App.tsx src/components src/styles.css
git commit -m "feat: build route workbench layout"
```

## Task 4: Add Multi-Route Comparison

**Files:**
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\components\ComparisonPanel.tsx`
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\src\App.tsx`
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\src\styles.css`

- [ ] **Step 1: Create comparison component**

Create `src/components/ComparisonPanel.tsx`:

```tsx
import type { MarathonRoute } from "../domain/routeMetrics";
import { compareRoutes } from "../domain/routeMetrics";

interface ComparisonPanelProps {
  routes: MarathonRoute[];
}

export function ComparisonPanel({ routes }: ComparisonPanelProps) {
  const scores = compareRoutes(routes);
  const winner = scores[0];

  if (routes.length < 2) {
    return (
      <section className="side-section">
        <h2>多路线对比</h2>
        <p>请选择至少 2 条赛道加入对比。</p>
      </section>
    );
  }

  return (
    <section className="side-section comparison">
      <h2>多路线对比</h2>
      <div className="recommendation">
        <span>推荐方案</span>
        <strong>{winner.name}</strong>
        <p>推荐分 {winner.recommendationScore}，适配：{winner.runnerFit}</p>
      </div>
      <table className="compare-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>路线</th>
            <th>难度</th>
            <th>保障</th>
            <th>推荐</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score) => (
            <tr key={score.id}>
              <td>{score.rank}</td>
              <td>{score.name}</td>
              <td>{score.difficultyScore}</td>
              <td>{score.supportScore}</td>
              <td>{score.recommendationScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bar-chart">
        {scores.map((score) => (
          <div className="bar-row" key={score.id}>
            <span>{score.name}</span>
            <div><i style={{ width: `${score.recommendationScore}%` }} /></div>
            <b>{score.recommendationScore}</b>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 100 42" className="profile-chart" role="img" aria-label="多路线坡度剖面对比">
        {routes.map((route) => {
          const points = route.elevationProfile
            .map((point) => `${(point.km / 42.195) * 100},${38 - Math.min(point.elevation, 95) * 0.32}`)
            .join(" ");
          return <polyline key={route.id} points={points} fill="none" stroke={route.color} strokeWidth="1.5" />;
        })}
      </svg>
    </section>
  );
}
```

- [ ] **Step 2: Wire comparison into App**

In `src\App.tsx`, compute `comparedRoutes` from `comparedRouteIds` and replace the placeholder right panel content with:

```tsx
<ComparisonPanel routes={comparedRoutes} />
```

- [ ] **Step 3: Add comparison styles**

Append styles for `.comparison`, `.recommendation`, `.compare-table`, `.bar-chart`, `.bar-row`, and `.profile-chart` to `src/styles.css`.

- [ ] **Step 4: Build and test**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: tests pass and build succeeds.

- [ ] **Step 5: Commit comparison feature**

```powershell
git add src/App.tsx src/components/ComparisonPanel.tsx src/styles.css
git commit -m "feat: add multi-route comparison"
```

## Task 5: Add Exportable Report Text

**Files:**
- Create: `E:\SuperMap\超图\Supermap_marathon_web\src\components\ExportPanel.tsx`
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\src\App.tsx`
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\src\styles.css`

- [ ] **Step 1: Create export panel**

Create `src/components/ExportPanel.tsx`:

```tsx
import type { MarathonRoute } from "../domain/routeMetrics";
import { compareRoutes } from "../domain/routeMetrics";

interface ExportPanelProps {
  routes: MarathonRoute[];
}

export function ExportPanel({ routes }: ExportPanelProps) {
  const scores = compareRoutes(routes);
  const report = [
    "马拉松赛道多路线对比分析报告",
    "",
    ...scores.map(
      (score) =>
        `${score.rank}. ${score.name}：推荐分 ${score.recommendationScore}，难度 ${score.difficultyScore}，保障 ${score.supportScore}，适配 ${score.runnerFit}`
    )
  ].join("\n");

  const download = () => {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "marathon-route-comparison-report.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="side-section export-panel">
      <h2>成果导出</h2>
      <textarea readOnly value={report} />
      <button type="button" onClick={download} disabled={routes.length < 2}>
        导出对比报告
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Wire export into App**

Import `ExportPanel` and render it under `ComparisonPanel`:

```tsx
<ExportPanel routes={comparedRoutes} />
```

- [ ] **Step 3: Add export styles**

Append styles for `.export-panel textarea` and `.export-panel button` to `src/styles.css`.

- [ ] **Step 4: Build**

Run:

```powershell
npm.cmd run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit export feature**

```powershell
git add src/App.tsx src/components/ExportPanel.tsx src/styles.css
git commit -m "feat: add comparison report export"
```

## Task 6: Document Local Run and SuperMap Integration Path

**Files:**
- Modify: `E:\SuperMap\超图\Supermap_marathon_web\README.md`

- [ ] **Step 1: Replace README with run instructions**

Replace README content:

```md
# Supermap_marathon_web

基于 SuperMap WebGIS 的马拉松赛道智能选型与多路线对比分析系统。

## 第一版目标

第一版先完成比赛可演示闭环：候选赛道展示、单路线指标、多路线对比、坡度剖面、推荐结论和报告导出。

## 本地运行

```powershell
npm.cmd install
npm.cmd run dev
```

打开终端输出的本地地址。

## 验证

```powershell
npm.cmd test
npm.cmd run build
```

## SuperMap 接入路径

1. 使用 SuperMap iDesktopX 处理 DEM、路网、POI 和路线数据。
2. 使用 SuperMap iServer 发布二维地图、三维场景和空间分析服务。
3. 前端当前使用示范路线数据，后续通过统一数据接口替换为 iServer 返回结果。
4. 多路线对比、评分和推荐逻辑保留在前端领域模块中，便于演示和测试。
```

- [ ] **Step 2: Verify README formatting**

Run:

```powershell
Get-Content -LiteralPath README.md -Encoding UTF8
```

Expected: README includes local run, validation, and SuperMap integration sections.

- [ ] **Step 3: Commit docs**

```powershell
git add README.md
git commit -m "docs: add local run instructions"
```

## Task 7: Final Verification and Demo Server

**Files:**
- No file changes unless verification exposes a defect.

- [ ] **Step 1: Run tests**

Run:

```powershell
npm.cmd test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Build production assets**

Run:

```powershell
npm.cmd run build
```

Expected: Vite creates `dist` with no TypeScript errors.

- [ ] **Step 3: Start local dev server**

Run:

```powershell
npm.cmd run dev
```

Expected: Vite prints a localhost URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 4: Browser verification**

Open the local URL in Edge and verify:

1. Route map is visible.
2. Clicking a route changes the single-route detail panel.
3. Selecting 2-5 routes updates the comparison count.
4. Comparison table, bar chart, and profile chart display selected routes.
5. Export button downloads a text report when at least 2 routes are selected.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes:

```powershell
git add src README.md
git commit -m "fix: polish marathon demo verification"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers the confirmed MVP: route library, route metrics, 2-5 route comparison, charts, recommendation output, export, and local run documentation. iDesktopX/iServer processing and real SuperMap service publishing are represented as the integration path after the first working demo.
- Placeholder scan: No unresolved placeholder markers are present. The only future-facing scope is explicitly framed as a later integration path after the MVP.
- Type consistency: `MarathonRoute`, `RouteMetrics`, `RouteScore`, and component props use the same names across data, domain, tests, and UI tasks.

