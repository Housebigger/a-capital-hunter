/**
 * De-duplicated P1/P2/P3 capital flow aggregation.
 *
 * The backend snapshot carries one point per (stockId, securityCode) display
 * mapping. A security that belongs to multiple sub-themes appears once as
 * ``primary`` and once per extra sub-theme as ``related``. This module sums
 * only ``primary`` mappings into P1/P2 totals so totals are stable, while
 * keeping every mapping reachable by stockId for P3 display.
 *
 * Invariant: sum(bySubTheme) == sum(byTheme) == uniqueStockTotal within 0.01.
 */

import type { StockCapitalFlowPoint } from "../data/capitalFlowSnapshot";

const TOLERANCE = 0.01;

export interface CapitalFlowAggregates {
  /** Sum of every primary point (== each unique security, counted once). */
  readonly uniqueStockTotal: number;
  /** subThemeId → sum of primary points. Related mappings excluded. */
  readonly bySubTheme: ReadonlyMap<string, number>;
  /** themeId → sum of primary points. */
  readonly byTheme: ReadonlyMap<string, number>;
  /** stockId → point, for P3 display (includes related mappings). */
  readonly pointByStockId: ReadonlyMap<string, StockCapitalFlowPoint>;
}

export function buildCapitalFlowAggregates(
  points: readonly StockCapitalFlowPoint[]
): CapitalFlowAggregates {
  const pointByStockId = new Map<string, StockCapitalFlowPoint>();
  const bySubTheme = new Map<string, number>();
  const byTheme = new Map<string, number>();
  const primarySecurityCodes = new Set<string>();
  let uniqueStockTotal = 0;

  for (const point of points) {
    // P3 display keeps every mapping (primary + related) reachable.
    pointByStockId.set(point.stockId, point);

    if (point.aggregationRole !== "primary") continue;

    if (primarySecurityCodes.has(point.securityCode)) {
      throw new Error(
        `Duplicate primary mapping for security ${point.securityCode}`
      );
    }
    primarySecurityCodes.add(point.securityCode);

    uniqueStockTotal += point.netAmountMain;
    bySubTheme.set(
      point.subThemeId,
      (bySubTheme.get(point.subThemeId) ?? 0) + point.netAmountMain
    );
    byTheme.set(
      point.themeId,
      (byTheme.get(point.themeId) ?? 0) + point.netAmountMain
    );
  }

  // Invariant guard — mirrors the backend assertion so a malformed payload
  // can never silently desync the three map layers.
  const subSum = [...bySubTheme.values()].reduce((a, b) => a + b, 0);
  const themeSum = [...byTheme.values()].reduce((a, b) => a + b, 0);
  if (Math.abs(subSum - uniqueStockTotal) > TOLERANCE) {
    throw new Error(
      `Aggregation invariant violated: bySubTheme ${subSum} != unique ${uniqueStockTotal}`
    );
  }
  if (Math.abs(themeSum - uniqueStockTotal) > TOLERANCE) {
    throw new Error(
      `Aggregation invariant violated: byTheme ${themeSum} != unique ${uniqueStockTotal}`
    );
  }

  return { uniqueStockTotal, bySubTheme, byTheme, pointByStockId };
}
