import {
  extractPoiLabelsFromSuperMapFeatures,
  type MapPoiLabel,
  type PoiLabelKind
} from "../map/layers/PoiLabelLayer";

export interface IserverPoiDataset {
  datasourceName: string;
  datasetName: string;
  kind: PoiLabelKind;
  maxLabels: number;
  minZoom: number;
}

type FetchLike = (input: string) => Promise<Response>;

export const defaultIserverPoiDatasets: IserverPoiDataset[] = [
  {
    datasourceName: "wuhan_marathon_base",
    datasetName: "constraint_sensitive_hospital_area",
    kind: "hospital",
    maxLabels: 120,
    minZoom: 10
  },
  {
    datasourceName: "wuhan_marathon_base",
    datasetName: "poi_traffic_station_area",
    kind: "traffic",
    maxLabels: 160,
    minZoom: 10
  },
  {
    datasourceName: "wuhan_marathon_base",
    datasetName: "park_green_osm",
    kind: "park",
    maxLabels: 140,
    minZoom: 12
  },
  {
    datasourceName: "wuhan_marathon_base",
    datasetName: "poi_commercial_potential_area",
    kind: "commercial",
    maxLabels: 140,
    minZoom: 13
  }
];

export async function fetchIserverPoiLabels(
  poiDataRestUrl: string,
  datasets = defaultIserverPoiDatasets,
  fetcher: FetchLike = fetch
): Promise<MapPoiLabel[]> {
  const layers = await Promise.all(
    datasets.map((dataset) => fetchDatasetPoiLabels(poiDataRestUrl, dataset, fetcher).catch(() => []))
  );
  return dedupePoiLabels(layers.flat());
}

export function buildDatasetFeaturesUrl(
  poiDataRestUrl: string,
  datasourceName: string,
  datasetName: string,
  fromIndex: number,
  toIndex: number
): string {
  const base = datasetBaseUrl(poiDataRestUrl, datasourceName, datasetName);
  return `${base}/features.json?fromIndex=${fromIndex}&toIndex=${toIndex}`;
}

async function fetchDatasetPoiLabels(
  poiDataRestUrl: string,
  dataset: IserverPoiDataset,
  fetcher: FetchLike
): Promise<MapPoiLabel[]> {
  const datasetInfo = await fetchJson(fetcher, `${datasetBaseUrl(poiDataRestUrl, dataset.datasourceName, dataset.datasetName)}.json`);
  const recordCount = normalizeRecordCount(datasetInfo);
  if (recordCount <= 0) return [];

  const toIndex = Math.max(0, Math.min(recordCount, dataset.maxLabels) - 1);
  const featureList = await fetchJson(
    fetcher,
    buildDatasetFeaturesUrl(poiDataRestUrl, dataset.datasourceName, dataset.datasetName, 0, toIndex)
  );
  const featureUris = Array.isArray(featureList.childUriList) ? featureList.childUriList.filter(isString) : [];
  const details = await Promise.all(
    featureUris.slice(0, dataset.maxLabels).map((uri) => fetchJson(fetcher, uri.endsWith(".json") ? uri : `${uri}.json`).catch(() => null))
  );

  return extractPoiLabelsFromSuperMapFeatures(
    details.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")),
    dataset.kind,
    { minZoom: dataset.minZoom, maxLabels: dataset.maxLabels }
  );
}

async function fetchJson(fetcher: FetchLike, url: string): Promise<Record<string, unknown>> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  return json && typeof json === "object" ? json as Record<string, unknown> : {};
}

function datasetBaseUrl(poiDataRestUrl: string, datasourceName: string, datasetName: string): string {
  return `${poiDataRestUrl.replace(/\/$/, "")}/data/datasources/name/${encodeURIComponent(datasourceName)}/datasets/name/${encodeURIComponent(datasetName)}`;
}

function normalizeRecordCount(datasetInfo: Record<string, unknown>): number {
  const info = datasetInfo.datasetInfo as { recordCount?: unknown } | undefined;
  const count = info?.recordCount;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

function dedupePoiLabels(labels: MapPoiLabel[]): MapPoiLabel[] {
  const seen = new Set<string>();
  const output: MapPoiLabel[] = [];
  for (const label of labels) {
    const key = `${label.kind}:${label.name.toLocaleLowerCase()}:${label.coordinate[0].toFixed(4)},${label.coordinate[1].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(label);
  }
  return output;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
