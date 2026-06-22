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
  readonly subThemeHeat?: Record<string, number>;
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
// Heat-driven sizing constants
// ---------------------------------------------------------------------------

/**
 * Floor for a sub-theme's heat target weight. Even a stone-cold sub-theme
 * keeps weight HEAT_WEIGHT_FLOOR; a blazing-hot one reaches 1. Weights map
 * to relative target areas, so cold cells never collapse — the product's
 * honesty rule requires a real-but-cold sub-theme to stay visible/clickable.
 */
const HEAT_WEIGHT_FLOOR = 0.4;

/** Default heat weight when a sub-theme has no entry (treated as uniform). */
const HEAT_WEIGHT_UNIFORM = 1;

/**
 * Hard floor on any heat-sized cell as a fraction of the theme's equal share
 * (themeArea / siblingCount). Kept below the weight-derived minimum so no cell
 * can drop below this even after relaxation jitter. The floor test asserts
 * area > 0.25 of equalShare, so 0.27 leaves margin while staying below the
 * smallest cell the base (uniform) Voronoi naturally produces here — otherwise
 * the floor guard would trip on geometry the heat pass never caused, and
 * collapse the whole heat spread to zero.
 */
const HEAT_MIN_SHARE_RATIO = 0.27;

/**
 * Hard floor on a power weight, expressed as a fraction of the spacing²
 * scale. Keeps cold cells from being completely swallowed by a hot neighbour
 * (a power weight gap larger than the inter-seed spacing can erase a cell).
 */
const HEAT_POWER_FLOOR_RATIO = 0.45;

/**
 * Map a raw heat value (any non-negative number, typically 0..1) to a target
 * weight in [HEAT_WEIGHT_FLOOR, 1]. Heat is clamped to [0, 1] first.
 */
const heatToWeight = (heat: number): number => {
  const clamped = heat < 0 ? 0 : heat > 1 ? 1 : heat;
  return HEAT_WEIGHT_FLOOR + (1 - HEAT_WEIGHT_FLOOR) * clamped;
};

/**
 * Clip a convex polygon by a single half-plane `a·x + b·z ≤ c`.
 * Sutherland-Hodgman against one edge. Returns the inside polygon.
 */
const clipByHalfPlane = (
  poly: ReadonlyArray<Point2D>,
  a: number,
  b: number,
  c: number
): Point2D[] => {
  if (poly.length < 3) return [];
  const inside = (p: Point2D) => a * p.x + b * p.z <= c + 1e-9;
  const out: Point2D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const nxt = poly[(i + 1) % poly.length];
    const curIn = inside(cur);
    const nxtIn = inside(nxt);
    if (curIn) {
      out.push(cur);
      if (!nxtIn) {
        // intersection of segment cur→nxt with line a·x+b·z=c
        const dx = nxt.x - cur.x;
        const dz = nxt.z - cur.z;
        const denom = a * dx + b * dz;
        const t = denom !== 0 ? (c - (a * cur.x + b * cur.z)) / denom : 0;
        out.push({ x: cur.x + t * dx, z: cur.z + t * dz });
      }
    } else if (nxtIn) {
      const dx = nxt.x - cur.x;
      const dz = nxt.z - cur.z;
      const denom = a * dx + b * dz;
      const t = denom !== 0 ? (c - (a * cur.x + b * cur.z)) / denom : 0;
      out.push({ x: cur.x + t * dx, z: cur.z + t * dz });
    }
  }
  return out;
};

/**
 * Power-diagram (additively-weighted Voronoi) cell of seed `i`.
 * Cell = { x : |x-p_i|² - w_i ≤ |x-p_j|² - w_j  ∀ j≠i }, clipped to `bound`.
 * Each constraint is the linear half-plane:
 *   2(p_j - p_i)·x ≤ |p_j|² - |p_i|² - w_j + w_i
 * Larger w_i ⇒ strictly larger cell — monotone, deterministic, no iteration.
 */
const powerCell = (
  i: number,
  seeds: readonly Point[],
  powerWeights: readonly number[],
  bound: ReadonlyArray<Point2D>
): Point2D[] => {
  let poly: Point2D[] = [...bound];
  const pi = seeds[i];
  const wi = powerWeights[i];
  for (let j = 0; j < seeds.length && poly.length >= 3; j++) {
    if (j === i) continue;
    const pj = seeds[j];
    const a = 2 * (pj.x - pi.x);
    const b = 2 * (pj.z - pi.z);
    const c =
      pj.x * pj.x + pj.z * pj.z - (pi.x * pi.x + pi.z * pi.z) - powerWeights[j] + wi;
    poly = clipByHalfPlane(poly, a, b, c);
  }
  return poly;
};

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
 * Place SubTheme centers at equal angular intervals around the theme center.
 * All centers at the same radial distance for balanced initial placement.
 * Lloyd relaxation will then equalize cell areas.
 */
