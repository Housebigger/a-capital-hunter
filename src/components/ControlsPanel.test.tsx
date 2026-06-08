import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CapitalStateFilter, CameraPreset, ThemeFilter } from "../domain/types";
import { createMockScenarioDataProvider } from "../domain/scenarioDataProvider";
import { themes } from "../domain/themeRegistry";
import { ControlsPanel } from "./ControlsPanel";

describe("ControlsPanel", () => {
  function renderControlsPanel(options?: {
    activeScenarioId?: string;
    themeFilter?: ThemeFilter;
    capitalStateFilter?: CapitalStateFilter;
    cameraPreset?: CameraPreset;
    showCentersOnly?: boolean;
  }) {
    const handlers = {
      onScenarioChange: vi.fn(),
      onThemeFilterChange: vi.fn(),
      onCapitalStateFilterChange: vi.fn(),
      onCameraPresetChange: vi.fn(),
      onShowCentersOnlyChange: vi.fn()
    };

    render(
      <ControlsPanel
        scenarios={createMockScenarioDataProvider().getScenarios()}
        themes={themes}
        activeScenarioId={options?.activeScenarioId ?? "S1"}
        themeFilter={options?.themeFilter ?? "all"}
        capitalStateFilter={options?.capitalStateFilter ?? "all"}
        cameraPreset={options?.cameraPreset ?? "angled"}
        showCentersOnly={options?.showCentersOnly ?? false}
        {...handlers}
      />
    );

    return handlers;
  }

  it("calls handler props when controls change", async () => {
    const user = userEvent.setup();
    const handlers = renderControlsPanel();

    await user.click(screen.getByRole("button", { name: "机器人/低空扩散" }));
    await user.selectOptions(screen.getByLabelText("主题筛选"), "ai-computing");
    await user.selectOptions(screen.getByLabelText("资金状态"), "inflow");
    await user.click(screen.getByRole("checkbox", { name: "只看主线中心" }));
    await user.click(screen.getByRole("button", { name: "俯视" }));

    expect(handlers.onScenarioChange).toHaveBeenCalledWith("S2");
    expect(handlers.onThemeFilterChange).toHaveBeenCalledWith("ai-computing");
    expect(handlers.onCapitalStateFilterChange).toHaveBeenCalledWith("inflow");
    expect(handlers.onShowCentersOnlyChange).toHaveBeenCalledWith(true);
    expect(handlers.onCameraPresetChange).toHaveBeenCalledWith("top");
  });

  it("exposes pressed state for active timeline and camera buttons", () => {
    renderControlsPanel({ activeScenarioId: "S2", cameraPreset: "side" });

    expect(screen.getByRole("button", { name: "机器人/低空扩散", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "AI/半导体共振", pressed: false })).toBeVisible();
    expect(screen.getByRole("button", { name: "侧视", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "斜视", pressed: false })).toBeVisible();
  });
});
