/**
 * Stock Render Nodes — builds P3 (individual stock) render nodes.
 *
 * For each VoronoiCell, places stocks within the cell polygon using
 * the stockLayoutEngine, distributes SubTheme-level capital across stocks,
 * normalizes metrics, and applies filters.
 *
 * Pure function module with no React dependencies.
 */

import type {
  VoronoiCell,
  MarketScenario,
  NormalizedMetric,
  Stock,
  SubTheme,
  Theme,
} from "./types";
import { stocks } from "./stockRegistry";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import { normalizeCapitalValue } from "./metricNormalizer";
import { placeStocksInCell } from "./stockLayoutEngine";
import { aggregateSubThemeCapital } from "./subThemeRenderNodes";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StockRenderNode3 {
  readonly stock: Stock;
  readonly subTheme: SubTheme;
  readonly theme: Theme;
  readonly position: { readonly x: number; readonly z: number };
  readonly metric: NormalizedMetric;
  readonly visible: boolean;
  readonly cell: VoronoiCell;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawStockEntry {
  stock: Stock;
  subTheme: SubTheme;
  theme: Theme;
  position: { readonly x: number; readonly z: number };
  cell: VoronoiCell;
  distributedValue: number;
}

// ---------------------------------------------------------------------------
// Build render nodes
// ---------------------------------------------------------------------------

export function buildP3StockRenderNodes(input: {
  readonly voronoiCells: ReadonlyArray<VoronoiCell>;
  readonly scenario: MarketScenario;
  readonly themeFilter?: string;
  readonly capitalStateFilter?: string;
}): StockRenderNode3[] {
  const { voronoiCells, scenario, themeFilter, capitalStateFilter } = input;

  // 1. Aggregate capital per SubTheme
  const capitalMap = aggregateSubThemeCapital(scenario);

  // 2. Build lookups
  const subThemeMap = new Map<string, SubTheme>();
  for (const st of subThemes) {
    subThemeMap.set(st.id, st);
  }

  const themeMap = new Map<string, Theme>();
  for (const t of themes) {
    themeMap.set(t.id, t);
  }

  // Group stocks by subThemeId
  const stocksBySubTheme = new Map<string, Stock[]>();
  for (const stock of stocks) {
    const list = stocksBySubTheme.get(stock.subThemeId);
    if (list) {
      list.push(stock);
    } else {
      stocksBySubTheme.set(stock.subThemeId, [stock]);
    }
  }

  // 3. First pass: collect raw entries to find max absolute value
  const rawEntries: RawStockEntry[] = [];

  for (const cell of voronoiCells) {
    const st = subThemeMap.get(cell.subThemeId);
    if (!st) continue;

    const theme = themeMap.get(st.themeId);
    if (!theme) continue;

    // Theme filter
    if (themeFilter && themeFilter !== "all" && theme.id !== themeFilter) {
      continue;
    }

    const cellStocks = stocksBySubTheme.get(cell.subThemeId);
    if (!cellStocks || cellStocks.length === 0) continue;

    // Position stocks within cell
    const positions = placeStocksInCell(cell, cellStocks);

    // Get SubTheme total capital
    const subThemeTotal = capitalMap.get(st.id) ?? 0;

    // Distribute capital across stocks
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const stock = cellStocks.find((s) => s.id === pos.stockId);
      if (!stock) continue;

      let distributedValue: number;
      if (subThemeTotal === 0) {
        // Use small mock value when SubTheme has no capital
        distributedValue = 5;
      } else {
        const n = cellStocks.length;
        if (i === 0) {
          // First stock gets 40% of SubTheme total
          distributedValue = subThemeTotal * 0.4;
        } else {
          // Rest share 60% evenly
          distributedValue = (subThemeTotal * 0.6) / (n - 1);
        }
      }

      // Add slight variation per stock for diversity
      distributedValue *= 0.85 + i * 0.05;

      rawEntries.push({
        stock,
        subTheme: st,
        theme,
        position: { x: pos.x, z: pos.z },
        cell,
        distributedValue,
      });
    }
  }

  // 4. Find max absolute value for normalization
  let maxAbs = 0;
  for (const entry of rawEntries) {
    maxAbs = Math.max(maxAbs, Math.abs(entry.distributedValue));
  }

  // 5. Second pass: normalize, filter, and build final nodes
  const nodes: StockRenderNode3[] = [];

  for (const entry of rawEntries) {
    const metric = normalizeCapitalValue(entry.distributedValue, maxAbs);

    // Capital state filter
    if (capitalStateFilter && capitalStateFilter !== "all") {
      if (capitalStateFilter === "inflow" && metric.direction !== "inflow")
        continue;
      if (capitalStateFilter === "outflow" && metric.direction !== "outflow")
        continue;
    }

    nodes.push({
      stock: entry.stock,
      subTheme: entry.subTheme,
      theme: entry.theme,
      position: entry.position,
      metric,
      visible: true,
      cell: entry.cell,
    });
  }

  return nodes;
}
