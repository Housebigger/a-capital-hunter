import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DataStatus } from "./DataStatus";
import type { CapitalFlowSnapshot } from "../data/capitalFlowSnapshot";

const readySnapshot: CapitalFlowSnapshot = {
  tradeDate: "2026-06-12",
  fetchedAt: "2026-06-12T16:00:00Z",
  source: "jqdata",
  metric: "net_amount_main",
  unit: "CNY",
  status: "ready",
  coverage: { requested: 10, succeeded: 9, failed: 1 },
  points: [],
  failures: [],
};

describe("DataStatus", () => {
  it("renders source, date, metric and coverage for a ready snapshot", () => {
    render(
      <DataStatus
        snapshot={readySnapshot}
        isDemo={false}
        onRetry={vi.fn()}
        onLoadDemo={vi.fn()}
      />
    );
    expect(screen.getByText("数据截至 2026-06-12")).toBeInTheDocument();
    expect(screen.getByText(/JQData · 主力净流入/)).toBeInTheDocument();
    expect(screen.getByText(/覆盖 9 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText(/90\.0%/)).toBeInTheDocument();
  });

  it("warns about partial coverage without hiding data", () => {
    render(
      <DataStatus
        snapshot={{ ...readySnapshot, status: "partial", coverage: { requested: 10, succeeded: 8, failed: 2 } }}
        isDemo={false}
        onRetry={vi.fn()}
        onLoadDemo={vi.fn()}
      />
    );
    expect(screen.getByText(/部分股票缺少真实数据/)).toBeInTheDocument();
  });

  it("labels demo mode explicitly when showing simulated data", () => {
    render(
      <DataStatus snapshot={null} isDemo onRetry={vi.fn()} onLoadDemo={vi.fn()} />
    );
    expect(screen.getByText(/演示数据/)).toBeInTheDocument();
  });

  it("shows a hard error with retry and demo buttons when no snapshot", () => {
    const onRetry = vi.fn();
    const onLoadDemo = vi.fn();
    render(
      <DataStatus snapshot={null} isDemo={false} onRetry={onRetry} onLoadDemo={onLoadDemo} />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/没有可用的真实资金流快照/);
    expect(screen.getByRole("button", { name: /重试/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /加载演示数据/ })).toBeInTheDocument();
  });
});