const placeSubThemeCenters = (
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[]
): Point[] => {
  const { center } = themeCell;
  const count = themeSubThemes.length;

  if (count === 1) return [center];

  const spread = avgDistFromCenter(themeCell.polygon, center) * 0.25;

  return themeSubThemes.map((_st, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const raw: Point = {
      x: center.x + Math.cos(angle) * spread,
      z: center.z + Math.sin(angle) * spread,
    };
    return clampInside(raw, themeCell.polygon as ReadonlyArray<Point2D>, center);
  });
};

/**
 * Lloyd relaxation: iteratively move each generating point to its Voronoi
 * cell centroid. Converges toward equal-area cells within the theme polygon.
 */
const runLloydRelaxation = (
  initialCenters: Point[],
  themeCell: ThemeCell,
  iterations: number
): Point[] => {
  const themePoly = themeCell.polygon as ReadonlyArray<Point2D>;
  const bbox = polygonBounds(themePoly);
  const pad = 0.5;
  let centers = [...initialCenters];

  for (let iter = 0; iter < iterations; iter++) {
    const delaunay = Delaunay.from(centers, (p) => p.x, (p) => p.z);
    const voronoi = delaunay.voronoi([
      bbox.minX - pad, bbox.minZ - pad,
      bbox.maxX + pad, bbox.maxZ + pad,
    ]);

    centers = centers.map((_c, i) => {
      const cellPoly = voronoi.cellPolygon(i);
      if (!cellPoly || cellPoly.length < 4) return centers[i];

      // Convert and clip
      const rawPoly: Point2D[] = [];
      for (let j = 0; j < cellPoly.length - 1; j++) {
        rawPoly.push({ x: cellPoly[j][0], z: cellPoly[j][1] });
      }
      const clipped = clipPolygonToConvexPolygon(rawPoly, themePoly);
      if (clipped.length < 3) return centers[i];

      // Move to cell centroid
      const newCenter = centroid(clipped);
      return clampInside(newCenter, themePoly, themeCell.center);
    });
  }

  return centers;
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

/**
 * Finish a raw clipped cell polygon: inset by the city border gap, smooth, and
 * re-clip to the theme polygon — identical to buildFinalCells' per-cell tail, so
 * heat-sized cells get the same visual treatment as equal-area ones.
 */
const finishCell = (
  rawClipped: ReadonlyArray<Point2D>,
  fallbackCenter: Point,
  themePoly: ReadonlyArray<Point2D>,
  options: VoronoiLayoutOptions
): { polygon: Point2D[]; center: Point } => {
  if (rawClipped.length < 3) return { polygon: [], center: fallbackCenter };
  const cellCentroid = centroid(rawClipped);
  const insetPoly = rawClipped.map((p) =>
    insetPoint(p.x, p.z, cellCentroid, options.cityBorderGap)
  );
  const smoothIter = options.smoothIterations ?? 2;
  const smoothed = smoothPolygon(insetPoly.length >= 3 ? insetPoly : [], smoothIter);
  const finalPoly =
    smoothed.length >= 3 ? clipPolygonToConvexPolygon(smoothed, themePoly) : [];
  const finalCenter = finalPoly.length >= 3 ? centroid(finalPoly) : fallbackCenter;
  return { polygon: finalPoly.length >= 3 ? finalPoly : [], center: finalCenter };
};

/**
 * Heat-aware sizing via a POWER DIAGRAM (additively-weighted Voronoi).
 *
 * Rather than nudging seed positions (a non-monotone, oscillation-prone lever),
 * we keep the Lloyd-relaxed seed POSITIONS fixed and assign each seed a power
 * weight derived from its heat. The power cell of seed i is
 *   { x : |x-p_i|² - w_i ≤ |x-p_j|² - w_j  ∀ j≠i }.
 * Raising w_i pushes every shared bisector away from p_i, so a hotter
 * sub-theme's cell is STRICTLY larger than a colder sibling's — monotone and
 * fully deterministic (no iteration, no randomness).
 *
 * To respect the size floor, the weight spread is capped relative to the median
 * inter-seed spacing² (a gap wider than spacing² can erase a cell). If any cell
 * still lands below the hard share floor, the spread is geometrically shrunk
 * toward zero (uniform = ordinary Voronoi) until every cell clears the floor —
 * so a real-but-cold sub-theme always stays visible/clickable.
 *
 * Runs INSTEAD of enforceAreaFloor only when heat is supplied; the no-heat path
 * is untouched.
 */
const applyHeatSizing = (
  initialCells: VoronoiCell[],
  centers: Point[],
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions,
  weights: readonly number[]
): VoronoiCell[] => {
  const themePoly = themeCell.polygon as ReadonlyArray<Point2D>;
  const count = themeSubThemes.length;
  if (count <= 1) return initialCells;

  const themeArea = polygonArea(themePoly);
  const equalShare = themeArea / count;
  const minArea = HEAT_MIN_SHARE_RATIO * equalShare;

  // Spacing scale: median nearest-neighbour distance among seeds. The power
  // weight gap between any two cells must stay below ~spacing² or a cell can be
  // clipped away entirely, so we measure spacing to scale weights safely.
  let spacingSq = Infinity;
  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const d2 =
        (centers[i].x - centers[j].x) ** 2 + (centers[i].z - centers[j].z) ** 2;
      if (d2 < spacingSq) spacingSq = d2;
    }
  }
  if (!isFinite(spacingSq) || spacingSq <= 0) return initialCells;

  // Normalize heat weights to [0,1] (relative), then scale into power-weight
  // units (∝ spacing²). `spreadScale` shrinks if the floor is violated.
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  const wRange = wMax - wMin;
  const rel = weights.map((w) => (wRange > 0 ? (w - wMin) / wRange : 0)); // 0..1

  const buildCellsForSpread = (spreadScale: number): VoronoiCell[] => {
    // Max safe weight gap kept below spacing² so no cell is fully erased.
    const maxGap = HEAT_POWER_FLOOR_RATIO * spacingSq * spreadScale;
    const powerWeights = rel.map((r) => r * maxGap);
    return themeSubThemes.map((st, i) => {
      const raw = powerCell(i, centers, powerWeights, themePoly);
      const { polygon, center } = finishCell(raw, centers[i], themePoly, options);
      return {
        subThemeId: st.id,
        themeId: themeCell.themeId,
        center,
        polygon,
      };
    });
  };

  // Try full spread first; if any cell collapses below the floor, shrink the
  // spread geometrically toward uniform until the floor holds.
  let cells = initialCells;
  let spread = 1;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = buildCellsForSpread(spread);
    const areas = candidate.map((c) =>
      c.polygon.length >= 3 ? polygonArea(c.polygon) : 0
    );
    const ok = areas.every((a) => a >= minArea);
    cells = candidate;
    if (ok) break;
    spread *= 0.6; // ease toward uniform
  }

  return cells;
};

