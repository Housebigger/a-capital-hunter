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
