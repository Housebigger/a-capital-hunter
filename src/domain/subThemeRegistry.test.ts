import { describe, it, expect } from "vitest";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import subThemeConfig from "../data/subThemeRegistry.json";

describe("subThemeRegistry", () => {
  it("matches the shared sub-theme JSON exactly", () => {
    expect(subThemes).toEqual(subThemeConfig);
  });

  it("has approximately 74 sub-themes", () => {
    expect(subThemes.length).toBeGreaterThanOrEqual(60);
    expect(subThemes.length).toBeLessThanOrEqual(90);
  });

  it("every sub-theme references a valid theme", () => {
    const themeIds = new Set(themes.map((t) => t.id));
    for (const st of subThemes) {
      expect(themeIds.has(st.themeId), `SubTheme ${st.id} references unknown theme ${st.themeId}`).toBe(true);
    }
  });

  it("every sub-theme has a primarySectorId", () => {
    for (const st of subThemes) {
      expect(st.primarySectorId, `SubTheme ${st.id} missing primarySectorId`).toBeTruthy();
    }
  });

  it("every theme has at least one sub-theme", () => {
    const themesWithSub = new Set(subThemes.map((st) => st.themeId));
    for (const theme of themes) {
      expect(themesWithSub.has(theme.id), `Theme ${theme.id} has no sub-themes`).toBe(true);
    }
  });

  it("displayOrder is unique within each theme", () => {
    const ordersByTheme = new Map<string, Set<number>>();
    for (const st of subThemes) {
      const orders = ordersByTheme.get(st.themeId) ?? new Set();
      expect(orders.has(st.displayOrder), `Duplicate displayOrder ${st.displayOrder} in theme ${st.themeId}`).toBe(false);
      orders.add(st.displayOrder);
      ordersByTheme.set(st.themeId, orders);
    }
  });

  it("sub-themes are frozen", () => {
    expect(Object.isFrozen(subThemes)).toBe(true);
    for (const st of subThemes) {
      expect(Object.isFrozen(st)).toBe(true);
    }
  });

  it("every sub-theme has areaWeight between 0 and 1", () => {
    for (const st of subThemes) {
      expect(st.areaWeight, `SubTheme ${st.id} has invalid areaWeight`).toBeGreaterThanOrEqual(0);
      expect(st.areaWeight, `SubTheme ${st.id} has invalid areaWeight`).toBeLessThanOrEqual(1);
    }
  });
});