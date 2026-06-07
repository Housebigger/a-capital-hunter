import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHunterState } from "./useHunterState";

describe("useHunterState", () => {
  it("starts with all filters enabled and the first time slice", () => {
    const { result } = renderHook(() => useHunterState(["t1", "t2"]));
    expect(result.current.activeScenarioId).toBe("t1");
    expect(result.current.themeFilter).toBe("all");
    expect(result.current.capitalStateFilter).toBe("all");
    expect(result.current.cameraPreset).toBe("angled");
  });

  it("updates filters and clears selection when scenario changes", () => {
    const { result } = renderHook(() => useHunterState(["t1", "t2"]));
    act(() => result.current.setSelectedSectorId("ai-computing"));
    act(() => result.current.setActiveScenarioId("t2"));
    expect(result.current.activeScenarioId).toBe("t2");
    expect(result.current.selectedSectorId).toBeUndefined();
  });
});
