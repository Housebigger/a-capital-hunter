import { describe, expect, it } from "vitest";
import { createAlgorithmicLayoutProvider } from "./layoutProvider";
import { normalizeCapitalValue } from "./metricNormalizer";
import { buildRenderNodes } from "./renderNodes";
import { createScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";
import type { CapitalStateFilter, MarketScenario, SectorLayout, ThemeFilter } from "./types";

const layout = createAlgorithmicLayoutProvider().getLayout();
const [defaultScenario] = createScenarioDataProvider().getScenarios();

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
  it("attaches layout explanations to render nodes", () => {
    const provider = createAlgorithmicLayoutProvider();
    const layout = provider.getLayout("ai-semiconductor-resonance");
    const scenario = createScenarioDataProvider().getScenarios()[0];

    const nodes = buildRenderNodes({
      layout,
      scenario,
      themeFilter: "all",
      capitalStateFilter: "all",
      showCentersOnly: false
    });

    const aiNode = nodes.find((node) => node.sector.id === "ai-computing");
    expect(aiNode?.layoutExplanation?.reasons.length).toBeGreaterThanOrEqual(3);
  });

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
    const expectedVisibleIds = sectors
      .filter((sector) => sector.primaryThemeId === "ai-computing")
      .map((sector) => sector.id)
      .sort();

    expect(
      nodes
        .filter((node) => node.visible)
        .map((node) => node.sector.id)
        .sort()
    ).toEqual(expectedVisibleIds);
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
    const maxAbsValue = Math.max(
      ...defaultScenario.points.map((point) => Math.abs(point.netInflow)),
      1
    );
    const expectedVisibleIds = defaultScenario.points
      .filter((point) => normalizeCapitalValue(point.netInflow, maxAbsValue).direction === "outflow")
      .map((point) => point.sectorId)
      .sort();

    expect(visibleNodes.map((node) => node.sector.id).sort()).toEqual(expectedVisibleIds);
    expect(visibleNodes.every((node) => node.metric.direction === "outflow")).toBe(true);
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
      .map((sector) => sector.id)
      .sort();

    expect(nodes.filter((node) => node.visible).map((node) => node.sector.id).sort()).toEqual(
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
