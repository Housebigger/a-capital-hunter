import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "../domain/layoutProvider";
import { buildRenderNodes } from "../domain/renderNodes";
import { createMockScenarioDataProvider } from "../domain/scenarioDataProvider";
import { InspectorPanel } from "./InspectorPanel";

const nodes = buildRenderNodes({
  layout: createManualLayoutProvider().getLayout(),
  scenario: createMockScenarioDataProvider().getScenarios()[0],
  themeFilter: "all",
  capitalStateFilter: "all",
  showCentersOnly: false
});

describe("InspectorPanel", () => {
  it("renders selected sector details", () => {
    render(<InspectorPanel node={nodes.find((node) => node.sector.id === "ai-computing")} />);
    expect(screen.getByText("AI算力")).toBeInTheDocument();
    expect(screen.getByText("+160.0亿")).toBeInTheDocument();
    expect(screen.getByText("AI主线核心，承接大模型训练和推理需求。")).toBeInTheDocument();
  });

  it("renders an empty state without a selection", () => {
    render(<InspectorPanel node={undefined} />);
    expect(screen.getByText("点击板块查看资金状态")).toBeInTheDocument();
  });
});
