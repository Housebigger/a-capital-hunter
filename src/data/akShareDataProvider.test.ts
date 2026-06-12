import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAkShareDataProvider } from "./akShareDataProvider";

const mockFetch = vi.fn();

describe("createAkShareDataProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).fetch = mockFetch;
  });

  const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));

  it("returns realtime scenario from API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2026-06-12",
          source: "eastmoney",
          points: [
            { sectorId: "optical-modules", sectorName: "光模块", netInflow: 45.2, pctChange: 3.1 },
          ],
        }),
    });

    const provider = createAkShareDataProvider();
    await flushMicrotasks();

    const scenarios = provider.getScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    const first = scenarios[0];
    expect(first.id).toBe("realtime-2026-06-12");
    expect(first.label).toBe("实时 2026-06-12");
    expect(first.story).toBe("东方财富行业板块主力资金实时净流入");
    expect(first.points.length).toBe(1);
    expect(first.points[0].sectorId).toBe("optical-modules");
    expect(first.points[0].netInflow).toBe(45.2);
  });

  it("falls back when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const provider = createAkShareDataProvider();
    await flushMicrotasks();

    const scenarios = provider.getScenarios();
    // Mock provider returns multiple scenarios (layout stages)
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    // Realtime scenario IDs start with "realtime-", mock IDs start with "S"
    expect(scenarios[0].id.startsWith("S")).toBe(true);
  });

  it("falls back when response has fallback flag", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ fallback: true }),
    });

    const provider = createAkShareDataProvider();
    await flushMicrotasks();

    const scenarios = provider.getScenarios();
    expect(scenarios[0].id.startsWith("S")).toBe(true);
  });

  it("maps API points to ScenarioPoint format", async () => {
    const apiPoints = [
      { sectorId: "semiconductors", sectorName: "半导体", netInflow: 120.5, pctChange: 2.8 },
      { sectorId: "banks", sectorName: "银行", netInflow: -30.1, pctChange: -0.5 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2026-06-12",
          source: "eastmoney",
          points: apiPoints,
        }),
    });

    const provider = createAkShareDataProvider();
    await flushMicrotasks();

    const scenarios = provider.getScenarios();
    const points = scenarios[0].points;
    expect(points).toEqual([
      { sectorId: "semiconductors", netInflow: 120.5 },
      { sectorId: "banks", netInflow: -30.1 },
    ]);
  });

  it("isAvailable returns true for healthy backend", async () => {
    // data fetch (first call)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ fallback: true }),
    });
    // health check (second call)
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const provider = createAkShareDataProvider();
    const result = await provider.isAvailable();
    expect(result).toBe(true);
  });
});
