import type { MapPoiLabel } from "../map/layers/PoiLabelLayer";

export const wuhanLandmarkPoiLabels: MapPoiLabel[] = [
  { id: "landmark-yellow-crane-tower", name: "黄鹤楼", kind: "park", coordinate: [114.3063, 30.5448], minZoom: 10, priority: 120, source: "local" },
  { id: "landmark-east-lake-greenway", name: "东湖绿道", kind: "park", coordinate: [114.4072, 30.5485], minZoom: 10, priority: 118, source: "local" },
  { id: "landmark-wuhan-yangtze-bridge", name: "武汉长江大桥", kind: "traffic", coordinate: [114.2955, 30.5488], minZoom: 10, priority: 116, source: "local" },
  { id: "landmark-hankou-river-beach", name: "汉口江滩", kind: "park", coordinate: [114.3001, 30.5957], minZoom: 10, priority: 114, source: "local" },
  { id: "landmark-hubei-museum", name: "湖北省博物馆", kind: "park", coordinate: [114.3671, 30.5618], minZoom: 11, priority: 106, source: "local" },
  { id: "landmark-chuhe-hanjie", name: "楚河汉街", kind: "commercial", coordinate: [114.3402, 30.5582], minZoom: 11, priority: 104, source: "local" },
  { id: "landmark-wuhan-sports-center", name: "武汉体育中心", kind: "traffic", coordinate: [114.1669, 30.5075], minZoom: 11, priority: 96, source: "local" }
];
