import { describe, expect, it } from "vitest";
import { createAlgorithmicLayout } from "./algorithmicLayoutEngine";
import { layoutStages } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { sectors, themes } from "./themeRegistry";

const runLayout = (stageId = "ai-semiconductor-resonance") =>
  createAlgorithmicLayout({
    themes,
    sectors,
    relationshipEdges,
    stage: layoutStages.find((stage) => stage.id === stageId)!,
    previousStage:
      stageId === "ai-semiconductor-resonance"
        ? undefined
        : layoutStages.find((stage) => stage.id === "ai-semiconductor-resonance"),
    options: {
      gridWidth: 15,
      gridHeight: 11,
      maxStageShift: 1.6,
      centerPullStrength: 1.2
    }
  });

describe("createAlgorithmicLayout", () => {
  it("is deterministic", () => {
    expect(runLayout().layout.cells).toEqual(runLayout().layout.cells);
  });

  it("assigns exactly one non-overlapping grid cell per sector", () => {
    const result = runLayout();
    const keys = result.layout.cells.map((cell) => `${cell.x},${cell.z}`);

    expect(result.layout.cells).toHaveLength(sectors.length);
    expect(new Set(result.layout.cells.map((cell) => cell.sectorId)).size).toBe(sectors.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("places strongly related sectors closer than unrelated sectors", () => {
    const result = runLayout();
    const byId = new Map(result.layout.cells.map((cell) => [cell.sectorId, cell]));
    const distance = (a: string, b: string) => {
      const first = byId.get(a)!;
      const second = byId.get(b)!;
      return Math.abs(first.x - second.x) + Math.abs(first.z - second.z);
    };

    expect(distance("ai-computing", "optical-modules")).toBeLessThan(
      distance("ai-computing", "traditional-chinese-medicine")
    );
  });

  it("moves hot themes closer to center across stages with previous positions", () => {
    const result = runLayout("robotics-low-altitude-diffusion");
    const robotics = result.layout.cells.find((cell) => cell.sectorId === "robotics-physical-ai")!;

    expect(robotics.previousPosition).toBeDefined();
    expect(Math.abs(robotics.x) + Math.abs(robotics.z)).toBeLessThanOrEqual(4);
  });

  it("generates explanations for every sector", () => {
    const result = runLayout();
    expect(Object.keys(result.explanations)).toHaveLength(sectors.length);
    expect(result.explanations["ai-computing"].reasons.length).toBeGreaterThanOrEqual(3);
    expect(result.explanations["optical-modules"].reasons[0].relatedSectorId).toBe("ai-computing");
  });
});
