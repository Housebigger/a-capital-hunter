import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CapitalStateFilter, CameraPreset, ThemeFilter } from "../domain/types";
import { themes } from "../domain/themeRegistry";
import { ControlsPanel } from "./ControlsPanel";

describe("ControlsPanel", () => {
  function renderControlsPanel(options?: {
    activePeriod?: string;
    themeFilter?: ThemeFilter;
    capitalStateFilter?: CapitalStateFilter;
    cameraPreset?: CameraPreset;
  }) {
    const handlers = {
      onPeriodChange: vi.fn(),
      onThemeFilterChange: vi.fn(),
      onCapitalStateFilterChange: vi.fn(),
      onCameraPresetChange: vi.fn(),
    };

    render(
      <ControlsPanel
        themes={themes}
        activePeriod={options?.activePeriod ?? "今日"}
        themeFilter={options?.themeFilter ?? "all"}
        capitalStateFilter={options?.capitalStateFilter ?? "all"}
        cameraPreset={options?.cameraPreset ?? "angled"}
        {...handlers}
      />
    );

    return handlers;
  }

  it("calls handler props when controls change", async () => {
    const user = userEvent.setup();
    const handlers = renderControlsPanel();

    await user.click(screen.getByRole("button", { name: "近5日" }));
    await user.selectOptions(screen.getByLabelText("主题筛选"), "ai-computing");
    await user.selectOptions(screen.getByLabelText("资金状态"), "inflow");
    await user.click(screen.getByRole("button", { name: "俯视" }));

    expect(handlers.onPeriodChange).toHaveBeenCalledWith("5日");
    expect(handlers.onThemeFilterChange).toHaveBeenCalledWith("ai-computing");
    expect(handlers.onCapitalStateFilterChange).toHaveBeenCalledWith("inflow");
    expect(handlers.onCameraPresetChange).toHaveBeenCalledWith("top");
  });

  it("exposes pressed state for active period and camera buttons", () => {
    renderControlsPanel({ activePeriod: "5日", cameraPreset: "side" });

    expect(screen.getByRole("button", { name: "近5日", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "今日", pressed: false })).toBeVisible();
    expect(screen.getByRole("button", { name: "侧视", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "斜视", pressed: false })).toBeVisible();
  });
});
