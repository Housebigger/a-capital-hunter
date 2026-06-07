import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "./layoutProvider";
import { buildRenderNodes } from "./renderNodes";
import { createMockScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";

describe("buildRenderNodes", () => {
  it("joins sector metadata, layout, and scenario data", () => {
    const nodes = buildRenderNodes({
      layout: createManualLayoutProvider().getLayout(),
      scenario: createMockScenarioDataProvider().getScenarios()[0],
      themeFilter: "all",
      capitalStateFilter: "all",
      showCentersOnly: false
    });
    expect(nodes).toHaveLength(sectors.length);
    expect(nodes.every((node) => node.visible)).toBe(true);
    expect(nodes.find((node) => node.sector.id === "ai-computing")).toMatchObject({
      sector: expect.objectContaining({ name: "AI算力" }),
      metric: expect.objectContaining({ direction: "inflow" })
    });
  });

  it("filters by theme and dims non-matching sectors", () => {
    const nodes = buildRenderNodes({
      layout: createManualLayoutProvider().getLayout(),
      scenario: createMockScenarioDataProvider().getScenarios()[0],
      themeFilter: "ai-computing",
      capitalStateFilter: "all",
      showCentersOnly: false
    });
    expect(nodes.filter((node) => node.visible)).toHaveLength(6);
    expect(nodes.find((node) => node.sector.id === "robotics-physical-ai")?.dimmed).toBe(true);
  });

  it("can show only theme centers", () => {
    const nodes = buildRenderNodes({
      layout: createManualLayoutProvider().getLayout(),
      scenario: createMockScenarioDataProvider().getScenarios()[0],
      themeFilter: "all",
      capitalStateFilter: "all",
      showCentersOnly: true
    });
    expect(nodes.filter((node) => node.visible).map((node) => node.sector.id)).toEqual([
      "ai-computing",
      "robotics-physical-ai",
      "low-altitude-economy"
    ]);
  });
});
