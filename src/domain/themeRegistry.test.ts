import { describe, expect, it } from "vitest";
import { sectors, themes } from "./themeRegistry";

describe("themeRegistry", () => {
  it("supports the second-generation theme universe", () => {
    expect(themes).toHaveLength(7);
    expect(themes.map((theme) => theme.id)).toEqual([
      "ai-computing",
      "robotics-physical-ai",
      "low-altitude-economy",
      "semiconductors",
      "new-energy",
      "defense-aerospace",
      "innovative-medicine"
    ]);
  });

  it("stores industrial chain roles for every sector", () => {
    expect(sectors).toHaveLength(42);
    expect(sectors.every((sector) => sector.industrialChainRole.length > 0)).toBe(true);
  });

  it("defines the three approved theme centers", () => {
    expect(themes.map((theme) => theme.id)).toEqual([
      "ai-computing",
      "robotics-physical-ai",
      "low-altitude-economy"
    ]);
  });

  it("defines six sectors for each theme including the center", () => {
    for (const theme of themes) {
      const themeSectors = sectors.filter((sector) => sector.primaryThemeId === theme.id);
      expect(themeSectors).toHaveLength(6);
      expect(themeSectors.filter((sector) => sector.isThemeCenter)).toHaveLength(1);
    }
  });

  it("keeps sector ids unique", () => {
    const ids = sectors.map((sector) => sector.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps each sector related to its primary theme", () => {
    for (const sector of sectors) {
      expect(sector.relatedThemeIds).toContain(sector.primaryThemeId);
    }
  });

  it("exports frozen theme and sector config", () => {
    expect(Object.isFrozen(themes)).toBe(true);
    expect(Object.isFrozen(sectors)).toBe(true);

    for (const theme of themes) {
      expect(Object.isFrozen(theme)).toBe(true);
    }

    for (const sector of sectors) {
      expect(Object.isFrozen(sector)).toBe(true);
      expect(Object.isFrozen(sector.relatedThemeIds)).toBe(true);
      expect(Object.isFrozen(sector.aliases)).toBe(true);
    }
  });
});
