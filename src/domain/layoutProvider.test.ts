import { describe, expect, it } from "vitest";
import { createAlgorithmicLayoutProvider, createManualLayoutProvider } from "./layoutProvider";
import { sectors } from "./themeRegistry";

describe("createManualLayoutProvider", () => {
  it("returns the manual v1 comparison layout metadata", () => {
    const layout = createManualLayoutProvider().getLayout();
    expect(layout.version).toBe("manual-v1");
    expect(layout.stageId).toBe("manual");
    expect(layout.cells).toHaveLength(18);
  });

  it("keeps layout sector ids unique", () => {
    const layout = createManualLayoutProvider().getLayout();
    const sectorIds = layout.cells.map((cell) => cell.sectorId);
    expect(new Set(sectorIds).size).toBe(sectorIds.length);
  });

  it("matches theme-center layout roles to sector config", () => {
    const layout = createManualLayoutProvider().getLayout();
    const sectorById = new Map(sectors.map((sector) => [sector.id, sector]));

    for (const cell of layout.cells) {
      expect(cell.role === "theme-center").toBe(sectorById.get(cell.sectorId)?.isThemeCenter);
    }
  });

  it("returns fresh layout objects so consumers cannot mutate shared config", () => {
    const provider = createManualLayoutProvider();
    const firstLayout = provider.getLayout();
    const originalX = firstLayout.cells[0].x;

    firstLayout.cells[0].x = 999;

    const nextLayout = provider.getLayout();
    expect(nextLayout).not.toBe(firstLayout);
    expect(nextLayout.cells).not.toBe(firstLayout.cells);
    expect(nextLayout.cells[0]).not.toBe(firstLayout.cells[0]);
    expect(nextLayout.cells[0].x).toBe(originalX);
  });

  it("places each theme center in the center of its local cluster", () => {
    const layout = createManualLayoutProvider().getLayout();
    const centers = layout.cells.filter((cell) => cell.role === "theme-center");
    expect(centers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectorId: "ai-computing", x: -5, z: 0 }),
        expect.objectContaining({ sectorId: "robotics-physical-ai", x: 0, z: 0 }),
        expect.objectContaining({ sectorId: "low-altitude-economy", x: 5, z: 0 })
      ])
    );
  });
});

describe("createAlgorithmicLayoutProvider", () => {
  it("creates an algorithmic layout provider with stage metadata", () => {
    const provider = createAlgorithmicLayoutProvider();
    const layout = provider.getLayout("robotics-low-altitude-diffusion");

    expect(layout.stageId).toBe("robotics-low-altitude-diffusion");
    expect(layout.version).toBe("algorithmic-robotics-low-altitude-diffusion");
    expect(layout.cells).toHaveLength(sectors.length);
    expect(layout.explanations?.["robotics-physical-ai"].reasons.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to the first layout stage when no stage id is passed", () => {
    const provider = createAlgorithmicLayoutProvider();

    expect(provider.getLayout().stageId).toBe("ai-semiconductor-resonance");
  });
});
