import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CapitalFlowSnapshot, CapitalFlowStatus } from "./data/capitalFlowSnapshot";
import type { CapitalFlowDataProvider } from "./data/capitalFlowDataProvider";
import App from "./App";

vi.mock("./components/HunterScene", () => ({
  HunterScene: () => <div data-testid="mock-hunter-scene" />
}));

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
  failures: [],
};

const statusFixture: CapitalFlowStatus = {
  databaseAvailable: true,
  latestTradeDate: "2026-06-12",
  latestStatus: "ready",
  source: "jqdata",
  metric: "net_amount_main",
  availableTradeDates: ["2026-06-12"],
};

function mockProvider(overrides: Partial<CapitalFlowDataProvider> = {}): CapitalFlowDataProvider {
  return {
    fetchLatest: vi.fn().mockResolvedValue(snapshotFixture),
    fetchDate: vi.fn().mockResolvedValue(snapshotFixture),
    fetchStatus: vi.fn().mockResolvedValue(statusFixture),
    ...overrides,
  };
}

// App reads the provider from a module-level setter so tests can inject one
// without touching the network. The default real provider is restored between
// tests via beforeEach in the App module's own setup.

describe("App data states", () => {
  function renderApp(provider: CapitalFlowDataProvider) {
    return render(<App provider={provider} />);
  }

  it("shows loading before the first snapshot resolves", () => {
    const provider = mockProvider({
      fetchLatest: vi.fn((): Promise<CapitalFlowSnapshot> => new Promise(() => {})), // never resolves
    });
    renderApp(provider);
    expect(screen.getByText(/正在读取本地资金流快照/)).toBeInTheDocument();
  });

  it("shows source date metric and coverage on a ready snapshot", async () => {
    renderApp(mockProvider());
    expect(await screen.findByText("数据截至 2026-06-12")).toBeInTheDocument();
    expect(screen.getByText(/JQData · 主力净流入/)).toBeInTheDocument();
    expect(screen.getByText(/覆盖 9 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText(/90\.0%/)).toBeInTheDocument();
  });

  it("shows partial coverage warning without hiding data", async () => {
    renderApp(
      mockProvider({
        fetchLatest: vi.fn().mockResolvedValue({
          ...snapshotFixture,
          status: "partial",
          coverage: { requested: 10, succeeded: 8, failed: 2 },
        }),
      })
    );
    expect(await screen.findByText(/部分股票缺少真实数据/)).toBeInTheDocument();
  });

  it("shows a hard error when no snapshot exists", async () => {
    renderApp(
      mockProvider({
        fetchLatest: vi.fn().mockRejectedValue(new Error("snapshot_not_found")),
      })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/没有可用的真实资金流快照/);
  });

  it("falls back to demo data on explicit button click", async () => {
    renderApp(
      mockProvider({
        fetchLatest: vi.fn().mockRejectedValue(new Error("snapshot_not_found")),
      })
    );
    const alert = await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: /加载演示数据/ }));
    // Demo mode renders the scene and labels itself as demo
    await waitFor(() => {
      expect(screen.getByTestId("mock-hunter-scene")).toBeInTheDocument();
    });
    expect(screen.getByText(/演示数据/)).toBeInTheDocument();
  });

  it("exposes the date select in the controls panel once data is loaded", async () => {
    renderApp(mockProvider());
    expect(await screen.findByText("数据截至 2026-06-12")).toBeInTheDocument();
    expect(screen.getByLabelText("资金流快照日期")).toBeInTheDocument();
  });

  it("header shows the snapshot's real data source label", async () => {
    const SAMPLE_TUSHARE: CapitalFlowSnapshot = {
      ...snapshotFixture,
      source: "tushare",
    };
    const provider: CapitalFlowDataProvider = {
      fetchStatus: async () => ({
        databaseAvailable: true,
        source: "tushare",
        metric: "net_amount_main",
        availableTradeDates: ["2026-06-12"],
        latestTradeDate: "2026-06-12",
        latestStatus: "ready",
      }),
      fetchLatest: async () => SAMPLE_TUSHARE,
      fetchDate: async () => SAMPLE_TUSHARE,
    };
    renderApp(provider);
    // The header <p> must say "Tushare 主力净流入 ·…", not the hardcoded "JQData"
    expect(await screen.findByText(/Tushare 主力净流入/)).toBeInTheDocument();
  });
});
