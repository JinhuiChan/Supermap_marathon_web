export type SuperMapStatus = "checking" | "online" | "offline";
export type SuperMapResourceStatus = "checking" | "ready" | "pending";

export async function checkSuperMapIserver(baseUrl: string, timeoutMs = 3500): Promise<SuperMapStatus> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(baseUrl, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal
    });
    return "online";
  } catch {
    return "offline";
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkSuperMapResource(url: string, timeoutMs = 3500): Promise<SuperMapResourceStatus> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    return response.ok ? "ready" : "pending";
  } catch {
    return "pending";
  } finally {
    window.clearTimeout(timeout);
  }
}
