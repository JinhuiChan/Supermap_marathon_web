import type { RoadEdge, RoadGraph } from "./roadNetwork";
import type { RouteConstraints } from "./routeConstraints";
import { edgeInZone, snapToNearestNode } from "./routeConstraints";
import { haversineKm, qualityMultiplier } from "./roadAttributes";

class SeededRNG {
  private state: number;
  constructor(seed: number) { this.state = seed | 0; }
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export interface GenerationOptions {
  count: number;
  seed: number;
  maxIterations: number;
  lengthToleranceKm: number;
}
const DEFAULTS: GenerationOptions = { count: 3, seed: 42, maxIterations: 20, lengthToleranceKm: 2 };

export interface GeneratedPath {
  nodeIds: string[];
  edgeIds: string[];
  totalLengthKm: number;
}

// BFS: shortest path by edge count
function bfsPathBack(
  graph: RoadGraph, fromId: string, toId: string,
  forbidden: Set<string>, recentEdges: Set<string>
): GeneratedPath | null {
  const visited = new Set<string>([fromId]);
  const queue: { nodeId: string }[] = [{ nodeId: fromId }];
  const cameFrom = new Map<string, { prevId: string; prevEdgeId: string }>();

  for (let qi = 0; qi < queue.length; qi++) {
    const { nodeId } = queue[qi];
    if (nodeId === toId && qi > 0) {
      const n: string[] = [], e: string[] = [];
      let cur = nodeId;
      while (cur !== fromId) {
        n.unshift(cur);
        const entry = cameFrom.get(cur);
        if (!entry) break;
        e.unshift(entry.prevEdgeId);
        cur = entry.prevId;
      }
      n.unshift(fromId);
      return { nodeIds: n, edgeIds: e, totalLengthKm: 0 };
    }
    const out = graph.adjacency.get(nodeId);
    if (!out) continue;
    for (const edge of out) {
      const base = edge.id.replace("_rev", "");
      if (forbidden.has(base)) continue;
      if (recentEdges.has(base)) continue;
      if (visited.has(edge.toNodeId)) continue;
      visited.add(edge.toNodeId);
      cameFrom.set(edge.toNodeId, { prevId: nodeId, prevEdgeId: edge.id });
      queue.push({ nodeId: edge.toNodeId });
    }
  }
  return null;
}

// Greedy random walk with BFS closing
function simpleWalk(
  graph: RoadGraph,
  startId: string, endId: string,
  globalUsed: Map<string, number>,
  rng: SeededRNG,
  targetKm: number,
  forbidden: Set<string>,
  tolerance: number
): GeneratedPath | null {
  const walkNodes = [startId];
  const walkEdges: string[] = [];
  let walked = 0;
  let cur = startId;
  const recent: string[] = [];
  const COOLDOWN = 15;

  for (let step = 0; step < 600; step++) {
    // When within range, try BFS close
    if (walked >= targetKm - 10) {
      const back = bfsPathBack(graph, cur, endId, forbidden, new Set(recent.slice(-5)));
      if (back) {
        const backDist = back.edgeIds.reduce((s, id) => {
          const e = graph.edges.get(id);
          return s + (e ? e.lengthKm : 0);
        }, 0);
        const total = walked + backDist;
        if (Math.abs(total - targetKm) <= tolerance) {
          return {
            nodeIds: [...walkNodes, ...back.nodeIds.slice(1)],
            edgeIds: [...walkEdges, ...back.edgeIds],
            totalLengthKm: Math.round(total * 1000) / 1000
          };
        }
      }
    }

    // Walk one step
    const out = graph.adjacency.get(cur);
    if (!out || out.length === 0) break;

    const recentSet = new Set(recent.slice(-COOLDOWN));
    const available = out.filter((e) => !forbidden.has(e.id.replace("_rev", "")));
    if (available.length === 0) break;

    const scored = available.map((e) => {
      const base = e.id.replace("_rev", "");
      const gUsed = globalUsed.get(base) ?? 0;
      const recentPenalty = recentSet.has(base) ? 50 : 0;
      const q = 100 / qualityMultiplier(e.roadLevel, e.isTunnel);
      const d = Math.max(0, 100 - gUsed * 10 - recentPenalty);
      const j = rng.next() * 60;
      return { edge: e, base, score: q * 0.45 + d * 0.25 + j * 0.3 };
    });
    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(3, scored.length);
    const roll = rng.next();
    const idx = roll < 0.6 ? 0 : roll < 0.85 ? 1 : Math.floor(rng.next() * topN);
    const chosen = scored[Math.min(idx, scored.length - 1)].edge;

    recent.push(chosen.id.replace("_rev", ""));
    if (recent.length > COOLDOWN * 2) recent.shift();

    walked += chosen.lengthKm;
    walkNodes.push(chosen.toNodeId);
    walkEdges.push(chosen.id);
    cur = chosen.toNodeId;
  }

  // Final try
  if (walked >= targetKm - 5) {
    const back = bfsPathBack(graph, cur, endId, forbidden, new Set());
    if (back) {
      const backDist = back.edgeIds.reduce((s, id) => {
        const e = graph.edges.get(id);
        return s + (e ? e.lengthKm : 0);
      }, 0);
      const total = walked + backDist;
      if (Math.abs(total - targetKm) <= tolerance) {
        return {
          nodeIds: [...walkNodes, ...back.nodeIds.slice(1)],
          edgeIds: [...walkEdges, ...back.edgeIds],
          totalLengthKm: Math.round(total * 1000) / 1000
        };
      }
    }
  }

  return null;
}

export function generateRoutes(
  graph: RoadGraph,
  constraints: RouteConstraints,
  partialOptions?: Partial<GenerationOptions>
): GeneratedPath[] {
  const opts = { ...DEFAULTS, ...partialOptions };

  const startSnap = snapToNearestNode(graph, constraints.startPoint);
  const endSnap = snapToNearestNode(graph, constraints.endPoint);
  if (!startSnap || !endSnap) return [];

  const forbidden = new Set<string>();
  for (const zone of constraints.avoidZones) {
    for (const eid of graph.edges.keys()) {
      if (edgeInZone(graph, eid, zone)) forbidden.add(eid);
    }
  }

  const waypoints = [startSnap];
  for (const pt of constraints.mustPassPoints) {
    const s = snapToNearestNode(graph, pt);
    if (s) waypoints.push(s);
  }
  waypoints.push(endSnap);

  const segTargets: number[] = [];
  if (waypoints.length > 2) {
    let totalStraight = 0;
    const segs: number[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = graph.nodes.get(waypoints[i]);
      const b = graph.nodes.get(waypoints[i + 1]);
      const d = a && b ? haversineKm(a.coordinate, b.coordinate) : 1;
      segs.push(d);
      totalStraight += d;
    }
    for (const d of segs) segTargets.push((d / totalStraight) * constraints.targetDistanceKm);
  } else {
    segTargets.push(constraints.targetDistanceKm);
  }

  const globalUsed = new Map<string, number>();
  const candidates: GeneratedPath[] = [];

  for (let iter = 0; iter < opts.maxIterations && candidates.length < opts.count; iter++) {
    const fullNodes: string[] = [];
    const fullEdges: string[] = [];
    let ok = true;

    for (let s = 0; s < waypoints.length - 1; s++) {
      const srng = new SeededRNG(opts.seed + iter * 1000 + s * 100);
      const path = simpleWalk(
        graph, waypoints[s], waypoints[s + 1],
        globalUsed, srng, segTargets[s], forbidden, opts.lengthToleranceKm
      );
      if (!path) { ok = false; break; }

      if (fullNodes.length === 0) {
        fullNodes.push(...path.nodeIds);
        fullEdges.push(...path.edgeIds);
      } else {
        fullNodes.push(...path.nodeIds.slice(1));
        fullEdges.push(...path.edgeIds);
      }
    }

    if (!ok) continue;

    const total = fullEdges.reduce((s, id) => {
      const e = graph.edges.get(id);
      return s + (e ? e.lengthKm : 0);
    }, 0);

    if (Math.abs(total - constraints.targetDistanceKm) <= opts.lengthToleranceKm) {
      candidates.push({
        nodeIds: fullNodes,
        edgeIds: fullEdges,
        totalLengthKm: Math.round(total * 1000) / 1000
      });
      for (const eid of fullEdges) {
        const base = eid.replace("_rev", "");
        globalUsed.set(base, (globalUsed.get(base) ?? 0) + 1);
      }
    }
  }

  candidates.sort((a, b) =>
    Math.abs(a.totalLengthKm - constraints.targetDistanceKm) -
    Math.abs(b.totalLengthKm - constraints.targetDistanceKm)
  );
  return candidates.slice(0, opts.count);
}
