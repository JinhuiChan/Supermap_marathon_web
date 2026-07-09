export type SuperMapStatus = "checking" | "online" | "offline";
export type SuperMapResourceStatus = "checking" | "ready" | "pending";

export function buildIserverHealthUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("services.json", normalizedBaseUrl).toString();
}

export async function checkSuperMapIserver(baseUrl: string, timeoutMs = 3500): Promise<SuperMapStatus> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildIserverHealthUrl(baseUrl), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (response.ok) return "online";
  } catch {
    try {
      const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      await fetch(normalizedBaseUrl, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal
      });
      return "online";
    } catch {
      return "offline";
    }
  } finally {
    globalThis.clearTimeout(timeout);
  }

  return "offline";
}

export async function checkSuperMapResource(url: string, timeoutMs = 3500): Promise<SuperMapResourceStatus> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    return response.ok ? "ready" : "pending";
  } catch {
    return "pending";
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function buildWmsCapabilitiesUrl(wmsUrl: string): string {
  const url = new URL(wmsUrl);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("REQUEST", "GetCapabilities");
  return url.toString();
}

export async function checkSuperMapWms(wmsUrl: string, timeoutMs = 5000): Promise<SuperMapResourceStatus> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const capabilitiesUrl = buildWmsCapabilitiesUrl(wmsUrl);
    const response = await fetch(capabilitiesUrl, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return "pending";

    const text = await response.text();
    return /<(WMT_MS_Capabilities|WMS_Capabilities)\b/i.test(text) ? "ready" : "pending";
  } catch {
    return "pending";
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
