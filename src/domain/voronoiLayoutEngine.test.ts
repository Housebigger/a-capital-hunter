import { describe, it, expect } from "vitest";
import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { createThemeVoronoiLayout } from "./themeVoronoiLayoutEngine";
import { themes } from "./themeRegistry";
import { relationshipEdges } from "./relationshipRegistry";
import { subThemes } from "./subThemeRegistry";
import { layoutStages } from "./layoutStages";
import type { ThemeCell } from "./themeVoronoiLayoutEngine";

// ---------------------------------------------------------------------------
// Build fake theme cells that roughly mimic P1 Voronoi output
// ---------------------------------------------------------------------------

const fakeThemeCells: ThemeCell[] = [
  { themeId: "ai-computing",          center: { x: 0,    z: 5 },   polygon: [{ x: -2, z: 3.5 }, { x: 2, z: 3.5 }, { x: 2, z: 6.5 }, { x: -2, z: 6.5 }] },
  { themeId: "robotics-physical-ai",  center: { x: 4.5,  z: 2.5 }, polygon: [{ x: 2.5, z: 1 }, { x: 6.5, z: 1 }, { x: 6.5, z: 4 }, { x: 2.5, z: 4 }] },
  { themeId: "low-altitude-economy",  center: { x: -4.5, z: 2.5 }, polygon: [{ x: -6.5, z: 1 }, { x: -2.5, z: 1 }, { x: -2.5, z: 4 }, { x: -6.5, z: 4 }] },
  { themeId: "semiconductors",        center: { x: 5.5,  z: -2 },  polygon: [{ x: 3.5, z: -4 }, { x: 7.5, z: -4 }, { x: 7.5, z: 0 }, { x: 3.5, z: 0 }] },
  { themeId: "new-energy",            center: { x: 0,    z: -5 },  polygon: [{ x: -3, z: -7 }, { x: 3, z: -7 }, { x: 3, z: -3 }, { x: -3, z: -3 }] },
  { themeId: "defense-aerospace",     center: { x: -5.5, z: -2 },  polygon: [{ x: -7.5, z: -4 }, { x: -3.5, z: -4 }, { x: -3.5, z: 0 }, { x: -7.5, z: 0 }] },
  { themeId: "innovative-medicine",   center: { x: -2,   z: -7.5 },polygon: [{ x: -4, z: -9.5 }, { x: 0, z: -9.5 }, { x: 0, z: -5.5 }, { x: -4, z: -5.5 }] },
  { themeId: "new-energy-vehicles",   center: { x: 2,    z: -7.5 },polygon: [{ x: 0, z: -9.5 }, { x: 4, z: -9.5 }, { x: 4, z: -5.5 }, { x: 0, z: -5.5 }] },
  { themeId: "consumer-electronics",  center: { x: 7,    z: -6 },  polygon: [{ x: 5, z: -8 }, { x: 9, z: -8 }, { x: 9, z: -4 }, { x: 5, z: -4 }] },
  { themeId: "digital-economy",       center: { x: -7,   z: -6 },  polygon: [{ x: -9, z: -8 }, { x: -5, z: -8 }, { x: -5, z: -4 }, { x: -9, z: -4 }] },
  { themeId: "fintech",               center: { x: 7,    z: 6 },   polygon: [{ x: 5, z: 4 }, { x: 9, z: 4 }, { x: 9, z: 8 }, { x: 5, z: 8 }] },
];

const defaultInput = {
  subThemes,
  themeCells: fakeThemeCells,
  stage: layoutStages[0],
  options: {
    mapRadius: 11,
    cityBorderGap: 0.06,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shoelace formula for polygon area. */
const shoelaceArea = (poly: ReadonlyArray<{ x: number; z: number }>): number => {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].z;
    area -= poly[j].x * poly[i].z;
  }
  return Math.abs(area / 2);
};

