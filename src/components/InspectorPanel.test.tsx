import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAlgorithmicLayoutProvider } from "../domain/layoutProvider";
import { buildRenderNodes } from "../domain/renderNodes";
import { createScenarioDataProvider } from "../domain/scenarioDataProvider";
import { InspectorPanel } from "./InspectorPanel";

const nodes = buildRenderNodes({
  layout: createAlgorithmicLayoutProvider().getLayout("ai-semiconductor-resonance"),
  scenario: createScenarioDataProvider().getScenarios()[0],
  themeFilter: "all",
  capitalStateFilter: "all",
  showCentersOnly: false
});

it("shows the daily overview when no sector is selected", () => {
  const overview = {
    totalNetInflow: 5_0000_0000,
    topInflow: [{ id: "ai-computing", name: "AI算力", value: 3_0000_0000 }],
    topOutflow: [{ id: "fintech", name: "金融科技", value: -1_0000_0000 }],
  };
  render(<InspectorPanel overview={overview} overviewTitle="主线概览" />);
  expect(screen.getByText("主线概览")).toBeInTheDocument();
  expect(screen.getByText("AI算力")).toBeInTheDocument();
  expect(screen.getByText("金融科技")).toBeInTheDocument();
});

describe("InspectorPanel", () => {
  it("renders selected sector details", () => {
    const node = nodes.find((candidate) => candidate.sector.id === "ai-computing");
    render(<InspectorPanel node={node} />);

    expect(screen.getByText("主线：AI算力")).toBeInTheDocument();
    expect(screen.getByText("AI算力")).toBeInTheDocument();
    expect(screen.getByText("流入")).toBeInTheDocument();
    expect(screen.getByText(node?.metric.labelValue ?? "")).toBeInTheDocument();
    expect(screen.getByText("AI主线核心，承接大模型训练和推理需求。")).toBeInTheDocument();
    expect(screen.getByText("布局解释")).toBeInTheDocument();
    expect(screen.getByText("AI数据中心高速互联")).toBeInTheDocument();
  });

  it("renders an empty state without a selection", () => {
    render(<InspectorPanel node={undefined} />);
    expect(screen.getByText("点击地图上的板块查看详情")).toBeInTheDocument();
    expect(screen.queryByText(/第三版/)).toBeNull();
    expect(screen.queryByText(/模拟/)).toBeNull();
  });
});

import { buildSelectionDetail } from "../domain/selectionDetail";

const selData = {
  themes: [{ id: "ai", name: "AI算力", shortName: "AI", color: "#fff" }] as any,
  subThemes: [{ id: "chips", themeId: "ai", name: "AI芯片", shortName: "芯片" }] as any,
  byTheme: new Map([["ai", 5e8]]),
  bySubTheme: new Map([["chips", 2e8]]),
};

describe("InspectorPanel live selection detail", () => {
  it("labels real data 主力净流入 (not 模拟) and shows parent + name", () => {
    const sel = buildSelectionDetail("chips", "P2", selData)!;
    render(<InspectorPanel selection={sel} isDemo={false} />);
    expect(screen.getByText("主力净流入")).toBeInTheDocument();
    expect(screen.queryByText("模拟净流入")).toBeNull();
    expect(screen.getByText("主线：AI算力")).toBeInTheDocument();
    expect(screen.getByText("AI芯片")).toBeInTheDocument();
  });
  it("labels demo data 模拟净流入", () => {
    const sel = buildSelectionDetail("ai", "P1", selData)!;
    render(<InspectorPanel selection={sel} isDemo={true} />);
    expect(screen.getByText("模拟净流入")).toBeInTheDocument();
  });
});
