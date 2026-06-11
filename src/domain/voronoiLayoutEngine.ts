import { Delaunay } from "d3-delaunay";
import type {
  SectorId,
  SubTheme,
  LayoutStage,
  VoronoiCell,
  VoronoiLayout,
} from "./types";
import type { ThemeCell } from "./themeVoronoiLayoutEngine";
import { sectors } from "./themeRegistry";
import { clipPolygonToConvexPolygon, type Point2D } from "./polygonClip";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VoronoiLayoutOptions {
  readonly mapRadius: number;
  readonly cityBorderGap: number;
  readonly smoothIterations?: number;
}

export interface VoronoiLayoutInput {
  readonly subThemes: readonly SubTheme[];
  readonly themeCells: ReadonlyArray<ThemeCell>;
  readonly stage: LayoutStage;
  readonly options: VoronoiLayoutOptions;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface Point {
  readonly x: number;
  readonly z: number;
}

/** Move a polygon vertex toward the cell center by `gap` amount. */
const insetPoint = (
  px: number,
  pz: number,
  center: Point,
  gap: number
): Point => {
  const dx = center.x - px;
  const dz = center.z - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < gap) return { x: px, z: pz };
  return { x: px + (dx / dist) * gap, z: pz + (dz / dist) * gap };
};

/** Compute axis-aligned bounding box of a polygon. */
const polygonBounds = (poly: ReadonlyArray<Point2D>) => {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, minZ, maxX, maxZ };
};

/** Centroid of a polygon (arithmetic mean of vertices). */
const centroid = (poly: ReadonlyArray<Point2D>): Point => {
  let sx = 0;
  let sz = 0;
  for (const p of poly) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / poly.length, z: sz / poly.length };
};

/** Shoelace formula for polygon area. */
const polygonArea = (poly: ReadonlyArray<Point2D>): number => {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].z;
    area -= poly[j].x * poly[i].z;
  }
  return Math.abs(area) / 2;
};

/** Average distance from center to polygon vertices — estimates polygon extent. */
const avgDistFromCenter = (
  poly: ReadonlyArray<Point2D>,
  center: Point
): number => {
  let sum = 0;
  for (const p of poly) {
    sum += Math.sqrt((p.x - center.x) ** 2 + (p.z - center.z) ** 2);
  }
  return sum / poly.length;
};

/**
 * Chaikin's corner-cutting algorithm — smooths a polygon by cutting corners.
 * Each iteration inserts two new points per edge at 1/4 and 3/4 positions,
 * producing rounder shapes. Doubles vertex count per iteration.
 */
const smoothPolygon = (
  poly: ReadonlyArray<Point2D>,
  iterations: number
): Point2D[] => {
  let result: Point2D[] = [...poly];
  for (let iter = 0; iter < iterations; iter++) {
    const input = result;
    result = [];
    for (let i = 0; i < input.length; i++) {
      const curr = input[i];
      const next = input[(i + 1) % input.length];
      result.push(
        { x: curr.x * 0.75 + next.x * 0.25, z: curr.z * 0.75 + next.z * 0.25 },
        { x: curr.x * 0.25 + next.x * 0.75, z: curr.z * 0.25 + next.z * 0.75 }
      );
    }
  }
  return result;
};

/** Minimum SubTheme cell area as fraction of the theme's average cell area. */
const SUBTHEME_AREA_FLOOR_RATIO = 0.35;

// ---------------------------------------------------------------------------
// SubTheme heat computation
// ---------------------------------------------------------------------------

/**
 * Compute average heat per SubTheme from stage sector heat data.
 * Uses the arithmetic mean of all member sectors' heat values.
 */
const computeSubThemeHeatMap = (
  stage: LayoutStage
): ReadonlyMap<string, number> => {
  // Build sector → subThemeId lookup
  const sectorSubThemeMap = new Map<SectorId, string>();
  for (const sector of sectors) {
    sectorSubThemeMap.set(sector.id, sector.subThemeId);
  }

  // Accumulate heat per SubTheme
  const heatSum = new Map<string, number>();
  const heatCount = new Map<string, number>();
  for (const sector of sectors) {
    const stId = sectorSubThemeMap.get(sector.id);
    if (!stId) continue;
    const h = stage.sectorHeat[sector.id] ?? 0.2;
    heatSum.set(stId, (heatSum.get(stId) ?? 0) + h);
    heatCount.set(stId, (heatCount.get(stId) ?? 0) + 1);
  }

  const result = new Map<string, number>();
  for (const [stId, sum] of heatSum) {
    const count = heatCount.get(stId) ?? 1;
    result.set(stId, sum / count);
  }
  return result;
};

// ---------------------------------------------------------------------------
// Per-theme center placement
// ---------------------------------------------------------------------------

/**
 * Check if a point is inside a convex polygon using cross-product test.
 */