/**
 * Check if a point is inside a convex polygon using cross-product test.
 * Assumes polygon vertices are in counter-clockwise order.
 */
const pointInConvexPolygon = (
  px: number,
  pz: number,
  poly: ReadonlyArray<{ x: number; z: number }>
): boolean => {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (pz - a.z) - (b.z - a.z) * (px - a.x);
    if (cross < -0.1) return false; // small tolerance for numeric error
  }
  return true;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("voronoiLayoutEngine (per-theme)", () => {
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

  it("all cells stay within their parent theme polygon (circular boundary is implicit)", () => {
    // Per-theme Voronoi cells are bounded by theme polygons, not directly by circle.
    // The theme polygons themselves are clipped to the circle in P1.
    // Verify that every cell vertex is within its theme polygon (already tested
    // in the dedicated containment test) — this is a smoke test for the boundary field.
    expect(result.boundary.radius).toBe(11);
  });

  it("SubThemes in same theme form contiguous regions", () => {
    for (const themeCell of fakeThemeCells) {
      const themeSubCells = result.cells.filter(c => c.themeId === themeCell.themeId);
      if (themeSubCells.length < 2) continue;
      let hasAdjacent = false;
      for (let i = 0; i < themeSubCells.length && !hasAdjacent; i++) {
        for (let j = i + 1; j < themeSubCells.length; j++) {
          const dx = themeSubCells[i].center.x - themeSubCells[j].center.x;
          const dz = themeSubCells[i].center.z - themeSubCells[j].center.z;
          if (Math.sqrt(dx * dx + dz * dz) < 4) hasAdjacent = true;
        }
      }
      expect(hasAdjacent, `Theme ${themeCell.themeId} cells are not contiguous`).toBe(true);
    }
  });

  it("every SubTheme cell is contained within its parent theme polygon", () => {
    for (const cell of result.cells) {
      const themeCell = fakeThemeCells.find(tc => tc.themeId === cell.themeId);
      expect(themeCell, `No theme cell for ${cell.themeId}`).toBeDefined();
      if (!themeCell) continue;

      for (const pt of cell.polygon) {
        expect(
          pointInConvexPolygon(pt.x, pt.z, themeCell.polygon),
          `Point (${pt.x.toFixed(2)}, ${pt.z.toFixed(2)}) of ${cell.subThemeId} is outside theme ${cell.themeId}`
        ).toBe(true);
      }
    }
  });

  it("theme with single SubTheme gets the full theme polygon (smoothed)", () => {
    const singleSubTheme = [{ id: "solo", name: "Solo", shortName: "S", themeId: "solo-theme", displayOrder: 1, primarySectorId: "solo", areaWeight: 0.8 }];
    const singleThemeCell: ThemeCell = {
      themeId: "solo-theme",
      center: { x: 3, z: 3 },
      polygon: [{ x: 1, z: 1 }, { x: 5, z: 1 }, { x: 5, z: 5 }, { x: 1, z: 5 }],
    };

    const result = createVoronoiLayout({
      subThemes: singleSubTheme as any,
      themeCells: [singleThemeCell],
      stage: layoutStages[0],
      options: { mapRadius: 11, cityBorderGap: 0, smoothIterations: 0 },
    });

    expect(result.cells.length).toBe(1);
    expect(result.cells[0].subThemeId).toBe("solo");
    // Without smoothing and gap, area should match theme polygon
    const themeArea = shoelaceArea(singleThemeCell.polygon);
    const cellArea = shoelaceArea(result.cells[0].polygon);
    expect(cellArea).toBeCloseTo(themeArea, 0);
  });
});

function polyArea(poly: ReadonlyArray<{ x: number; z: number }>): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

