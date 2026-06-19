/**
 * Registry integrity validator — runs against the real shared JSON registries.
 *
 * Three invariants:
 * 1. Every stock's subThemeId references a real sub-theme entry.
 * 2. Every stock code is exactly 6 digits.
 * 3. Synthetic uniform points (one primary per unique code) satisfy the
 *    P1 == P2 == unique-P3 aggregation invariant within 0.01 CNY.
 */

import { describe, it, expect } from "vitest";
import { stocks } from "./stockRegistry";
import { subThemes } from "./subThemeRegistry";
import { buildCapitalFlowAggregates } from "./capitalFlowAggregation";
import type { StockCapitalFlowPoint } from "../data/capitalFlowSnapshot";

describe("registry integrity", () => {
  it("every stock subThemeId references a real sub-theme", () => {
    const subThemeIds = new Set(subThemes.map((s) => s.id));
    for (const stock of stocks) {
      expect(
        subThemeIds.has(stock.subThemeId),
        `stock ${stock.code} (${stock.id}) references unknown subThemeId: ${stock.subThemeId}`
      ).toBe(true);
    }
  });

  it("every stock code is exactly 6 digits", () => {
    for (const stock of stocks) {
      expect(
        /^\d{6}$/.test(stock.code),
        `stock ${stock.id} has non-6-digit code: "${stock.code}"`
      ).toBe(true);
    }
  });

  it("aggregation invariant holds: P1 == P2 == unique-P3 within 0.01 CNY", () => {
    const subThemeById = new Map(subThemes.map((s) => [s.id, s]));

    // A stock may appear in multiple sub-themes (primary + related mappings).
    // Assign "primary" to the first occurrence of each code; "related" to all others.
    const seenCodes = new Set<string>();
    const points: StockCapitalFlowPoint[] = stocks.map((stock) => {
      const sub = subThemeById.get(stock.subThemeId)!;
      const isPrimary = !seenCodes.has(stock.code);
      seenCodes.add(stock.code);
      return {
        stockId: stock.id,
        securityCode: stock.code,
        stockName: stock.name,
        subThemeId: stock.subThemeId,
        themeId: sub.themeId,
        aggregationRole: isPrimary ? "primary" : "related",
        netAmountMain: 1_000_000,
        tradeDate: "2026-06-18",
      };
    });

    const agg = buildCapitalFlowAggregates(points);

    // Unique securities = number of distinct codes (not total registry entries)
    const uniqueCodeCount = seenCodes.size;
    const expectedTotal = uniqueCodeCount * 1_000_000;
    const subSum = [...agg.bySubTheme.values()].reduce((a, b) => a + b, 0);
    const themeSum = [...agg.byTheme.values()].reduce((a, b) => a + b, 0);

    expect(Math.abs(agg.uniqueStockTotal - expectedTotal)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(subSum - agg.uniqueStockTotal)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(themeSum - agg.uniqueStockTotal)).toBeLessThanOrEqual(0.01);
  });
});
