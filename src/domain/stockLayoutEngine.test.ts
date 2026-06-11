import type { VoronoiCell, Stock } from "./types";
import type { Point2D } from "./polygonClip";
import { placeStocksInCell } from "./stockLayoutEngine";

// ---------------------------------------------------------------------------
// Helper: point-in-convex-polygon (mirrors the one in stockLayoutEngine)
// ---------------------------------------------------------------------------

function pointInConvexPolygon(
  point: Point2D,
  poly: ReadonlyArray<Point2D>
): boolean {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const cross =
      (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    if (cross < 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const testCell: VoronoiCell = {
  subThemeId: "test-sub",
  center: { x: 0, z: 0 },
  polygon: [
    { x: -2, z: -2 },
    { x: 2, z: -2 },
    { x: 2, z: 2 },
    { x: -2, z: 2 },
  ],
  themeId: "test-theme",
};

function makeStock(id: string): Stock {
  return {
    id,
    name: `Stock ${id}`,
    shortName: `S${id}`,
    subThemeId: "test-sub",
    code: "000000",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("placeStocksInCell", () => {
  it("returns empty array for 0 stocks", () => {
    const result = placeStocksInCell(testCell, []);
    expect(result).toEqual([]);
  });

  it("places 1 stock at cell center", () => {
    const stocks = [makeStock("s1")];
    const result = placeStocksInCell(testCell, stocks);
    expect(result).toHaveLength(1);
    expect(result[0].stockId).toBe("s1");
    expect(result[0].x).toBeCloseTo(0, 5);
    expect(result[0].z).toBeCloseTo(0, 5);
  });

  it("places 2 stocks symmetrically around center", () => {
    const stocks = [makeStock("s1"), makeStock("s2")];
    const result = placeStocksInCell(testCell, stocks);

    expect(result).toHaveLength(2);
    expect(result[0].stockId).toBe("s1");
    expect(result[1].stockId).toBe("s2");

    // Should be symmetric about center (0,0)
    expect(result[0].x).toBeCloseTo(-result[1].x, 5);
    expect(result[0].z).toBeCloseTo(result[1].z, 5);

    // One should be positive x, other negative x
    expect(result[0].x).toBeGreaterThan(0);
    expect(result[1].x).toBeLessThan(0);
  });

  it("places 5 stocks: first at center, rest in ring", () => {
    const stocks = [makeStock("s1"), makeStock("s2"), makeStock("s3"), makeStock("s4"), makeStock("s5")];
    const result = placeStocksInCell(testCell, stocks);

    expect(result).toHaveLength(5);
    expect(result[0].stockId).toBe("s1");

    // First stock at center
    expect(result[0].x).toBeCloseTo(0, 5);
    expect(result[0].z).toBeCloseTo(0, 5);

    // Ring stocks should not all be at center
    const ringPositions = result.slice(1);
    const hasSpread = ringPositions.some(
      (p) => Math.abs(p.x) > 0.01 || Math.abs(p.z) > 0.01
    );
    expect(hasSpread).toBe(true);
  });

  it("clamps all positions inside the cell polygon", () => {
    // Use a smaller polygon to increase chance of needing clamping
    const smallCell: VoronoiCell = {
      subThemeId: "test-sub",
      center: { x: 0, z: 0 },
      polygon: [
        { x: -0.5, z: -0.5 },
        { x: 0.5, z: -0.5 },
        { x: 0.5, z: 0.5 },
        { x: -0.5, z: 0.5 },
      ],
      themeId: "test-theme",
    };

    const stocks = Array.from({ length: 7 }, (_, i) => makeStock(`s${i + 1}`));
    const result = placeStocksInCell(smallCell, stocks);

    for (const pos of result) {
      expect(pointInConvexPolygon(pos, smallCell.polygon)).toBe(true);
    }
  });

  it("is deterministic: same input produces same output", () => {
    const stocks = [makeStock("s1"), makeStock("s2"), makeStock("s3")];
    const result1 = placeStocksInCell(testCell, stocks);
    const result2 = placeStocksInCell(testCell, stocks);

    expect(result1).toEqual(result2);
  });
});
