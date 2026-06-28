export type SuperMapStatus = "checking" | "online" | "offline";

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
