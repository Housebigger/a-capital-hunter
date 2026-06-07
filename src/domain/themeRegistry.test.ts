import { describe, expect, it } from "vitest";
import { sectors, themes } from "./themeRegistry";

describe("themeRegistry", () => {
  it("defines the three approved theme centers", () => {
    expect(themes.map((theme) => theme.id)).toEqual([
      "ai-computing",
      "robotics-physical-ai",
      "low-altitude-economy"
    ]);
  });

  it("defines five sectors for each theme including the center", () => {
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
});
