import { describe, it, expect } from "vitest";
import type { VoronoiCell, MarketScenario } from "./types";
import { sectors } from "./themeRegistry";
import { stocks } from "./stockRegistry";
import { subThemes } from "./subThemeRegistry";
import { placeStocksInCell } from "./stockLayoutEngine";
import { buildP3StockRenderNodes } from "./stockRenderNodes";
import type { StockCapitalFlowPoint } from "../data/capitalFlowSnapshot";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockScenario: MarketScenario = {
  id: "test-S1",
  label: "Test",
  story: "Test scenario",
  points: sectors.map((s) => ({ sectorId: s.id, netInflow: 50 })),
};

/** Build a rectangular VoronoiCell for a known SubTheme. */
function makeCell(subThemeId: string, themeId: string): VoronoiCell {
  return {
    subThemeId,
    center: { x: 1, z: 2 },
    polygon: [
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 4 },
      { x: 0, z: 4 },
    ],
    themeId,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildP3StockRenderNodes", () => {
  it("returns empty array for empty cells", () => {
    const result = buildP3StockRenderNodes({
      voronoiCells: [],
      scenario: mockScenario,
    });
    expect(result).toEqual([]);
  });

  it("returns correct stock count for cells with stocks", () => {
    // "ai-optical-interconnect" has 5 stocks in stockRegistry
    const cell = makeCell("ai-optical-interconnect", "ai-computing");
    const result = buildP3StockRenderNodes({
      voronoiCells: [cell],
      scenario: mockScenario,
    });

    const opticalStocks = stocks.filter(
      (s) => s.subThemeId === "ai-optical-interconnect"
    );
    expect(opticalStocks.length).toBeGreaterThan(0);
    expect(result.length).toBe(opticalStocks.length);
  });

  it("all positions match stockLayoutEngine output", () => {
    const cell = makeCell("ai-optical-interconnect", "ai-computing");
    const result = buildP3StockRenderNodes({
      voronoiCells: [cell],
      scenario: mockScenario,
    });

    const cellStocks = stocks.filter(
      (s) => s.subThemeId === "ai-optical-interconnect"
    );
    const positions = placeStocksInCell(cell, cellStocks);
    const posMap = new Map(positions.map((p) => [p.stockId, p]));

    for (const node of result) {
      const expectedPos = posMap.get(node.stock.id);
      expect(expectedPos).toBeDefined();
      expect(node.position.x).toBeCloseTo(expectedPos!.x);
      expect(node.position.z).toBeCloseTo(expectedPos!.z);
    }
  });

  it("filters by theme when themeFilter is set", () => {
    // Two cells from different themes
    const aiCell = makeCell("ai-optical-interconnect", "ai-computing");
    const robotCell = makeCell("robo-reducers", "robotics-physical-ai");

    const resultAll = buildP3StockRenderNodes({
      voronoiCells: [aiCell, robotCell],
      scenario: mockScenario,
    });
    const resultFiltered = buildP3StockRenderNodes({
      voronoiCells: [aiCell, robotCell],
      scenario: mockScenario,
      themeFilter: "ai-computing",
    });

    // Unfiltered has nodes from both themes
    const themesInAll = new Set(resultAll.map((n) => n.theme.id));
    expect(themesInAll.size).toBeGreaterThanOrEqual(2);

    // Filtered only has ai-computing
    for (const node of resultFiltered) {
      expect(node.theme.id).toBe("ai-computing");
    }

    // Filtered result is a strict subset
    expect(resultFiltered.length).toBeLessThan(resultAll.length);
  });

  it("stock metrics have valid values", () => {
    const cell = makeCell("ai-optical-interconnect", "ai-computing");
    const result = buildP3StockRenderNodes({
      voronoiCells: [cell],
      scenario: mockScenario,
    });

    expect(result.length).toBeGreaterThan(0);

    for (const node of result) {
      const { metric } = node;
      // Height should be a number (non-NaN)
      expect(Number.isNaN(metric.height)).toBe(false);
      // Height should be positive for inflow scenario
      expect(metric.height).toBeGreaterThan(0);
      // Color should be defined
      expect(metric.color).toBeTruthy();
      expect(typeof metric.color).toBe("string");
      // Direction should be one of the valid values
      expect(["inflow", "outflow", "flat"]).toContain(metric.direction);
      // Intensity should be between 0 and 1
      expect(metric.intensity).toBeGreaterThan(0);
      expect(metric.intensity).toBeLessThanOrEqual(1);
    }
  });

  it("skips cells with no matching stocks", () => {
    // Use a subThemeId that exists but has no stocks registered
    const fakeSubThemeId = "nonexistent-subtheme";
    const cell: VoronoiCell = {
      subThemeId: fakeSubThemeId,
      center: { x: 0, z: 0 },
      polygon: [
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: 1, z: 1 },
        { x: -1, z: 1 },
      ],
      themeId: "ai-computing",
    };

    const result = buildP3StockRenderNodes({
      voronoiCells: [cell],
      scenario: mockScenario,
    });

    expect(result).toEqual([]);
  });

  it("each node references the correct stock, subTheme, and theme", () => {
    const cell = makeCell("robo-reducers", "robotics-physical-ai");
    const result = buildP3StockRenderNodes({
      voronoiCells: [cell],
      scenario: mockScenario,
    });

    const expectedSubTheme = subThemes.find(
      (st) => st.id === "robo-reducers"
    );
    expect(expectedSubTheme).toBeDefined();

    for (const node of result) {
      expect(node.stock.subThemeId).toBe("robo-reducers");
      expect(node.subTheme.id).toBe("robo-reducers");
      expect(node.theme.id).toBe("robotics-physical-ai");
      expect(node.cell).toBe(cell);
    }
  });
});

