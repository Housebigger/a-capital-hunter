import { normalizeCapitalValue } from "./metricNormalizer";
import { sectors, themes } from "./themeRegistry";
import { subThemes } from "./subThemeRegistry";
import { stocks } from "./stockRegistry";
import type {
  CapitalStateFilter,
  MarketScenario,
  RenderNode,
  ScenarioPoint,
  SectorId,
  SectorLayout,
  ThemeFilter,
  VoronoiLayout,
  StockRenderNode
} from "./types";

interface BuildRenderNodesInput {
  layout: SectorLayout;
  scenario: MarketScenario;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  showCentersOnly: boolean;
}

function buildScenarioPointMap(points: readonly ScenarioPoint[]): Map<SectorId, ScenarioPoint> {
  const pointBySectorId = new Map<SectorId, ScenarioPoint>();

  for (const point of points) {
    if (pointBySectorId.has(point.sectorId)) {
      throw new Error(`Duplicate scenario point for ${point.sectorId}`);
    }

    pointBySectorId.set(point.sectorId, point);
  }

  return pointBySectorId;
}

export function buildRenderNodes(input: BuildRenderNodesInput): RenderNode[] {
  if (
    input.themeFilter !== "all" &&
    !themes.some((candidate) => candidate.id === input.themeFilter)
  ) {
    throw new Error(`Unknown theme filter: ${input.themeFilter}`);
  }

  const pointBySectorId = buildScenarioPointMap(input.scenario.points);
  const maxAbsValue = Math.max(
    ...Array.from(pointBySectorId.values(), (point) => Math.abs(point.netInflow)),
    1
  );

  return input.layout.cells.map((cell) => {
    const sector = sectors.find((candidate) => candidate.id === cell.sectorId);
    if (!sector) {
      throw new Error(`Missing sector for ${cell.sectorId}`);
    }

    const point = pointBySectorId.get(cell.sectorId);
    if (!point) {
      throw new Error(`Missing scenario point for ${cell.sectorId}`);
    }

    const theme = themes.find((candidate) => candidate.id === sector.primaryThemeId);
    if (!theme) {
      throw new Error(`Missing theme for ${sector.primaryThemeId}`);
    }

    const metric = normalizeCapitalValue(point.netInflow, maxAbsValue);
    // First-version theme filtering follows the primary visual grouping, not every cross-theme relationship.
    const matchesTheme = input.themeFilter === "all" || sector.primaryThemeId === input.themeFilter;
    const matchesState =
      input.capitalStateFilter === "all" || metric.direction === input.capitalStateFilter;
    const matchesCenterMode = !input.showCentersOnly || sector.isThemeCenter;
    const visible = matchesTheme && matchesState && matchesCenterMode;

    const subTheme = subThemes.find((st) => st.id === sector.subThemeId);
    const isSubThemeCenter = subTheme?.primarySectorId === sector.id;

    return {
      sector,
      theme,
      subTheme,
      cell,
      metric,
      visible,
      dimmed: !visible,
      isSubThemeCenter,
      layoutExplanation: input.layout.explanations?.[cell.sectorId]
    };
  });
}

interface BuildStockRenderNodesInput {
  layout: VoronoiLayout;
  scenario: MarketScenario;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  capitalThreshold?: number;
}

export function buildStockRenderNodes(input: BuildStockRenderNodesInput): StockRenderNode[] {
  const threshold = input.capitalThreshold ?? 10;

  return input.layout.cells.flatMap((cell) => {
    const cellStocks = stocks.filter((s) => s.subThemeId === cell.subThemeId);
    const subTheme = subThemes.find((st) => st.id === cell.subThemeId);
    if (!subTheme) return [];
    const theme = themes.find((t) => t.id === subTheme.themeId);
    if (!theme) return [];

    // Filter by theme
    if (input.themeFilter !== "all" && theme.id !== input.themeFilter) return [];

    // Position stocks within cell: first at center, rest in ring
    return cellStocks.map((stock, index) => {
      const point = input.scenario.points.find((p) => p.sectorId === stock.id);
      // Use simulated metric based on position in list
      const mockNetInflow = index === 0 ? 45 : 20 - index * 3;
      const maxAbsValue = 50;
      const metric = normalizeCapitalValue(mockNetInflow, maxAbsValue);

      const matchesState = input.capitalStateFilter === "all" || metric.direction === input.capitalStateFilter;

      // Position: center for first, ring for rest
      const angle = index === 0 ? 0 : (Math.PI * 2 * (index - 1)) / Math.max(1, cellStocks.length - 1);
      const radius = index === 0 ? 0 : 0.4;

      return {
        stock,
        subTheme,
        theme,
        position: {
          x: cell.center.x + Math.cos(angle) * radius,
          z: cell.center.z + Math.sin(angle) * radius,
        },
        metric,
        visible: matchesState,
        cell,
      };
    });
  });
}
