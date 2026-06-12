import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAkShareDataProvider, PERIOD_OPTIONS } from "./akShareDataProvider";

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
          indicator: "今日",
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
    expect(first.id).toBe("rank-今日");
    expect(first.points[0].sectorId).toBe("optical-modules");
    expect(first.points[0].netInflow).toBe(45.2);
  });

  it("falls back when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const provider = createAkShareDataProvider();
    await flushMicrotasks();

    const scenarios = provider.getScenarios();
    expect(scenarios[0].id.startsWith("S")).toBe(true);
  });

  it("fetchPeriod fetches and caches a specific indicator", async () => {
    // First call is auto-fetch for 今日
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ indicator: "今日", points: [] }),
    });
    // Second call is for 5日
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          indicator: "5日",
          source: "eastmoney",
          points: [
            { sectorId: "semiconductors", sectorName: "半导体", netInflow: 120, pctChange: 2.8 },
          ],
        }),
    });

    const provider = createAkShareDataProvider();
    const scenario = await provider.fetchPeriod("5日");

    expect(scenario.id).toBe("rank-5日");
    expect(scenario.points[0].sectorId).toBe("semiconductors");

    // Should be cached now
    const cached = provider.getCachedPeriod("5日");
    expect(cached).not.toBeNull();
    expect(cached!.id).toBe("rank-5日");
  });

  it("PERIOD_OPTIONS has 3 entries", () => {
    expect(PERIOD_OPTIONS.length).toBe(3);
    expect(PERIOD_OPTIONS[0].indicator).toBe("今日");
    expect(PERIOD_OPTIONS[2].indicator).toBe("10日");
  });

  it("isAvailable returns true for healthy backend", async () => {
    // Auto-fetch for 今日
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ fallback: true }),
    });
    // Health check
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const provider = createAkShareDataProvider();
    const result = await provider.isAvailable();
    expect(result).toBe(true);
  });
});
