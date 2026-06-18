import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CapitalStateFilter, CameraPreset, ThemeFilter } from "../domain/types";
import type { CapitalFlowWindowKey } from "../data/capitalFlowDataProvider";
import { themes } from "../domain/themeRegistry";
import { ControlsPanel } from "./ControlsPanel";

describe("ControlsPanel", () => {
  const baseProps = {
    themes,
    activeWindow: "1d" as CapitalFlowWindowKey,
    onWindowChange: vi.fn(),
    themeFilter: "all" as ThemeFilter,
    capitalStateFilter: "all" as CapitalStateFilter,
    cameraPreset: "angled" as CameraPreset,
    viewMode: "P1" as "P1" | "P2" | "P3",
    onViewModeChange: vi.fn(),
    onThemeFilterChange: vi.fn(),
    onCapitalStateFilterChange: vi.fn(),
    onCameraPresetChange: vi.fn(),
  };

  function renderControlsPanel(options?: {
    activeWindow?: CapitalFlowWindowKey;
    themeFilter?: ThemeFilter;
    capitalStateFilter?: CapitalStateFilter;
    cameraPreset?: CameraPreset;
    viewMode?: "P1" | "P2" | "P3";
  }) {
    const handlers = {
      onWindowChange: vi.fn(),
      onThemeFilterChange: vi.fn(),
      onCapitalStateFilterChange: vi.fn(),
      onCameraPresetChange: vi.fn(),
      onViewModeChange: vi.fn(),
    };

    render(
      <ControlsPanel
        themes={themes}
        activeWindow={options?.activeWindow ?? "1d"}
        themeFilter={options?.themeFilter ?? "all"}
        capitalStateFilter={options?.capitalStateFilter ?? "all"}
        cameraPreset={options?.cameraPreset ?? "angled"}
        viewMode={options?.viewMode ?? "P1"}
        {...handlers}
      />
    );

    return handlers;
  }

  it("calls handlers when controls change", async () => {
    const user = userEvent.setup();
    const handlers = renderControlsPanel();

    await user.selectOptions(screen.getByLabelText("主题筛选"), "ai-computing");
    await user.selectOptions(screen.getByLabelText("资金状态"), "inflow");
    await user.click(screen.getByRole("button", { name: "俯视" }));

    expect(handlers.onThemeFilterChange).toHaveBeenCalledWith("ai-computing");
    expect(handlers.onCapitalStateFilterChange).toHaveBeenCalledWith("inflow");
    expect(handlers.onCameraPresetChange).toHaveBeenCalledWith("top");
  });

  it("reflects the active view mode in the segmented control", () => {
    renderControlsPanel({ viewMode: "P3" });
    expect(screen.getByRole("button", { name: /P3 个股/, pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: /P1 主线/, pressed: false })).toBeVisible();
  });

  it("reflects the active camera preset", () => {
    renderControlsPanel({ cameraPreset: "side" });
    expect(screen.getByRole("button", { name: "侧视", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "斜视", pressed: false })).toBeVisible();
  });

  it("renders four window buttons and reports clicks", async () => {
    const onWindowChange = vi.fn();
    render(<ControlsPanel {...baseProps} activeWindow="1d" onWindowChange={onWindowChange} />);
    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "近20日" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "近5日" }));
    expect(onWindowChange).toHaveBeenCalledWith("5d");
  });
});
