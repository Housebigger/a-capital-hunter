export type ThemeId = "ai-computing" | "robotics-physical-ai" | "low-altitude-economy";

export type SectorId =
  | "ai-computing"
  | "optical-modules"
  | "cpo"
  | "liquid-cooled-servers"
  | "domestic-computing"
  | "data-centers"
  | "robotics-physical-ai"
  | "reducers"
  | "servo-systems"
  | "sensors"
  | "machine-vision"
  | "actuators"
  | "low-altitude-economy"
  | "evtol"
  | "flight-control-systems"
  | "drones"
  | "general-aviation-operations"
  | "air-traffic-systems";

export type CapitalDirection = "inflow" | "outflow" | "flat";
export type CapitalStateFilter = "all" | CapitalDirection;
export type ThemeFilter = "all" | ThemeId;
export type CameraPreset = "angled" | "top" | "side";
export type ReadonlyNonEmptyArray<T> = readonly [T, ...T[]];

export interface Theme {
  readonly id: ThemeId;
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
}

export interface Sector {
  readonly id: SectorId;
  readonly name: string;
  readonly shortName: string;
  readonly primaryThemeId: ThemeId;
  readonly relatedThemeIds: readonly ThemeId[];
  readonly aliases: readonly string[];
  readonly isThemeCenter: boolean;
  readonly relationshipNote: string;
}

export interface LayoutCell {
  sectorId: SectorId;
  x: number;
  z: number;
  role: "theme-center" | "related-sector";
  relationshipStrength: 1 | 2 | 3;
}

export interface SectorLayout {
  cells: LayoutCell[];
}

export interface LayoutProvider {
  getLayout(): SectorLayout;
}

export interface ScenarioPoint {
  sectorId: SectorId;
  netInflow: number;
}

export interface MarketScenario {
  id: string;
  label: string;
  story: string;
  points: ScenarioPoint[];
}

export interface DataProvider {
  getScenarios(): ReadonlyNonEmptyArray<MarketScenario>;
}

export interface NormalizedMetric {
  rawValue: number;
  height: number;
  direction: CapitalDirection;
  color: string;
  intensity: number;
  labelValue: string;
}

export interface RenderNode {
  sector: Sector;
  theme: Theme;
  cell: LayoutCell;
  metric: NormalizedMetric;
  visible: boolean;
  dimmed: boolean;
}
