import { describe, expect, test, vi } from "vitest";
import { buildDatasetFeaturesUrl, fetchIserverPoiLabels, type IserverPoiDataset } from "./iserverPoi";

describe("iserverPoi", () => {
  test("builds SuperMap dataset feature page URLs", () => {
    expect(buildDatasetFeaturesUrl("http://127.0.0.1:8090/iserver/services/data-wuhan-poi/rest", "ds", "poi", 0, 49)).toBe(
      "http://127.0.0.1:8090/iserver/services/data-wuhan-poi/rest/data/datasources/name/ds/datasets/name/poi/features.json?fromIndex=0&toIndex=49"
    );
  });

  test("fetches iServer feature records and converts them to POI labels", async () => {
    const dataset: IserverPoiDataset = {
      datasourceName: "wuhan-marathon",
      datasetName: "marathon_support_points_P",
      kind: "traffic",
      maxLabels: 2,
      minZoom: 12
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/datasets/name/marathon_support_points_P.json")) {
        return response({ datasetInfo: { recordCount: 2 } });
      }
      if (url.includes("/features.json")) {
        return response({
          childUriList: [
            "http://127.0.0.1:8090/iserver/services/data-wuhan-poi/rest/data/feature/1-1-0",
            "http://127.0.0.1:8090/iserver/services/data-wuhan-poi/rest/data/feature/1-1-1"
          ]
        });
      }
      return response({
        fieldNames: ["SMID", "POINT_NAME"],
        fieldValues: [url.endsWith("0.json") ? "1" : "2", url.endsWith("0.json") ? "三阳路地铁站" : "集散停车点"],
        geometry: { center: { x: url.endsWith("0.json") ? 114.303 : 114.31, y: 30.602 } }
      });
    });

    const labels = await fetchIserverPoiLabels("http://127.0.0.1:8090/iserver/services/data-wuhan-poi/rest", [dataset], fetcher);

    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatchObject({
      id: "traffic-1",
      name: "三阳路地铁站",
      source: "iserver",
      minZoom: 12
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("features.json?fromIndex=0&toIndex=1"));
  });
});

function response(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
