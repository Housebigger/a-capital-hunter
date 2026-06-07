import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "./layoutProvider";
import { sectors } from "./themeRegistry";

describe("createManualLayoutProvider", () => {
  it("returns a layout cell for every sector", () => {
    const layout = createManualLayoutProvider().getLayout();
    expect(layout.cells).toHaveLength(sectors.length);
    expect(layout.cells.map((cell) => cell.sectorId).sort()).toEqual(
      sectors.map((sector) => sector.id).sort()
    );
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
