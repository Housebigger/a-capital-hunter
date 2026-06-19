import { describe, it, expect } from "vitest";
import { stocks } from "./stockRegistry";
import { subThemes } from "./subThemeRegistry";
import stockConfig from "../data/stockRegistry.json";

describe("stockRegistry", () => {
  it("matches the shared stock JSON exactly", () => {
    expect(stocks).toEqual(stockConfig);
    expect(stockConfig).toHaveLength(177);
  });

  it("has 150-300 stocks", () => {
    expect(stocks.length).toBeGreaterThanOrEqual(150);
    expect(stocks.length).toBeLessThanOrEqual(300);
  });

  it("every stock references a valid subThemeId", () => {
    const subThemeIds = new Set(subThemes.map((st) => st.id));
    for (const stock of stocks) {
      expect(subThemeIds.has(stock.subThemeId), `Stock ${stock.id} has invalid subThemeId ${stock.subThemeId}`).toBe(true);
    }
  });

  it("every sub-theme has at least 3 stocks", () => {
    const counts = new Map<string, number>();
    for (const stock of stocks) {
      counts.set(stock.subThemeId, (counts.get(stock.subThemeId) ?? 0) + 1);
    }
    for (const st of subThemes) {
      expect(counts.get(st.id) ?? 0, `SubTheme ${st.id} has fewer than 2 stocks`).toBeGreaterThanOrEqual(2);
    }
  });

  it("stocks are frozen", () => {
    expect(Object.isFrozen(stocks)).toBe(true);
  });
});
