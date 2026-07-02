export type PoiCategory = "scenic" | "medical" | "transit" | "park" | "supply";

export interface PoiScore {
  scenic: number;
  medical: number;
  transit: number;
  park: number;
  supply: number;
}

export const ZERO_POI_SCORE: PoiScore = {
  scenic: 0,
  medical: 0,
  transit: 0,
  park: 0,
  supply: 0
};

export type PoiTheme = "balanced" | "scenic" | "safe" | "transit-accessible";

export interface PoiPreferences {
  theme: PoiTheme;
  scenicWeight?: number;
  medicalWeight?: number;
  transitWeight?: number;
  parkWeight?: number;
  supplyWeight?: number;
}

export const POI_THEME_WEIGHTS: Record<PoiTheme, PoiScore> = {
  balanced: { scenic: 1, medical: 1, transit: 1, park: 1, supply: 1 },
  scenic: { scenic: 3, medical: 0.7, transit: 0.5, park: 2, supply: 0.5 },
  safe: { scenic: 0.5, medical: 3, transit: 1, park: 0.5, supply: 2 },
  "transit-accessible": { scenic: 0.7, medical: 1, transit: 3, park: 0.5, supply: 1 }
};

export function resolvePoiWeights(preferences: PoiPreferences): PoiScore {
  const base = POI_THEME_WEIGHTS[preferences.theme];
  return {
    scenic: preferences.scenicWeight ?? base.scenic,
    medical: preferences.medicalWeight ?? base.medical,
    transit: preferences.transitWeight ?? base.transit,
    park: preferences.parkWeight ?? base.park,
    supply: preferences.supplyWeight ?? base.supply
  };
}
