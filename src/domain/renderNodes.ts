import { normalizeCapitalValue } from "./metricNormalizer";
import { sectors, themes } from "./themeRegistry";
import type {
  CapitalStateFilter,
  MarketScenario,
  RenderNode,
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

export function buildRenderNodes(input: BuildRenderNodesInput): RenderNode[] {
  const maxAbsValue = Math.max(...input.scenario.points.map((point) => Math.abs(point.netInflow)), 1);

  return input.layout.cells.map((cell) => {
    const sector = sectors.find((candidate) => candidate.id === cell.sectorId);
    const point = input.scenario.points.find((candidate) => candidate.sectorId === cell.sectorId);

    if (!sector || !point) {
      throw new Error(`Missing sector or scenario point for ${cell.sectorId}`);
    }

    const theme = themes.find((candidate) => candidate.id === sector.primaryThemeId);
    if (!theme) {
      throw new Error(`Missing theme for ${sector.primaryThemeId}`);
    }

    const metric = normalizeCapitalValue(point.netInflow, maxAbsValue);
    const matchesTheme = input.themeFilter === "all" || sector.primaryThemeId === input.themeFilter;
    const matchesState =
      input.capitalStateFilter === "all" || metric.direction === input.capitalStateFilter;
    const matchesCenterMode = !input.showCentersOnly || sector.isThemeCenter;
    const visible = matchesTheme && matchesState && matchesCenterMode;

    return {
      sector,
      theme,
      cell,
      metric,
      visible,
      dimmed: !visible
    };
  });
}
