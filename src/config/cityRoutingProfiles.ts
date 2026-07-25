import type { MapPoiLabel } from "../map/layers/PoiLabelLayer";
import { wuhanLandmarkPoiLabels } from "../data/wuhanLandmarks";

export interface RequiredRiverBridgeRule {
  id: string;
  name: string;
  namePattern: RegExp;
}

export interface CityRoutingProfile {
  id: string;
  cityId: string;
  landmarks: MapPoiLabel[];
  landmarkInfluenceRadiusKm: number;
  riverBridgeNamePattern: RegExp;
  requiredRiverBridges: RequiredRiverBridgeRule[];
}

export const wuhanRoutingProfile: CityRoutingProfile = {
  id: "wuhan-marathon-routing",
  cityId: "wuhan",
  landmarks: wuhanLandmarkPoiLabels,
  landmarkInfluenceRadiusKm: 0.45,
  riverBridgeNamePattern: /长江.*桥|长江大桥|闀挎睙.*妗|闀挎睙澶фˉ/,
  requiredRiverBridges: [
    {
      id: "wuhan-yangtze-river-bridge",
      name: "武汉长江大桥",
      namePattern: /武汉长江大桥|姝︽眽闀挎睙澶фˉ/
    }
  ]
};

export const activeCityRoutingProfile = wuhanRoutingProfile;

export function isRequiredRiverBridgeForProfile(
  name: string,
  isBridge: boolean,
  profile: CityRoutingProfile = activeCityRoutingProfile
): boolean {
  return isBridge && profile.requiredRiverBridges.some((bridge) => bridge.namePattern.test(name));
}

export function isCityRiverBridgeForProfile(
  name: string,
  isBridge: boolean,
  profile: CityRoutingProfile = activeCityRoutingProfile
): boolean {
  return isBridge && profile.riverBridgeNamePattern.test(name);
}
