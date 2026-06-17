import type {
  CapitalDirection,
  MarketScenario,
  NormalizedMetric,
  Theme,
} from "./types";
import { sectors } from "./themeRegistry";
import { themes } from "./themeRegistry";
import { normalizeCapitalValue } from "./metricNormalizer";
import type { ThemeCell } from "./themeVoronoiLayoutEngine";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ThemeRenderNode {
  readonly theme: Theme;
  readonly position: { readonly x: number; readonly z: number };
  readonly metric: NormalizedMetric;
  readonly cell: ThemeCell;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Sum all sector netInflow values per theme from a scenario. */
export function aggregateThemeCapital(
  scenario: MarketScenario
): Map<string, number> {
  // Build sector → themeId lookup
  const sectorThemeMap = new Map<string, string>();
  for (const sector of sectors) {
    sectorThemeMap.set(sector.id, sector.primaryThemeId);
  }

  const themeCapital = new Map<string, number>();
  for (const theme of themes) {
    themeCapital.set(theme.id, 0);
  }

  for (const point of scenario.points) {
    const themeId = sectorThemeMap.get(point.sectorId);
    if (themeId !== undefined) {
      themeCapital.set(themeId, (themeCapital.get(themeId) ?? 0) + point.netInflow);
    }
  }

  return themeCapital;
}

// ---------------------------------------------------------------------------
// Build render nodes
// ---------------------------------------------------------------------------

export function buildThemeRenderNodes(input: {
  readonly cells: ReadonlyArray<ThemeCell>;
  readonly scenario?: MarketScenario;
  /** Real-data path: per-theme capital from JQData aggregation. */
  readonly capitalByTheme?: ReadonlyMap<string, number>;
  readonly themeFilter?: string;
}): ThemeRenderNode[] {
  const { cells, scenario, capitalByTheme, themeFilter } = input;
  // Prefer the real JQData aggregation; fall back to scenario aggregation so
  // legacy callers and tests that inject a MarketScenario still work.
  const themeCapital =
    capitalByTheme ?? (scenario ? aggregateThemeCapital(scenario) : new Map<string, number>());

  // Find max absolute value for normalization
  let maxAbs = 0;
  for (const [, value] of themeCapital) {
    maxAbs = Math.max(maxAbs, Math.abs(value));
  }

  const nodes: ThemeRenderNode[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const theme = themes[i];

    if (themeFilter && themeFilter !== "all" && theme.id !== themeFilter) {
      continue;
    }

    const capitalValue = themeCapital.get(theme.id) ?? 0;
    const metric = normalizeCapitalValue(capitalValue, maxAbs);

    nodes.push({
      theme,
      position: cell.center,
      metric,
      cell,
    });
  }

  return nodes;
}
