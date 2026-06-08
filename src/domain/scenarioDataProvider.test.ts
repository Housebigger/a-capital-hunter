import { describe, expect, it } from "vitest";
import { createMockScenarioDataProvider, createScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";
import type { MarketScenario, ReadonlyNonEmptyArray } from "./types";

describe("createScenarioDataProvider", () => {
  it("returns three layout-stage scenarios", () => {
    const scenarios = createScenarioDataProvider().getScenarios();
    const typedScenarios: ReadonlyNonEmptyArray<MarketScenario> = scenarios;
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["S1", "S2", "S3"]);
    expect(typedScenarios.length).toBeGreaterThan(0);
  });

  it("provides a value for every sector in every scenario", () => {
    const provider = createScenarioDataProvider();

    for (const scenario of provider.getScenarios()) {
      expect(scenario.points).toHaveLength(sectors.length);
      expect(new Set(scenario.points.map((point) => point.sectorId)).size).toBe(sectors.length);
    }
  });

  it("keeps the mock provider export compatible", () => {
    expect(createMockScenarioDataProvider().getScenarios()).toEqual(
      createScenarioDataProvider().getScenarios()
    );
  });
});
