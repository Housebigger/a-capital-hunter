/**
 * Stock Render Nodes — builds P3 (individual stock) render nodes.
 *
 * Two data paths:
 *   1. Real data: pass ``points`` from a JQData snapshot. Each registry stock
 *      with a matching point gets its true net_amount_main; stocks without a
 *      point are skipped (no synthetic placeholder).
 *   2. Legacy scenario: pass ``scenario`` (deprecated). Stocks receive a
 *      deterministic share of the sub-theme total so the prototype stayed
 *      populated before real data existed. The product path uses (1).
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
import type { StockCapitalFlowPoint } from "../data/capitalFlowSnapshot";

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
  readonly scenario?: MarketScenario;
  /** Real-data path: per-stock points from a JQData snapshot. */
  readonly points?: readonly StockCapitalFlowPoint[];
  readonly themeFilter?: string;
  readonly capitalStateFilter?: string;
}): StockRenderNode3[] {
  const { voronoiCells, scenario, points, themeFilter, capitalStateFilter } = input;

  const useRealData = points !== undefined;
  const pointByStockId = new Map<string, StockCapitalFlowPoint>();
  if (useRealData) {
    for (const p of points!) {
      pointByStockId.set(p.stockId, p);
    }
  }

  // 1. Aggregate capital per SubTheme (legacy path only)
  const capitalMap = useRealData ? new Map<string, number>() : aggregateSubThemeCapital(scenario!);

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

    if (useRealData) {
      // Real-data path: only render stocks that have a real point.
      // No synthetic distribution, no placeholder value.
      for (const pos of positions) {
        const stock = cellStocks.find((s) => s.id === pos.stockId);
        if (!stock) continue;
        const point = pointByStockId.get(stock.id);
        if (!point) continue; // skip stocks without real data
        rawEntries.push({
          stock,
          subTheme: st,
          theme,
          position: { x: pos.x, z: pos.z },
          cell,
          distributedValue: point.netAmountMain,
        });
      }
    } else {
      // Legacy scenario path: distribute sub-theme total across stocks.
      const subThemeTotal = capitalMap.get(st.id) ?? 0;
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const stock = cellStocks.find((s) => s.id === pos.stockId);
        if (!stock) continue;

        let distributedValue: number;
        if (subThemeTotal === 0) {
          distributedValue = 5;
        } else {
          const n = cellStocks.length;
          if (i === 0) {
            distributedValue = subThemeTotal * 0.4;
          } else {
            distributedValue = (subThemeTotal * 0.6) / (n - 1);
          }
        }
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
