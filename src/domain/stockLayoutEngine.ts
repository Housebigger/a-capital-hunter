/**
 * Stock Layout Engine — positions individual stocks within a SubTheme's
 * Voronoi cell polygon using center + ring placement.
 *
 * Pure function module with no React dependencies.
 */

import type { VoronoiCell, Stock } from "./types";
import type { Point2D } from "./polygonClip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StockPosition = {
  readonly stockId: string;
  readonly x: number;
  readonly z: number;
};

// ---------------------------------------------------------------------------
// Polygon area (shoelace formula)
// ---------------------------------------------------------------------------

function polygonArea(poly: ReadonlyArray<Point2D>): number {
  let area = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += poly[i].x * poly[j].z;
    area -= poly[j].x * poly[i].z;
  }
  return Math.abs(area) / 2;
}

// ---------------------------------------------------------------------------
// Point-in-convex-polygon test
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
    // Cross product of edge a->b with a->point
    const cross =
      (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    if (cross < 0) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Clamp point inside polygon via binary search toward center
// ---------------------------------------------------------------------------

function clampInside(
  point: Point2D,
  center: Point2D,
  poly: ReadonlyArray<Point2D>
): Point2D {
  if (pointInConvexPolygon(point, poly)) return point;

  let lo = 0;
  let hi = 1;
  // Binary search: interpolate between center (t=0) and point (t=1)
  for (let iter = 0; iter < 16; iter++) {
    const mid = (lo + hi) / 2;
    const testX = center.x + (point.x - center.x) * mid;
    const testZ = center.z + (point.z - center.z) * mid;
    if (pointInConvexPolygon({ x: testX, z: testZ }, poly)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const t = (lo + hi) / 2;
  return {
    x: center.x + (point.x - center.x) * t,
    z: center.z + (point.z - center.z) * t,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Place individual stocks within a Voronoi cell polygon.
 *
 * - 0 stocks  → empty array
 * - 1 stock   → at cell center
 * - 2 stocks  → center ± offset along angle 0 and π
 * - 3+ stocks → first at center, rest in an equal-angle ring
 *
 * All positions are clamped inside the cell polygon.
 */
export function placeStocksInCell(
  cell: VoronoiCell,
  cellStocks: readonly Stock[]
): StockPosition[] {
  const n = cellStocks.length;
  if (n === 0) return [];

  const cx = cell.center.x;
  const cz = cell.center.z;
  const area = polygonArea(cell.polygon);
  const poly = cell.polygon;

  // 1 stock: place at center
  if (n === 1) {
    const clamped = clampInside({ x: cx, z: cz }, cell.center, poly);
    return [{ stockId: cellStocks[0].id, x: clamped.x, z: clamped.z }];
  }

  // 2 stocks: place symmetrically along angle 0 and π
  if (n === 2) {
    const offset = Math.sqrt(area) * 0.15;

    const raw0: Point2D = { x: cx + offset, z: cz };
    const raw1: Point2D = { x: cx - offset, z: cz };

    const p0 = clampInside(raw0, cell.center, poly);
    const p1 = clampInside(raw1, cell.center, poly);

    return [
      { stockId: cellStocks[0].id, x: p0.x, z: p0.z },
      { stockId: cellStocks[1].id, x: p1.x, z: p1.z },
    ];
  }

  // 3+ stocks: first at center, rest in ring
  let ringRadius = Math.sqrt(area) * 0.18;
  if (ringRadius > 0.6) ringRadius = 0.6;

  const positions: StockPosition[] = [];

  // First stock at center
  const centerClamped = clampInside({ x: cx, z: cz }, cell.center, poly);
  positions.push({ stockId: cellStocks[0].id, x: centerClamped.x, z: centerClamped.z });

  // Remaining stocks on ring with equal angular spacing
  const ringCount = n - 1;
  for (let i = 1; i < n; i++) {
    const angle = (2 * Math.PI * (i - 1)) / ringCount - Math.PI / 2;
    const rawX = cx + ringRadius * Math.cos(angle);
    const rawZ = cz + ringRadius * Math.sin(angle);

    const clamped = clampInside({ x: rawX, z: rawZ }, cell.center, poly);
    positions.push({ stockId: cellStocks[i].id, x: clamped.x, z: clamped.z });
  }

  return positions;
}
