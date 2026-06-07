import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockScenarioDataProvider } from "../domain/scenarioDataProvider";
import { themes } from "../domain/themeRegistry";
import { ControlsPanel } from "./ControlsPanel";

describe("ControlsPanel", () => {
  it("calls change handlers for timeline and filters", async () => {
    const user = userEvent.setup();
    const scenarios = createMockScenarioDataProvider().getScenarios();
    const onScenarioChange = vi.fn();
    const onThemeFilterChange = vi.fn();

    render(
      <ControlsPanel
        scenarios={scenarios}
        themes={themes}
        activeScenarioId="t1"
        themeFilter="all"
        capitalStateFilter="all"
        cameraPreset="angled"
        showCentersOnly={false}
        onScenarioChange={onScenarioChange}
        onThemeFilterChange={onThemeFilterChange}
        onCapitalStateFilterChange={vi.fn()}
        onCameraPresetChange={vi.fn()}
        onShowCentersOnlyChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "T2 机器人接力" }));
    await user.selectOptions(screen.getByLabelText("主题筛选"), "ai-computing");

    expect(onScenarioChange).toHaveBeenCalledWith("t2");
    expect(onThemeFilterChange).toHaveBeenCalledWith("ai-computing");
  });
});
