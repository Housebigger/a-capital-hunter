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
    expect(screen.getByText("点击板块查看资金状态")).toBeInTheDocument();
    expect(screen.getByText("第二版展示资金方向、模拟净流入和算法布局解释。")).toBeInTheDocument();
  });
});