// ---------------------------------------------------------------------------
// Real-data path (JQData snapshot points)
// ---------------------------------------------------------------------------

describe("buildP3StockRenderNodes (real points)", () => {
  it("omits stocks that have no real point", () => {
    const cell = makeCell("ai-optical-interconnect", "ai-computing");
    const opticalStocks = stocks.filter(
      (s) => s.subThemeId === "ai-optical-interconnect"
    );
    // Only one stock has a real point.
    const points: StockCapitalFlowPoint[] = [
      {
        stockId: opticalStocks[0].id,
        securityCode: "300308.XSHE",
        stockName: opticalStocks[0].name,
        subThemeId: "ai-optical-interconnect",
        themeId: "ai-computing",
        aggregationRole: "primary",
        netAmountMain: 12_345_600,
        tradeDate: "2026-06-12",
      },
    ];
    const nodes = buildP3StockRenderNodes({
      voronoiCells: [cell],
      points,
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].stock.id).toBe(opticalStocks[0].id);
    expect(nodes[0].metric.rawValue).toBe(12_345_600);
  });

  it("never uses the synthetic value 5 when real points are provided", () => {
    const cell = makeCell("ai-optical-interconnect", "ai-computing");
    const nodes = buildP3StockRenderNodes({
      voronoiCells: [cell],
      points: [], // empty → no nodes at all, not synthetic placeholders
    });
    expect(nodes.every((n) => n.metric.rawValue !== 5)).toBe(true);
    expect(nodes).toHaveLength(0);
  });

  it("uses each point's true netAmountMain", () => {
    const cell = makeCell("ai-optical-interconnect", "ai-computing");
    const opticalStocks = stocks.filter(
      (s) => s.subThemeId === "ai-optical-interconnect"
    );
    const points: StockCapitalFlowPoint[] = opticalStocks.map((s, i) => ({
      stockId: s.id,
      securityCode: `${s.code}.${s.code.startsWith("6") ? "XSHG" : "XSHE"}`,
      stockName: s.name,
      subThemeId: "ai-optical-interconnect",
      themeId: "ai-computing",
      aggregationRole: i === 0 ? "primary" : "related",
      netAmountMain: (i + 1) * 10_000_000,
      tradeDate: "2026-06-12",
    }));
    const nodes = buildP3StockRenderNodes({
      voronoiCells: [cell],
      points,
    });
    const valueById = new Map(nodes.map((n) => [n.stock.id, n.metric.rawValue]));
    for (const p of points) {
      expect(valueById.get(p.stockId)).toBe(p.netAmountMain);
    }
  });
});

