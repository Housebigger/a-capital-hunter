import { layoutStages } from "./layoutStages";
import { sectors } from "./themeRegistry";
import type { DataProvider, MarketScenario, ReadonlyNonEmptyArray } from "./types";

const heatToInflow = (heat: number, isThemeCenter: boolean): number => {
  const base = heat >= 0.9 ? 96 : heat >= 0.55 ? 42 : -18;
  return isThemeCenter ? base * 1.35 : base;
};

const scenarios = layoutStages.map((stage, index) => ({
  id: `S${index + 1}`,
  label: stage.label,
  story: stage.story,
  points: sectors.map((sector) => ({
    sectorId: sector.id,
    netInflow: Number(heatToInflow(stage.sectorHeat[sector.id] ?? 0.2, sector.isThemeCenter).toFixed(1))
  }))
})) as ReadonlyNonEmptyArray<MarketScenario>;

export function createScenarioDataProvider(): DataProvider {
  return {
    getScenarios: () => scenarios
  };
}

export function createMockScenarioDataProvider(): DataProvider {
  return createScenarioDataProvider();
}
