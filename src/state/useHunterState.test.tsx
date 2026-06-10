import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockScenarioDataProvider } from "../domain/scenarioDataProvider";
import { getScenarioIds, useHunterState } from "./useHunterState";
import type { ReadonlyNonEmptyArray } from "../domain/types";

describe("useHunterState", () => {
  it("starts with all filters enabled and the first time slice", () => {
    const scenarioIds = ["S1", "S2"] as const;
    const { result } = renderHook(() => useHunterState(scenarioIds));

    expect(result.current.activeScenarioId).toBe("S1");
    expect(result.current.themeFilter).toBe("all");
    expect(result.current.capitalStateFilter).toBe("all");
    expect(result.current.cameraPreset).toBe("angled");
  });

  it("updates filters and clears selection when scenario changes", () => {
    const scenarioIds = ["S1", "S2"] as const;
    const { result } = renderHook(() => useHunterState(scenarioIds));

    act(() => result.current.setSelectedSectorId("ai-computing"));
    act(() => result.current.setActiveScenarioId("S2"));

    expect(result.current.activeScenarioId).toBe("S2");
    expect(result.current.selectedSectorId).toBeUndefined();
  });

  it("derives non-empty scenario ids from provider scenarios", () => {
    const scenarios = createMockScenarioDataProvider().getScenarios();
    const scenarioIds: ReadonlyNonEmptyArray<string> = getScenarioIds(scenarios);

    expect(scenarioIds).toEqual(["S1", "S2", "S3", "S4", "S5"]);
  });
});
