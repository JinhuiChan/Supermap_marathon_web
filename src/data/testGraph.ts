import type { RoadEdge, RoadNode } from "../domain/roadNetwork";
import { addEdge, addNode, createEmptyGraph } from "../domain/roadNetwork";
import { haversineKm } from "../domain/roadAttributes";
import type { RoadLevel } from "../domain/roadNetwork";

function makeNode(id: string, lon: number, lat: number): RoadNode {
  return { id, coordinate: [lon, lat] };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  roadLevel: RoadLevel,
  graph: ReturnType<typeof createEmptyGraph>,
  isBridge = false,
  isTunnel = false
): RoadEdge {
  const fromNode = graph.nodes.get(from);
  const toNode = graph.nodes.get(to);
  if (!fromNode || !toNode) throw new Error(`missing nodes: ${from} ${to}`);
  const lengthKm = haversineKm(fromNode.coordinate, toNode.coordinate);
  return {
    id,
    fromNodeId: from,
    toNodeId: to,
    lengthKm,
    roadLevel,
    isBridge,
    isTunnel,
    baselineCost: lengthKm
  };
}

export function buildTestGraph() {
  const g = createEmptyGraph();

  // ======= HANKOU grid (north bank, 114.25-114.37, 30.58-30.64) =======
  // 5x5 grid of primary + secondary roads
  const hkLons = [114.26, 114.285, 114.31, 114.335, 114.36];
  const hkLats = [30.59, 30.602, 30.614, 30.626, 30.638];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const id = `hk_${r}${c}`;
      addNode(g, makeNode(id, hkLons[c], hkLats[r]));
    }
  }

  // horizontal edges
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      const level: RoadLevel = r === 1 ? "trunk" : c === 0 || c === 3 ? "primary" : "secondary";
      const e = makeEdge(`hk_h_${r}${c}`, `hk_${r}${c}`, `hk_${r}${c + 1}`, level, g);
      addEdge(g, e);
    }
  }

  // vertical edges
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const level: RoadLevel = c === 2 ? "trunk" : c === 0 || c === 4 ? "primary" : "secondary";
      const e = makeEdge(`hk_v_${r}${c}`, `hk_${r}${c}`, `hk_${r + 1}${c}`, level, g);
      addEdge(g, e);
    }
  }

  // ======= WUCHANG grid (south bank, 114.28-114.38, 30.52-30.58) =======
  const wcLons = [114.28, 114.305, 114.33, 114.355, 114.38];
  const wcLats = [30.53, 30.543, 30.556, 30.569, 30.582];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const id = `wc_${r}${c}`;
      addNode(g, makeNode(id, wcLons[c], wcLats[r]));
    }
  }

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      const level: RoadLevel = r === 3 ? "trunk" : c === 0 ? "primary" : "secondary";
      const e = makeEdge(`wc_h_${r}${c}`, `wc_${r}${c}`, `wc_${r}${c + 1}`, level, g);
      addEdge(g, e);
    }
  }

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const level: RoadLevel = c === 3 ? "trunk" : c === 0 || c === 4 ? "primary" : "secondary";
      const e = makeEdge(`wc_v_${r}${c}`, `wc_${r}${c}`, `wc_${r + 1}${c}`, level, g);
      addEdge(g, e);
    }
  }

  // ======= BRIDGES crossing Yangtze (Hankou-Wuchang) =======
  // Bridge 1: 长江大桥 — hk row4 col1 → wc row4 col1
  addEdge(g, makeEdge("bridge_yangtze_1", "hk_41", "wc_41", "trunk", g, true, false));
  // Bridge 2: 二七长江大桥 — hk row4 col3 → wc row4 col3
  addEdge(g, makeEdge("bridge_yangtze_2", "hk_43", "wc_43", "trunk", g, true, false));

  // ======= EAST LAKE greenway loop (114.38-114.46, 30.53-30.58) =======
  const lakeNodes = [
    makeNode("lake_n", 114.41, 30.575),
    makeNode("lake_ne", 114.44, 30.565),
    makeNode("lake_e", 114.447, 30.55),
    makeNode("lake_se", 114.44, 30.535),
    makeNode("lake_s", 114.41, 30.528),
    makeNode("lake_sw", 114.385, 30.535),
    makeNode("lake_w", 114.383, 30.55),
  ];

  for (const n of lakeNodes) addNode(g, n);

  for (let i = 0; i < lakeNodes.length; i++) {
    const next = (i + 1) % lakeNodes.length;
    addEdge(g, makeEdge(`lake_loop_${i}`, lakeNodes[i].id, lakeNodes[next].id, "greenway", g));
  }
  // Cross-lake connection
  addEdge(g, makeEdge("lake_cross", "lake_w", "lake_e", "greenway", g));

  // Connect lake to Wuchang grid
  addEdge(g, makeEdge("lake_to_wc", "lake_sw", "wc_24", "secondary", g));
  // Connect lake to east side
  addEdge(g, makeEdge("lake_to_wc2", "lake_s", "wc_23", "secondary", g));

  // ======= QINGSHAN area (east end, 114.38-114.48, 30.60-30.64) =======
  const qsLons = [114.38, 114.41, 114.44, 114.465];
  const qsLats = [30.605, 30.62, 30.635];

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const id = `qs_${r}${c}`;
      addNode(g, makeNode(id, qsLons[c], qsLats[r]));
    }
  }

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const level: RoadLevel = r === 1 ? "primary" : "secondary";
      addEdge(g, makeEdge(`qs_h_${r}${c}`, `qs_${r}${c}`, `qs_${r}${c + 1}`, level, g));
    }
  }

  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const level: RoadLevel = c === 1 ? "primary" : "tertiary";
      addEdge(g, makeEdge(`qs_v_${r}${c}`, `qs_${r}${c}`, `qs_${r + 1}${c}`, level, g));
    }
  }

  // Connect Qingshan to Hankou (north-east)
  addEdge(g, makeEdge("qs_to_hk", "qs_00", "hk_44", "primary", g));
  // Connect Qingshan to East Lake (south)
  addEdge(g, makeEdge("qs_to_lake", "qs_22", "lake_ne", "secondary", g));
  // Connect Qingshan to Wuchang
  addEdge(g, makeEdge("qs_to_wc", "qs_10", "wc_34", "primary", g));

  // ======= TUNNELS (a few) =======
  addEdge(g, makeEdge("tunnel_wc_1", "wc_12", "wc_22", "secondary", g, false, true));
  addEdge(g, makeEdge("tunnel_qs_1", "qs_11", "qs_12", "tertiary", g, false, true));

  // ======= Some residential/track roads for diversity =======
  addEdge(g, makeEdge("res_hk_1", "hk_00", "hk_11", "residential", g));
  addEdge(g, makeEdge("res_hk_2", "hk_23", "hk_32", "residential", g));
  addEdge(g, makeEdge("res_wc_1", "wc_01", "wc_12", "residential", g));
  addEdge(g, makeEdge("track_wc_1", "wc_30", "wc_31", "track", g));
  addEdge(g, makeEdge("res_qs_1", "qs_02", "qs_13", "residential", g));

  return g;
}
