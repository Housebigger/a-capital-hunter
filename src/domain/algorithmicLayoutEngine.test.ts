import { describe, expect, it } from "vitest";
import { createAlgorithmicLayout } from "./algorithmicLayoutEngine";
import { layoutStages } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { sectors, themes } from "./themeRegistry";
import { subThemes } from "./subThemeRegistry";

const baseOptions = {
  gridWidth: 22,
  gridHeight: 16,
  maxStageShift: 1.6,
  centerPullStrength: 1.2,
  baseRadius: 6.8,
  subThemeDistance: 1.5,
  relationPullFactor: 0.15
};

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
    options: baseOptions,
    subThemes
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
    expect(Math.abs(robotics.x) + Math.abs(robotics.z)).toBeLessThanOrEqual(6);
  });

  it("generates explanations for every sector", () => {
    const result = runLayout();
    expect(Object.keys(result.explanations)).toHaveLength(sectors.length);
    expect(result.explanations["ai-computing"].reasons.length).toBeGreaterThanOrEqual(3);
    expect(result.explanations["optical-modules"].reasons[0].relatedSectorId).toBe("ai-computing");
  });

  it("includes SubTheme info in explanation summaries", () => {
    const result = runLayout();
    const aiComputingExplain = result.explanations["ai-computing"];
    expect(aiComputingExplain.summary).toContain("ai-computing-infra");
  });

  it("places SubTheme members closer to each other than to sectors from other SubThemes", () => {
    const result = runLayout();
    const byId = new Map(result.layout.cells.map((cell) => [cell.sectorId, cell]));
    const distance = (a: string, b: string) => {
      const first = byId.get(a)!;
      const second = byId.get(b)!;
      return Math.abs(first.x - second.x) + Math.abs(first.z - second.z);
    };

    // Both optical-modules and cpo are in "ai-computing-infra" SubTheme
    // traditional-chinese-medicine is in "traditional-medicine" SubTheme
    const infraPairDist = distance("optical-modules", "cpo");
    const crossSubThemeDist = distance("optical-modules", "traditional-chinese-medicine");

    expect(infraPairDist).toBeLessThan(crossSubThemeDist);
  });

  it("uses larger grid to accommodate all 81 sectors", () => {
    const result = runLayout();
    const halfWidth = 11;
    const halfHeight = 8;

    for (const cell of result.layout.cells) {
      expect(Math.abs(cell.x)).toBeLessThanOrEqual(halfWidth);
      expect(Math.abs(cell.z)).toBeLessThanOrEqual(halfHeight);
    }
  });
});
