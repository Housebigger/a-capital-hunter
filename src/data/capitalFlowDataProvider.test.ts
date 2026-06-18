import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCapitalFlowDataProvider } from "./capitalFlowDataProvider";
import type { CapitalFlowSnapshot } from "./capitalFlowSnapshot";

const mockFetch = vi.fn();

const snapshotFixture: CapitalFlowSnapshot = {
  tradeDate: "2026-06-12",
  fetchedAt: "2026-06-12T16:00:00Z",
  source: "jqdata",
  metric: "net_amount_main",
  unit: "CNY",
  status: "ready",
  coverage: { requested: 10, succeeded: 9, failed: 1 },
  points: [
    {
      stockId: "aci-zjxc",
      securityCode: "300308.XSHE",
      stockName: "中际旭创",
      subThemeId: "optical-interconnect",
      themeId: "ai-computing",
      aggregationRole: "primary",
      netAmountMain: 12_345_600,
      tradeDate: "2026-06-12",
    },
  ],
  failures: [{ securityCode: "000001.XSHE", reason: "missing_source_row" }],
  window: { days: 1, label: "今日", from: "2026-06-12", to: "2026-06-12", availableDays: 1 },
};

const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const errorJson = (status: number, code: string) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ error: { code, message: "boom" } }),
});

describe("createCapitalFlowDataProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).fetch = mockFetch;
  });

  it("loads a validated latest snapshot", async () => {
    mockFetch.mockResolvedValueOnce(okJson(snapshotFixture));
    const result = await createCapitalFlowDataProvider().fetchLatest();
    expect(result.tradeDate).toBe("2026-06-12");
    expect(result.source).toBe("jqdata");
    expect(result.points[0].aggregationRole).toBe("primary");
    expect(result.points[0].netAmountMain).toBe(12_345_600);
  });

  it("throws instead of falling back to demo data", async () => {
    mockFetch.mockResolvedValueOnce(errorJson(503, "snapshot_unavailable"));
    await expect(createCapitalFlowDataProvider().fetchLatest()).rejects.toThrow(
      "snapshot_unavailable"
    );
  });

  it("rejects malformed success payloads", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({ source: "jqdata", points: [] })
    );
    await expect(createCapitalFlowDataProvider().fetchLatest()).rejects.toThrow(
      "Invalid capital flow snapshot"
    );
  });

  it("rejects non-finite money values", async () => {
    const bad = {
      ...snapshotFixture,
      points: [
        { ...snapshotFixture.points[0], netAmountMain: Number.NaN },
      ],
    };
    mockFetch.mockResolvedValueOnce(okJson(bad));
    await expect(createCapitalFlowDataProvider().fetchLatest()).rejects.toThrow(
      "Invalid capital flow snapshot"
    );
  });

  it("fetchDate targets the by-date endpoint", async () => {
    mockFetch.mockResolvedValueOnce(okJson(snapshotFixture));
    const result = await createCapitalFlowDataProvider().fetchDate("2026-06-11");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/capital-flow/snapshot?trade_date=2026-06-11",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.tradeDate).toBe("2026-06-12");
  });

  it("fetchStatus parses available trade dates", async () => {
    const statusBody = {
      databaseAvailable: true,
      latestTradeDate: "2026-06-12",
      latestStatus: "ready",
      source: "jqdata",
      metric: "net_amount_main",
      availableTradeDates: ["2026-06-12", "2026-06-11"],
    };
    mockFetch.mockResolvedValueOnce(okJson(statusBody));
    const status = await createCapitalFlowDataProvider().fetchStatus();
    expect(status.availableTradeDates).toEqual(["2026-06-12", "2026-06-11"]);
    expect(status.latestStatus).toBe("ready");
  });

  it("aborts via AbortController on timeout", async () => {
    // A fetch that never resolves; we can't easily test real timeout, but we
    // can verify the provider passes a signal and propagates abort errors.
    mockFetch.mockImplementationOnce((_url: string, init: RequestInit) =>
      Promise.reject(
        Object.assign(new Error("aborted"), { name: "AbortError" })
      ).catch((e) => {
        // simulate DOMException abort
        throw e;
      })
    );
    await expect(createCapitalFlowDataProvider().fetchLatest()).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("fetchLatest sends the window query param", async () => {
    mockFetch.mockResolvedValueOnce(okJson(snapshotFixture));
    const provider = createCapitalFlowDataProvider();
    await provider.fetchLatest("5d");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("window=5d"),
      expect.any(Object)
    );
  });
});