const pointInConvexPoly = (
  px: number,
  pz: number,
  poly: ReadonlyArray<Point2D>
): boolean => {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (pz - a.z) - (b.z - a.z) * (px - a.x);
    if (cross < 0) return false;
  }
  return true;
};

/**
 * Ensure a point is inside the convex polygon.
 * If outside, progressively pull toward the polygon centroid until inside.
 */
const clampInside = (pt: Point, poly: ReadonlyArray<Point2D>, polyCenter: Point): Point => {
  if (pointInConvexPoly(pt.x, pt.z, poly)) return pt;
  // Binary-search toward center
  let lo = 0;
  let hi = 1;
  let best = polyCenter;
  for (let step = 0; step < 10; step++) {
    const mid = (lo + hi) / 2;
    const cx = polyCenter.x + (pt.x - polyCenter.x) * mid;
    const cz = polyCenter.z + (pt.z - polyCenter.z) * mid;
    if (pointInConvexPoly(cx, cz, poly)) {
      best = { x: cx, z: cz };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
};

/**
 * Place SubTheme centers within a theme polygon using heat-weighted radial layout.
 * Uses absolute heat (cross-theme) so hot SubThemes like AI应用, 光互连, 芯片架构
 * get much larger cells than cold SubThemes on the map periphery.
 *
 * Radius formula: maxSpread * (1.0 - heat * 0.65)
 *   heat=1.0 → radius=0.35×max (close to center → large cell)
 *   heat=0.28 → radius=0.82×max (far from center → small cell)
 */
const placeSubThemeCenters = (
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[],
  heatMap: ReadonlyMap<string, number>
): Point[] => {
  const { center } = themeCell;
  const count = themeSubThemes.length;

  if (count === 1) return [center];

  // Max spread from theme center
  const maxSpread = avgDistFromCenter(themeCell.polygon, center) * 0.25;

  return themeSubThemes.map((st, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;

    // Absolute heat from stage (0–1 scale, cross-theme)
    const heat = heatMap.get(st.id) ?? 0.2;

    // Hot → small radius (close to center) = larger Voronoi cell
    // Cold → large radius (far from center) = smaller Voronoi cell
    const radius = maxSpread * (1.0 - heat * 0.65);

    const raw: Point = {
      x: center.x + Math.cos(angle) * radius,
      z: center.z + Math.sin(angle) * radius,
    };
    // Clamp to stay inside theme polygon
    return clampInside(raw, themeCell.polygon as ReadonlyArray<Point2D>, center);
  });
};

// ---------------------------------------------------------------------------
// Voronoi cell building and area enforcement
// ---------------------------------------------------------------------------

/**
 * Build final Voronoi cells from a set of centers, clipped to theme polygon.
 * Handles clip → inset → smooth → re-clip for each cell.
 */
const buildFinalCells = (
  centers: Point[],
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions
): VoronoiCell[] => {
  const themePoly = themeCell.polygon as ReadonlyArray<Point2D>;
  const bbox = polygonBounds(themePoly);
  const pad = 0.5;
  const delaunay = Delaunay.from(centers, (p) => p.x, (p) => p.z);
  const voronoi = delaunay.voronoi([
    bbox.minX - pad,
    bbox.minZ - pad,
    bbox.maxX + pad,
    bbox.maxZ + pad,
  ]);

  return themeSubThemes.map((st, i) => {
    const cellPoly = voronoi.cellPolygon(i);
    if (!cellPoly || cellPoly.length < 4) {
      return {
        subThemeId: st.id,
        themeId: themeCell.themeId,
        center: centers[i],
        polygon: [] as VoronoiCell["polygon"],
      };
    }

    // Convert d3 format to our Point format (d3 repeats first vertex)
    const rawPoly: Point2D[] = [];
    for (let j = 0; j < cellPoly.length - 1; j++) {
      rawPoly.push({ x: cellPoly[j][0], z: cellPoly[j][1] });
    }

    // Clip to theme polygon — guarantees containment
    const clipped = clipPolygonToConvexPolygon(rawPoly, themePoly);
    if (clipped.length < 3) {
      return {
        subThemeId: st.id,
        themeId: themeCell.themeId,
        center: centers[i],
        polygon: [],
      };
    }

    // Apply city border gap inset (use cell centroid, not generating point)
    const cellCentroid = clipped.length >= 3 ? centroid(clipped) : centers[i];
    const insetPoly = clipped.map((p) =>
      insetPoint(p.x, p.z, cellCentroid, options.cityBorderGap)
    );

    // Smooth the polygon for rounder shapes
    const smoothIter = options.smoothIterations ?? 2;
    const smoothed = smoothPolygon(insetPoly.length >= 3 ? insetPoly : [], smoothIter);

    // Re-clip to theme polygon after smoothing — belt-and-suspenders containment
    const finalPoly = smoothed.length >= 3
      ? clipPolygonToConvexPolygon(smoothed, themePoly)
      : [];

    // Use polygon centroid as center so column aligns with visible region
    const finalCenter = finalPoly.length >= 3 ? centroid(finalPoly) : centers[i];

    return {
      subThemeId: st.id,
      themeId: themeCell.themeId,
      center: finalCenter,
      polygon: finalPoly.length >= 3 ? finalPoly : [],
    };
  });
};

/**
 * Ensure every SubTheme cell has area ≥ SUBTHEME_AREA_FLOOR_RATIO × average.
 * If a cell is below threshold, pull its center toward the theme center
 * (giving it more area) then recompute the Voronoi once.
 */
const enforceAreaFloor = (
  cells: VoronoiCell[],
  centers: Point[],
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions
): VoronoiCell[] => {
  const themePoly = themeCell.polygon as ReadonlyArray<Point2D>;

  // Calculate areas
  const areas = cells.map(c =>
    c.polygon.length >= 3 ? polygonArea(c.polygon) : 0
  );
  const validAreas = areas.filter(a => a > 0);
  if (validAreas.length <= 1) return cells;

  const avgArea = validAreas.reduce((s, a) => s + a, 0) / validAreas.length;
  const threshold = avgArea * SUBTHEME_AREA_FLOOR_RATIO;

  // Check if any cell is below threshold
  const underThreshold = areas.some(a => a > 0 && a < threshold);
  if (!underThreshold) return cells;

  // Adjust: pull under-threshold cells toward theme center
  const adjustedCenters = centers.map((c, i) => {
    if (areas[i] > 0 && areas[i] < threshold) {
      const pullFactor = 0.6;
      const nx = c.x + (themeCell.center.x - c.x) * pullFactor;
      const nz = c.z + (themeCell.center.z - c.z) * pullFactor;
      return clampInside({ x: nx, z: nz }, themePoly, themeCell.center);
    }
    return c;
  });

  // Recompute Voronoi with adjusted centers
  return buildFinalCells(adjustedCenters, themeCell, themeSubThemes, options);
};

// ---------------------------------------------------------------------------
// Per-theme Voronoi computation
// ---------------------------------------------------------------------------

/**
 * Compute Voronoi cells for a single theme's SubThemes, strictly contained
 * within the theme's polygon boundary. Enforces minimum area threshold.
 */
const computePerThemeVoronoi = (
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions,
  heatMap: ReadonlyMap<string, number>
): VoronoiCell[] => {
  if (themeSubThemes.length === 0) return [];

  // Theme polygon as the clip boundary
  const themePoly = themeCell.polygon as ReadonlyArray<Point2D>;

  // Single SubTheme: entire theme polygon (with border gap inset)
  if (themeSubThemes.length === 1) {
    const insetPoly = themePoly.map((p) =>
      insetPoint(p.x, p.z, themeCell.center, options.cityBorderGap)
    );
    const smoothIter = options.smoothIterations ?? 2;
    const smoothed = smoothPolygon(insetPoly.length >= 3 ? insetPoly : [], smoothIter);
    const finalPoly = smoothed.length >= 3
      ? clipPolygonToConvexPolygon(smoothed, themePoly)
      : [];
    return [
      {
        subThemeId: themeSubThemes[0].id,
        themeId: themeCell.themeId,
        center: themeCell.center,
        polygon: finalPoly.length >= 3 ? finalPoly : [],
      },
    ];
  }

  // Multiple SubThemes: mini Voronoi within theme polygon
  const centers = placeSubThemeCenters(themeCell, themeSubThemes, heatMap);
  let cells = buildFinalCells(centers, themeCell, themeSubThemes, options);

  // Enforce minimum area: every cell ≥ 35% of average within theme
  cells = enforceAreaFloor(cells, centers, themeCell, themeSubThemes, options);

  return cells;
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Create a Voronoi layout where each theme's SubThemes are computed
 * independently and strictly contained within the theme's polygon.
 */
export function createVoronoiLayout(input: VoronoiLayoutInput): VoronoiLayout {
  const { subThemes, themeCells, stage, options } = input;

  // Compute per-SubTheme heat from stage sector heat data
  const heatMap = computeSubThemeHeatMap(stage);

  const cells: VoronoiCell[] = [];

  for (const themeCell of themeCells) {
    const themeSubThemes = subThemes.filter(
      (st) => st.themeId === themeCell.themeId
    );
    const themeVoronoiCells = computePerThemeVoronoi(
      themeCell,
      themeSubThemes,
      options,
      heatMap
    );
    cells.push(...themeVoronoiCells);
  }

  return {
    cells: Object.freeze(cells),
    boundary: { radius: options.mapRadius },
    version: `voronoi-${stage.id}`,
    stageId: stage.id,
  };
}
