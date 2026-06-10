import { describe, expect, it } from "vitest";
import { createMockScenarioDataProvider, createScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";
import type { MarketScenario, ReadonlyNonEmptyArray } from "./types";

describe("createScenarioDataProvider", () => {
  it("returns five layout-stage scenarios", () => {
    const scenarios = createScenarioDataProvider().getScenarios();
    const typedScenarios: ReadonlyNonEmptyArray<MarketScenario> = scenarios;
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(typedScenarios.length).toBeGreaterThan(0);
  });

  it("provides a value for every sector in every scenario", () => {
    const provider = createScenarioDataProvider();

    for (const scenario of provider.getScenarios()) {
      expect(scenario.points).toHaveLength(sectors.length);
      expect(new Set(scenario.points.map((point) => point.sectorId)).size).toBe(sectors.length);
    }
  });

  it("returns fresh scenario and point objects on each call", () => {
    const provider = createScenarioDataProvider();
    const first = provider.getScenarios();
    const second = provider.getScenarios();
    const originalNetInflow = second[0].points[0].netInflow;

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].points).not.toBe(second[0].points);
    expect(first[0].points[0]).not.toBe(second[0].points[0]);

    first[0].points[0].netInflow = -999;
    expect(provider.getScenarios()[0].points[0].netInflow).toBe(originalNetInflow);
  });

  it("keeps the mock provider export compatible", () => {
    expect(createMockScenarioDataProvider().getScenarios()).toEqual(
      createScenarioDataProvider().getScenarios()
    );
  });
});
