import { describe, it, expect } from "vitest";
import { createSubThemeLayoutProvider } from "./voronoiLayoutProvider";
import { subThemes } from "./subThemeRegistry";
import { layoutStages } from "./layoutStages";
import { createThemeLayoutProvider } from "./themeVoronoiLayoutProvider";

describe("voronoiLayoutProvider", () => {
  const subThemeProvider = createSubThemeLayoutProvider();
  const themeProvider = createThemeLayoutProvider();

  it("returns empty layout without themeCells", () => {
    const layout = subThemeProvider.getLayout(layoutStages[0].id);
    expect(layout.cells.length).toBe(0);
  });

  it("returns correct cell count when given themeCells", () => {
    const themeLayout = themeProvider.getLayout(layoutStages[0].id);
    const layout = subThemeProvider.getLayout(layoutStages[0].id, themeLayout.cells);
    expect(layout.cells.length).toBe(subThemes.length);
    expect(layout.boundary.radius).toBe(15);
  });

  it("is deterministic across calls", () => {
    const themeLayout = themeProvider.getLayout(layoutStages[0].id);
    const a = subThemeProvider.getLayout(layoutStages[0].id, themeLayout.cells);
    const b = subThemeProvider.getLayout(layoutStages[0].id, themeLayout.cells);
    expect(a.cells).toEqual(b.cells);
  });
});

describe("createSubThemeLayoutProvider heat plumbing", () => {
  it("accepts a subThemeHeat arg and still returns cells", () => {
    const themeCells = createThemeLayoutProvider().getLayout().cells;
    const layout = createSubThemeLayoutProvider().getLayout(undefined, themeCells, { "ai-optical-interconnect": 1 });
    expect(layout.cells.length).toBeGreaterThan(0);
  });
});