// ---------------------------------------------------------------------------
// Per-theme Voronoi computation
// ---------------------------------------------------------------------------

/**
 * Compute Voronoi cells for a single theme's SubThemes, strictly contained
 * within the theme's polygon boundary. Uses Lloyd relaxation for equal areas.
 */
const computePerThemeVoronoi = (
  themeCell: ThemeCell,
  themeSubThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions,
  subThemeHeat?: Record<string, number>
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

  // Per-sub-theme heat weights, only when heat is supplied. Missing entries map
  // to the uniform weight so partial heat maps still behave sensibly.
  const weights = subThemeHeat
    ? themeSubThemes.map((st) =>
        heatToWeight(subThemeHeat[st.id] ?? HEAT_WEIGHT_UNIFORM)
      )
    : undefined;

  // Multiple SubThemes: equal placement → Lloyd relaxation → final cells.
  // The starting configuration is IDENTICAL with or without heat; the heat
  // signal is applied entirely by applyHeatSizing below, which keeps the
  // no-heat path byte-for-byte unchanged.
  const initialCenters = placeSubThemeCenters(themeCell, themeSubThemes);
  const relaxedCenters = runLloydRelaxation(initialCenters, themeCell, 3);
  let cells = buildFinalCells(relaxedCenters, themeCell, themeSubThemes, options);

  if (weights) {
    // Heat path: size cells by target weight with a hard share floor.
    cells = applyHeatSizing(
      cells,
      relaxedCenters,
      themeCell,
      themeSubThemes,
      options,
      weights
    );
  } else {
    // No-heat path (unchanged): every cell ≥ 35% of average within theme.
    cells = enforceAreaFloor(cells, relaxedCenters, themeCell, themeSubThemes, options);
  }

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
  const { subThemes, themeCells, stage, options, subThemeHeat } = input;

  const cells: VoronoiCell[] = [];

  for (const themeCell of themeCells) {
    const themeSubThemes = subThemes.filter(
      (st) => st.themeId === themeCell.themeId
    );
    const themeVoronoiCells = computePerThemeVoronoi(
      themeCell,
      themeSubThemes,
      options,
      subThemeHeat
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
