import { layoutStages } from "./layoutStages";
import { sectors } from "./themeRegistry";
import type { DataProvider, LayoutStage, MarketScenario, ReadonlyNonEmptyArray } from "./types";

const heatToInflow = (heat: number, isThemeCenter: boolean): number => {
  const base = heat >= 0.9 ? 96 : heat >= 0.55 ? 42 : -18;
  return isThemeCenter ? base * 1.35 : base;
};

const createScenario = (stage: LayoutStage, index: number): MarketScenario => ({
  id: `S${index + 1}`,
  label: stage.label,
  story: stage.story,
  points: sectors.map((sector) => ({
    sectorId: sector.id,
    netInflow: Number(heatToInflow(stage.sectorHeat[sector.id] ?? 0.2, sector.isThemeCenter).toFixed(1))
  }))
});

const createScenarios = (
  stages: ReadonlyNonEmptyArray<LayoutStage>
): ReadonlyNonEmptyArray<MarketScenario> => {
  const [firstStage, ...remainingStages] = stages;
  return [
    createScenario(firstStage, 0),
    ...remainingStages.map((stage, index) => createScenario(stage, index + 1))
  ];
};

const cloneScenario = (scenario: MarketScenario): MarketScenario => ({
  id: scenario.id,
  label: scenario.label,
  story: scenario.story,
  points: scenario.points.map((point) => ({ ...point }))
});

const cloneScenarios = (
  sourceScenarios: ReadonlyNonEmptyArray<MarketScenario>
): ReadonlyNonEmptyArray<MarketScenario> => {
  const [firstScenario, ...remainingScenarios] = sourceScenarios;
  return [cloneScenario(firstScenario), ...remainingScenarios.map(cloneScenario)];
};

const scenarios = createScenarios(layoutStages);

export function createScenarioDataProvider(): DataProvider {
  return {
    getScenarios: () => cloneScenarios(scenarios)
  };
}

export function createMockScenarioDataProvider(): DataProvider {
  return createScenarioDataProvider();
}
