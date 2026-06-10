import { normalizeCapitalValue } from "./metricNormalizer";
import { sectors, themes } from "./themeRegistry";
import { subThemes } from "./subThemeRegistry";
import type {
  CapitalStateFilter,
  MarketScenario,
  RenderNode,
  ScenarioPoint,
  SectorId,
  SectorLayout,
  ThemeFilter
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
