export type LoadState = "idle" | "loading" | "ready" | "error";

let state: LoadState = "idle";
let loadPromise: Promise<void> | null = null;
let lastError: Error | null = null;

export function getScriptLoadState(): LoadState {
  return state;
}

export function getScriptLoadError(): Error | null {
  return lastError;
}

export function loadScript(url: string): Promise<void> {
  if (state === "ready") return Promise.resolve();
  if (state === "loading" && loadPromise) return loadPromise;

  state = "loading";
  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-supermap-iclient]`);
    if (existing) {
      state = "ready";
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.supermapIclient = "true";

    script.onload = () => {
      state = "ready";
      resolve();
    };

    script.onerror = (event) => {
      state = "error";
      lastError = new Error(`Failed to load iClient script: ${url}`);
      script.remove();
      reject(lastError);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function loadStylesheet(url: string): Promise<void> {
  const existing = document.querySelector(`link[href="${url}"]`);
  if (existing) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;

    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(new Error(`Failed to load iClient stylesheet: ${url}`));
    };

    document.head.appendChild(link);
  });
}

export function resetScriptState(): void {
  state = "idle";
  loadPromise = null;
  lastError = null;
}