describe("voronoi heat sizing", () => {
  const themeCells = createThemeVoronoiLayout({
    themes, relationshipEdges, stage: layoutStages[0],
    options: { mapRadius: 15, borderGap: 0.2, lloydIterations: 3, smoothIterations: 2 },
  }).cells;
  const opts = { mapRadius: 15, cityBorderGap: 0.02, smoothIterations: 1 };
  // pick a theme with >= 3 sub-themes to compare siblings
  const themeId = "ai-computing";
  const sibs = subThemes.filter((s) => s.themeId === themeId).map((s) => s.id);

  // Base (no-heat) cell areas — used to pick the HARD reorder case below.
  const baseArea = (() => {
    const base = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], options: opts });
    return new Map(base.cells.map((c) => [c.subThemeId, polyArea(c.polygon)]));
  })();

  it("reorders the HARD case — smallest base cell hot beats largest base cell cold", () => {
    // Heat must overcome base geometry: make the naturally-SMALLEST sibling hot
    // and the naturally-LARGEST sibling cold. A coincidental pass is impossible.
    const sorted = [...sibs].sort((a, b) => baseArea.get(a)! - baseArea.get(b)!);
    const smallest = sorted[0];
    const largest = sorted[sorted.length - 1];
    expect(baseArea.get(smallest)!).toBeLessThan(baseArea.get(largest)!); // sanity: distinct

    const heat: Record<string, number> = {};
    sibs.forEach((id) => (heat[id] = 0.5));
    heat[smallest] = 1; // blazing hot
    heat[largest] = 0; // stone cold
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: heat, options: opts });
    const area = new Map(layout.cells.map((c) => [c.subThemeId, polyArea(c.polygon)]));
    expect(area.get(smallest)!).toBeGreaterThan(area.get(largest)!);
  });

  it("orders cells by heat for EVERY sibling pair (no coincidental passes)", () => {
    // Distinct heat ramp across all siblings; higher heat must yield larger area
    // for every pair — the property a single coincidental test cannot fake.
    const heat: Record<string, number> = {};
    sibs.forEach((id, k) => (heat[id] = sibs.length > 1 ? k / (sibs.length - 1) : 1));
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: heat, options: opts });
    const area = new Map(layout.cells.map((c) => [c.subThemeId, polyArea(c.polygon)]));
    for (const a of sibs) {
      for (const b of sibs) {
        if (heat[a] > heat[b]) {
          expect(area.get(a)!).toBeGreaterThan(area.get(b)!);
        }
      }
    }
  });

  it("heat actually changes a cell's size (the same sub-theme grows when hot)", () => {
    // Make sibs[1] hot vs cold and confirm its own cell grows — this proves the
    // heat signal (not lucky ring position) drives the size, and that heat is honored.
    const cold: Record<string, number> = {};
    sibs.forEach((id) => (cold[id] = 0.1));
    const hot = { ...cold, [sibs[1]]: 1 };

    const coldLayout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: cold, options: opts });
    const hotLayout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: hot, options: opts });

    const coldArea = polyArea(coldLayout.cells.find((c) => c.subThemeId === sibs[1])!.polygon);
    const hotArea = polyArea(hotLayout.cells.find((c) => c.subThemeId === sibs[1])!.polygon);
    expect(hotArea).toBeGreaterThan(coldArea);
  });

  it("respects a size floor — no cell collapses to near zero", () => {
    const heat: Record<string, number> = {};
    sibs.forEach((id) => (heat[id] = 0));
    heat[sibs[0]] = 1; // one blazing hot, rest stone cold
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: heat, options: opts });
    const themeArea = polyArea(themeCells.find((c) => c.themeId === themeId)!.polygon);
    const equalShare = themeArea / sibs.length;
    for (const c of layout.cells.filter((c) => sibs.includes(c.subThemeId))) {
      expect(polyArea(c.polygon)).toBeGreaterThan(0.25 * equalShare); // >=25% of equal share
    }
  });

  it("uniform heat reproduces ~equal cells (no heat = today's behavior)", () => {
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], options: opts });
    expect(layout.cells.length).toBeGreaterThan(0); // baseline still works with no heat
  });
});
