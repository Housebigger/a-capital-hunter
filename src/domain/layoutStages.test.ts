import { describe, expect, it } from "vitest";
import { getLayoutStageById, layoutStages } from "./layoutStages";
import { sectors, themes } from "./themeRegistry";

describe("layoutStages", () => {
  it("defines three market-stage layout versions", () => {
    expect(layoutStages.map((stage) => stage.id)).toEqual([
      "ai-semiconductor-resonance",
      "robotics-low-altitude-diffusion",
      "new-energy-defense-rotation"
    ]);
  });

  it("provides theme heat and sector heat for every renderable item", () => {
    for (const stage of layoutStages) {
      for (const theme of themes) {
        expect(stage.themeHeat[theme.id]).toEqual(expect.any(Number));
      }
      for (const sector of sectors) {
        expect(stage.sectorHeat[sector.id]).toEqual(expect.any(Number));
      }
    }
  });

  it("looks up stages by id", () => {
    expect(getLayoutStageById("robotics-low-altitude-diffusion").label).toBe("机器人/低空扩散");
  });
});
