import { describe, expect, it } from "vitest";
import { getLayoutStageById, layoutStages } from "./layoutStages";
import { sectors, themes } from "./themeRegistry";

describe("layoutStages", () => {
  it("has 5 layout stages", () => {
    expect(layoutStages.length).toBe(5);
  });

  it("defines five market-stage layout versions", () => {
    expect(layoutStages.map((stage) => stage.id)).toEqual([
      "ai-semiconductor-resonance",
      "robotics-low-altitude-diffusion",
      "new-energy-defense-rotation",
      "consumer-digital-growth",
      "nev-autonomous-driving-breakout"
    ]);
  });

  it("stages 4 and 5 have correct previousStageId", () => {
    expect(layoutStages[3].previousStageId).toBe(layoutStages[2].id);
    expect(layoutStages[4].previousStageId).toBe(layoutStages[3].id);
  });

  it("every stage has heat values for all 11 themes", () => {
    const themeIds = new Set(themes.map((t) => t.id));
    for (const stage of layoutStages) {
      for (const themeId of themeIds) {
        expect(stage.themeHeat[themeId], `Stage ${stage.id} missing themeHeat for ${themeId}`).toBeDefined();
      }
    }
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

  it("freezes stages and heat records", () => {
    for (const stage of layoutStages) {
      expect(Object.isFrozen(stage)).toBe(true);
      expect(Object.isFrozen(stage.themeHeat)).toBe(true);
      expect(Object.isFrozen(stage.sectorHeat)).toBe(true);
    }
  });

  it("looks up stages by id", () => {
    expect(getLayoutStageById("robotics-low-altitude-diffusion").label).toBe("机器人/低空扩散");
    expect(getLayoutStageById("consumer-digital-growth").label).toBe("消费电子/数字经济增长");
    expect(getLayoutStageById("nev-autonomous-driving-breakout").label).toBe("新能源汽车/智能驾驶爆发");
  });
});
