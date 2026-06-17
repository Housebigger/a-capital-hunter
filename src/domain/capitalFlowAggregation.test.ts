import { describe, it, expect } from "vitest";
import { buildCapitalFlowAggregates } from "./capitalFlowAggregation";
import type { StockCapitalFlowPoint } from "../data/capitalFlowSnapshot";

// One security (688111 金山办公) with a primary mapping under ai-applications
// and a related mapping under cloud-software. Aggregation must count it once.
const snapshotFixture: readonly StockCapitalFlowPoint[] = [
  {
    stockId: "aa-jsbg",
    securityCode: "688111.XSHG",
    stockName: "金山办公",
    subThemeId: "ai-applications",
    themeId: "ai-computing",
    aggregationRole: "primary",
    netAmountMain: 150_000_000,
    tradeDate: "2026-06-12",
  },
  {
    stockId: "cs-jsbg2",
    securityCode: "688111.XSHG",
    stockName: "金山办公",
    subThemeId: "cloud-software",
    themeId: "digital-economy",
    aggregationRole: "related",
    netAmountMain: 150_000_000,
    tradeDate: "2026-06-12",
  },
  {
    stockId: "aci-zjxc",
    securityCode: "300308.XSHE",
    stockName: "中际旭创",
    subThemeId: "optical-interconnect",
    themeId: "ai-computing",
    aggregationRole: "primary",
    netAmountMain: 80_000_000,
    tradeDate: "2026-06-12",
  },
];

const sumMap = (m: ReadonlyMap<string, number>): number =>
  [...m.values()].reduce((a, b) => a + b, 0);

describe("buildCapitalFlowAggregates", () => {
  it("counts related display mappings only once", () => {
    const aggregates = buildCapitalFlowAggregates(snapshotFixture);
    expect(aggregates.uniqueStockTotal).toBe(230_000_000);
    expect(sumMap(aggregates.bySubTheme)).toBe(230_000_000);
    expect(sumMap(aggregates.byTheme)).toBe(230_000_000);
  });

  it("keeps related mappings available for P3", () => {
    const aggregates = buildCapitalFlowAggregates(snapshotFixture);
    expect(aggregates.pointByStockId.has("aa-jsbg")).toBe(true);
    expect(aggregates.pointByStockId.has("cs-jsbg2")).toBe(true);
    expect(aggregates.pointByStockId.has("aci-zjxc")).toBe(true);
  });

  it("sub-theme totals exclude related mappings", () => {
    const aggregates = buildCapitalFlowAggregates(snapshotFixture);
    // cloud-software only has the related mapping → contributes 0 to totals
    expect(aggregates.bySubTheme.get("cloud-software") ?? 0).toBe(0);
    expect(aggregates.bySubTheme.get("ai-applications")).toBe(150_000_000);
    expect(aggregates.bySubTheme.get("optical-interconnect")).toBe(80_000_000);
  });

  it("theme totals reflect primary mappings only", () => {
    const aggregates = buildCapitalFlowAggregates(snapshotFixture);
    expect(aggregates.byTheme.get("ai-computing")).toBe(230_000_000);
    expect(aggregates.byTheme.get("digital-economy") ?? 0).toBe(0);
  });

  it("guards against duplicate primary security codes", () => {
    const dup: StockCapitalFlowPoint[] = [
      { ...snapshotFixture[0] },
      {
        stockId: "dup",
        securityCode: "688111.XSHG",
        stockName: "dup",
        subThemeId: "ai-applications",
        themeId: "ai-computing",
        aggregationRole: "primary",
        netAmountMain: 1,
        tradeDate: "2026-06-12",
      },
    ];
    expect(() => buildCapitalFlowAggregates(dup)).toThrow(/primary/i);
  });

  it("handles an empty point set", () => {
    const aggregates = buildCapitalFlowAggregates([]);
    expect(aggregates.uniqueStockTotal).toBe(0);
    expect(aggregates.bySubTheme.size).toBe(0);
    expect(aggregates.byTheme.size).toBe(0);
  });
});
