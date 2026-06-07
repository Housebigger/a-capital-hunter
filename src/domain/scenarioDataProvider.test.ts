import { describe, expect, it } from "vitest";
import { createMockScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";
import type { MarketScenario, ReadonlyNonEmptyArray } from "./types";

describe("createMockScenarioDataProvider", () => {
  it("returns four story-driven time slices", () => {
    const scenarios = createMockScenarioDataProvider().getScenarios();
    const typedScenarios: ReadonlyNonEmptyArray<MarketScenario> = scenarios;
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(typedScenarios.length).toBeGreaterThan(0);
  });

  it("provides one value for every sector in every time slice", () => {
    const sectorIds = sectors.map((sector) => sector.id).sort();
    for (const scenario of createMockScenarioDataProvider().getScenarios()) {
      expect(scenario.points.map((point) => point.sectorId).sort()).toEqual(sectorIds);
    }
  });

  it("returns fresh scenario and point objects on each call", () => {
    const provider = createMockScenarioDataProvider();
    const first = provider.getScenarios();
    const second = provider.getScenarios();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].points).not.toBe(second[0].points);
    expect(first[0].points[0]).not.toBe(second[0].points[0]);

    first[0].points[0].netInflow = -999;
    expect(provider.getScenarios()[0].points[0].netInflow).toBe(160);
  });
});
