import type {
  MarketScenario,
  NormalizedMetric,
  SubTheme,
  Theme,
} from "./types";
import { sectors } from "./themeRegistry";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import { normalizeCapitalValue } from "./metricNormalizer";
import type { VoronoiCell } from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SubThemeRenderNode {
  readonly subTheme: SubTheme;
  readonly theme: Theme;
  readonly position: { readonly x: number; readonly z: number };
  readonly metric: NormalizedMetric;
  readonly cell: VoronoiCell;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Sum all sector netInflow values per SubTheme from a scenario. */
export function aggregateSubThemeCapital(
  scenario: MarketScenario
): Map<string, number> {
  // Build sector → subThemeId lookup
  const sectorSubThemeMap = new Map<string, string>();
  for (const sector of sectors) {
    sectorSubThemeMap.set(sector.id, sector.subThemeId);
  }

  const capital = new Map<string, number>();
  for (const st of subThemes) {
    capital.set(st.id, 0);
  }

  for (const point of scenario.points) {
    const subThemeId = sectorSubThemeMap.get(point.sectorId);
    if (subThemeId !== undefined) {
      capital.set(subThemeId, (capital.get(subThemeId) ?? 0) + point.netInflow);
    }
  }

  return capital;
}

// ---------------------------------------------------------------------------
// Build render nodes
// ---------------------------------------------------------------------------

export function buildSubThemeRenderNodes(input: {
  readonly voronoiCells: ReadonlyArray<VoronoiCell>;
  readonly scenario: MarketScenario;
  readonly themeFilter?: string;
  readonly capitalStateFilter?: string;
}): SubThemeRenderNode[] {
  const { voronoiCells, scenario, themeFilter, capitalStateFilter } = input;
  const capital = aggregateSubThemeCapital(scenario);

  // Theme lookup
  const themeMap = new Map<string, Theme>();
  for (const t of themes) {
    themeMap.set(t.id, t);
  }

  // SubTheme lookup
  const subThemeMap = new Map<string, SubTheme>();
  for (const st of subThemes) {
    subThemeMap.set(st.id, st);
  }

  // Find max absolute value for normalization
  let maxAbs = 0;
  for (const [, value] of capital) {
    maxAbs = Math.max(maxAbs, Math.abs(value));
  }

  const nodes: SubThemeRenderNode[] = [];

  for (const cell of voronoiCells) {
    const st = subThemeMap.get(cell.subThemeId);
    const theme = st ? themeMap.get(st.themeId) : undefined;
    if (!st || !theme) continue;

    // Theme filter
    if (themeFilter && themeFilter !== "all" && theme.id !== themeFilter) {
      continue;
    }

    const capitalValue = capital.get(st.id) ?? 0;
    const metric = normalizeCapitalValue(capitalValue, maxAbs);

    // Capital state filter
    if (capitalStateFilter && capitalStateFilter !== "all") {
      if (capitalStateFilter === "inflow" && metric.direction !== "inflow") continue;
      if (capitalStateFilter === "outflow" && metric.direction !== "outflow") continue;
    }

    nodes.push({
      subTheme: st,
      theme,
      position: cell.center,
      metric,
      cell,
    });
  }

  return nodes;
}
