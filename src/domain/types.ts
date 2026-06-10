export type ThemeId = string;
export type SectorId = string;

export type RelationshipType =
  | "industrial-chain"
  | "market-comovement"
  | "heat-correction"
  | "policy-linkage"
  | "capital-flow";
export type LayoutMode = "manual" | "algorithmic";
export type LayoutStageId = string;

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

export interface SubTheme {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly themeId: ThemeId;
  readonly displayOrder: number;
  readonly primarySectorId: SectorId;
  readonly areaWeight: number;
}

export interface Sector {
  readonly id: SectorId;
  readonly name: string;
  readonly shortName: string;
  readonly primaryThemeId: ThemeId;
  readonly subThemeId: string;
  readonly relatedThemeIds: readonly ThemeId[];
  readonly aliases: readonly string[];
  readonly industrialChainRole: string;
  readonly isThemeCenter: boolean;
  readonly relationshipNote: string;
}

export interface RelationshipEdge {
  readonly sourceSectorId: SectorId;
  readonly targetSectorId: SectorId;
  readonly type: RelationshipType;
  readonly weight: number;
  readonly note: string;
}

export interface LayoutStage {
  readonly id: LayoutStageId;
  readonly label: string;
  readonly story: string;
  readonly previousStageId?: LayoutStageId;
  readonly themeHeat: Readonly<Record<ThemeId, number>>;
  readonly sectorHeat: Readonly<Record<SectorId, number>>;
}

export interface LayoutExplanationReason {
  readonly relatedSectorId: SectorId;
  readonly relationshipType: RelationshipType;
  readonly weight: number;
  readonly note: string;
  readonly stageInfluenced: boolean;
}

export interface LayoutExplanation {
  readonly sectorId: SectorId;
  readonly summary: string;
  readonly reasons: readonly LayoutExplanationReason[];
}

export interface VoronoiCell {
  readonly subThemeId: string;
  readonly center: { readonly x: number; readonly z: number };
  readonly polygon: ReadonlyArray<{ readonly x: number; readonly z: number }>;
  readonly themeId: string;
}

export interface VoronoiLayout {
  readonly cells: ReadonlyArray<VoronoiCell>;
  readonly boundary: { readonly width: number; readonly height: number };
  readonly version: string;
  readonly stageId?: LayoutStageId;
}

export interface PreviousLayoutPosition {
  readonly x: number;
  readonly z: number;
}

export interface LayoutCell {
  sectorId: SectorId;
  x: number;
  z: number;
  role: "theme-center" | "sub-theme-center" | "related-sector";
  relationshipStrength: 1 | 2 | 3;
  subThemeId?: string;
  previousPosition?: PreviousLayoutPosition;
}

export interface SectorLayout {
  cells: LayoutCell[];
  version?: string;
  stageId?: LayoutStageId;
  explanations?: Readonly<Record<SectorId, LayoutExplanation>>;
}

export interface LayoutProvider {
  getLayout(stageId?: LayoutStageId): SectorLayout;
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
  subTheme?: SubTheme;
  cell: LayoutCell;
  metric: NormalizedMetric;
  visible: boolean;
  dimmed: boolean;
  isSubThemeCenter: boolean;
  layoutExplanation?: LayoutExplanation;
}

export interface Stock {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly subThemeId: string;
  readonly code: string;
}

export interface StockRenderNode {
  readonly stock: Stock;
  readonly subTheme: SubTheme;
  readonly theme: Theme;
  readonly position: { readonly x: number; readonly z: number };
  readonly metric: NormalizedMetric;
  readonly visible: boolean;
  readonly cell?: VoronoiCell;
}

export interface DatasetSummary {
  readonly themeCount: number;
  readonly sectorCount: number;
  readonly relationshipEdgeCount: number;
  readonly layoutVersion: string;
  readonly activeStageLabel: string;
}
