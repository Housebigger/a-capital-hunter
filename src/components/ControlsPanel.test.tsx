import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CapitalStateFilter, CameraPreset, ThemeFilter } from "../domain/types";
import { themes } from "../domain/themeRegistry";
import { ControlsPanel } from "./ControlsPanel";

describe("ControlsPanel", () => {
  function renderControlsPanel(options?: {
    activeTradeDate?: string;
    availableTradeDates?: readonly string[];
    themeFilter?: ThemeFilter;
    capitalStateFilter?: CapitalStateFilter;
    cameraPreset?: CameraPreset;
    viewMode?: "P1" | "P2" | "P3";
  }) {
    const handlers = {
      onTradeDateChange: vi.fn(),
      onThemeFilterChange: vi.fn(),
      onCapitalStateFilterChange: vi.fn(),
      onCameraPresetChange: vi.fn(),
      onViewModeChange: vi.fn(),
    };

    render(
      <ControlsPanel
        themes={themes}
        activeTradeDate={options?.activeTradeDate ?? "2026-06-12"}
        availableTradeDates={
          options?.availableTradeDates ?? ["2026-06-12", "2026-06-11"]
        }
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

    await user.selectOptions(screen.getByLabelText("资金流快照日期"), "2026-06-11");
    await user.selectOptions(screen.getByLabelText("主题筛选"), "ai-computing");
    await user.selectOptions(screen.getByLabelText("资金状态"), "inflow");
    await user.click(screen.getByRole("button", { name: "俯视" }));

    expect(handlers.onTradeDateChange).toHaveBeenCalledWith("2026-06-11");
    expect(handlers.onThemeFilterChange).toHaveBeenCalledWith("ai-computing");
    expect(handlers.onCapitalStateFilterChange).toHaveBeenCalledWith("inflow");
    expect(handlers.onCameraPresetChange).toHaveBeenCalledWith("top");
  });

  it("populates the date select from availableTradeDates", () => {
    renderControlsPanel({
      availableTradeDates: ["2026-06-12", "2026-06-11", "2026-06-10"],
    });
    const select = screen.getByLabelText("资金流快照日期") as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(select.options[0].value).toBe("2026-06-12");
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
});
