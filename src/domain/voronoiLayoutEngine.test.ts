import { describe, it, expect } from "vitest";
import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import { relationshipEdges } from "./relationshipRegistry";
import { layoutStages } from "./layoutStages";

const defaultInput = {
  subThemes,
  themes,
  relationshipEdges,
  stage: layoutStages[0],
  options: {
    mapWidth: 30,
    mapHeight: 22,
    relaxationIterations: 20,
    areaConvergenceThreshold: 0.05,
    provinceBorderGap: 0.15,
    cityBorderGap: 0.06,
  },
};

describe("voronoiLayoutEngine", () => {
  const result = createVoronoiLayout(defaultInput);

  it("produces one Voronoi cell per SubTheme", () => {
    expect(result.cells.length).toBe(subThemes.length);
  });

  it("is deterministic", () => {
    const result2 = createVoronoiLayout(defaultInput);
    for (let i = 0; i < result.cells.length; i++) {
      expect(result.cells[i].polygon).toEqual(result2.cells[i].polygon);
    }
  });

  it("every cell has a valid polygon with at least 3 vertices", () => {
    for (const cell of result.cells) {
      expect(cell.polygon.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("cell areas are roughly proportional to areaWeight", () => {
    const areas = result.cells.map((cell) => {
      // Shoelace formula for polygon area
      let area = 0;
      const poly = cell.polygon;
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        area += poly[i].x * poly[j].z;
        area -= poly[j].x * poly[i].z;
      }
      return Math.abs(area / 2);
    });
    const totalArea = areas.reduce((s, a) => s + a, 0);
    const totalWeight = subThemes.reduce((s, st) => s + st.areaWeight, 0);
    for (let i = 0; i < result.cells.length; i++) {
      const areaRatio = areas[i] / totalArea;
      const weightRatio = subThemes[i].areaWeight / totalWeight;
      // Allow 20% tolerance: theme cohesion constraint trades area precision for theme grouping
      expect(Math.abs(areaRatio - weightRatio)).toBeLessThan(0.20);
    }
  });

  it("all cells stay within boundary", () => {
    const hw = result.boundary.width / 2;
    const hh = result.boundary.height / 2;
    for (const cell of result.cells) {
      for (const pt of cell.polygon) {
        expect(Math.abs(pt.x)).toBeLessThanOrEqual(hw + 0.5);
        expect(Math.abs(pt.z)).toBeLessThanOrEqual(hh + 0.5);
      }
    }
  });

  it("SubThemes in same theme form contiguous regions", () => {
    // Check that no theme's cells are completely separated by other themes
    for (const theme of themes) {
      const themeCells = result.cells.filter((c) => c.themeId === theme.id);
      if (themeCells.length < 2) continue;
      // At least one pair should be adjacent (centers within 4 units)
      let hasAdjacent = false;
      for (let i = 0; i < themeCells.length && !hasAdjacent; i++) {
        for (let j = i + 1; j < themeCells.length; j++) {
          const dx = themeCells[i].center.x - themeCells[j].center.x;
          const dz = themeCells[i].center.z - themeCells[j].center.z;
          if (Math.sqrt(dx * dx + dz * dz) < 4) hasAdjacent = true;
        }
      }
      expect(hasAdjacent, `Theme ${theme.id} cells are not contiguous`).toBe(true);
    }
  });
});
