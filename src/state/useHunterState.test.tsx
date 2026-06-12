import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHunterState } from "./useHunterState";

describe("useHunterState", () => {
  it("starts with all filters enabled and default camera", () => {
    const { result } = renderHook(() => useHunterState());

    expect(result.current.themeFilter).toBe("all");
    expect(result.current.capitalStateFilter).toBe("all");
    expect(result.current.cameraPreset).toBe("angled");
  });

  it("updates filters independently", () => {
    const { result } = renderHook(() => useHunterState());

    act(() => {
      result.current.setThemeFilter("ai-computing");
      result.current.setCapitalStateFilter("inflow");
      result.current.setCameraPreset("top");
    });

    expect(result.current.themeFilter).toBe("ai-computing");
    expect(result.current.capitalStateFilter).toBe("inflow");
    expect(result.current.cameraPreset).toBe("top");
  });
});
