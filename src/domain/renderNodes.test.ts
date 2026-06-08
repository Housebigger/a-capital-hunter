import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "./layoutProvider";
import { buildRenderNodes } from "./renderNodes";
import { createMockScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";
import type { CapitalStateFilter, MarketScenario, SectorLayout, ThemeFilter } from "./types";

const layout = createManualLayoutProvider().getLayout();
const [defaultScenario] = createMockScenarioDataProvider().getScenarios();

const buildNodes = ({
  scenario = defaultScenario,
  themeFilter = "all",
  capitalStateFilter = "all",
  showCentersOnly = false,
  layout: inputLayout = layout
}: {
  scenario?: MarketScenario;
  themeFilter?: ThemeFilter;
  capitalStateFilter?: CapitalStateFilter;
  showCentersOnly?: boolean;
  layout?: SectorLayout;
} = {}) =>
  buildRenderNodes({
    layout: inputLayout,
    scenario,
    themeFilter,
    capitalStateFilter,
    showCentersOnly
  });

describe("buildRenderNodes", () => {
  it("joins sector metadata, layout, and scenario data", () => {
    const nodes = buildNodes();
    expect(nodes).toHaveLength(sectors.length);
    expect(nodes.every((node) => node.visible)).toBe(true);
    expect(nodes.find((node) => node.sector.id === "ai-computing")).toMatchObject({
      sector: expect.objectContaining({ name: "AI算力" }),
      metric: expect.objectContaining({ direction: "inflow" })
    });
  });

  it("filters by theme and dims non-matching sectors", () => {
    const nodes = buildNodes({ themeFilter: "ai-computing" });
    expect(nodes.filter((node) => node.visible)).toHaveLength(6);
    expect(nodes.find((node) => node.sector.id === "robotics-physical-ai")?.dimmed).toBe(true);
  });

  it("throws a useful error for an unknown theme filter", () => {
    expect(() => buildNodes({ themeFilter: "not-a-theme" })).toThrow(
      "Unknown theme filter: not-a-theme"
    );
  });

  it("filters by capital state and dims non-matching sectors", () => {
    const nodes = buildNodes({ capitalStateFilter: "outflow" });
    const visibleNodes = nodes.filter((node) => node.visible);

    expect(visibleNodes).toHaveLength(6);
    expect(visibleNodes.every((node) => node.metric.direction === "outflow")).toBe(true);
    expect(nodes.find((node) => node.sector.id === "low-altitude-economy")).toMatchObject({
      visible: true,
      dimmed: false
    });
    expect(nodes.find((node) => node.sector.id === "ai-computing")).toMatchObject({
      visible: false,
      dimmed: true
    });
  });

  it("can show only theme centers", () => {
    const nodes = buildNodes({ showCentersOnly: true });
    const layoutSectorIds = new Set(layout.cells.map((cell) => cell.sectorId));
    const scenarioSectorIds = new Set(defaultScenario.points.map((point) => point.sectorId));
    const expectedCenterIds = sectors
      .filter(
        (sector) =>
          sector.isThemeCenter && layoutSectorIds.has(sector.id) && scenarioSectorIds.has(sector.id)
      )
      .map((sector) => sector.id);

    expect(nodes.filter((node) => node.visible).map((node) => node.sector.id)).toEqual(
      expectedCenterIds
    );
  });

  it("throws a useful error for duplicate scenario points", () => {
    const duplicatePoint = defaultScenario.points[0];
    const scenario = {
      ...defaultScenario,
      points: [...defaultScenario.points, { ...duplicatePoint, netInflow: 999 }]
    };

    expect(() => buildNodes({ scenario })).toThrow(
      `Duplicate scenario point for ${duplicatePoint.sectorId}`
    );
  });

  it("throws a useful error for a missing scenario point", () => {
    const scenario = {
      ...defaultScenario,
      points: defaultScenario.points.filter((point) => point.sectorId !== "ai-computing")
    };

    expect(() => buildNodes({ scenario })).toThrow("Missing scenario point for ai-computing");
  });
});
