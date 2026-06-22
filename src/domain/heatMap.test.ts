import { describe, it, expect } from "vitest";
import { buildHeatMap } from "./heatMap";

const subThemes = [
  { id: "a1", themeId: "ai" }, { id: "a2", themeId: "ai" },
  { id: "b1", themeId: "bio" }, { id: "b2", themeId: "bio" },
];

describe("buildHeatMap", () => {
  it("uses absolute value — big inflow and big outflow are both hot", () => {
    const byTheme = new Map([["ai", 100], ["bio", -100]]);
    const { themeHeat } = buildHeatMap(byTheme, new Map(), subThemes);
    expect(themeHeat.ai).toBeCloseTo(1);
    expect(themeHeat.bio).toBeCloseTo(1); // outflow of equal magnitude = equally hot
  });

  it("normalizes theme heat across all themes (max abs = 1)", () => {
    const byTheme = new Map([["ai", 200], ["bio", -50]]);
    const { themeHeat } = buildHeatMap(byTheme, new Map(), subThemes);
    expect(themeHeat.ai).toBeCloseTo(1);
    expect(themeHeat.bio).toBeCloseTo(0.25);
  });

  it("normalizes sub-theme heat WITHIN the parent theme", () => {
    // ai sub-themes are small in absolute terms; bio sub-themes are huge.
    const bySub = new Map([["a1", 10], ["a2", 5], ["b1", 1000], ["b2", 250]]);
    const { subThemeHeat } = buildHeatMap(new Map(), bySub, subThemes);
    expect(subThemeHeat.a1).toBeCloseTo(1);    // biggest within ai
    expect(subThemeHeat.a2).toBeCloseTo(0.5);
    expect(subThemeHeat.b1).toBeCloseTo(1);    // biggest within bio, NOT shrunk by being compared to ai
    expect(subThemeHeat.b2).toBeCloseTo(0.25);
  });

  it("all-flat input → all heat 0, no NaN", () => {
    const { themeHeat, subThemeHeat } = buildHeatMap(
      new Map([["ai", 0], ["bio", 0]]),
      new Map([["a1", 0], ["b1", 0]]),
      subThemes
    );
    expect(themeHeat.ai).toBe(0);
    expect(subThemeHeat.a1).toBe(0);
    expect(Number.isNaN(themeHeat.bio)).toBe(false);
  });

  it("skips sub-themes whose parent theme is unknown", () => {
    const { subThemeHeat } = buildHeatMap(new Map(), new Map([["ghost", 99]]), subThemes);
    expect(subThemeHeat.ghost).toBeUndefined();
  });
});
