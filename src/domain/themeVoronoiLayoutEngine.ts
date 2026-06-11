import { Delaunay } from "d3-delaunay";
import type { LayoutStage, RelationshipEdge, Theme } from "./types";
import { clipPolygonToCircle } from "./circleClip";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ThemeCell {
  readonly themeId: string;
  readonly center: { readonly x: number; readonly z: number };
  readonly polygon: ReadonlyArray<{ readonly x: number; readonly z: number }>;
}

export interface ThemeVoronoiLayout {
  readonly cells: ReadonlyArray<ThemeCell>;
  readonly boundary: { readonly radius: number };
}

export interface ThemeLayoutOptions {
  readonly mapRadius: number;
  readonly borderGap: number;
  readonly lloydIterations?: number;
  readonly smoothIterations?: number;
}

export interface ThemeLayoutInput {
  readonly themes: readonly Theme[];
  readonly relationshipEdges: readonly RelationshipEdge[];
  readonly stage: LayoutStage;
  readonly options: ThemeLayoutOptions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Point {
  readonly x: number;
  readonly z: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

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

/** Centroid of a polygon (arithmetic mean of vertices). */
const centroid = (poly: ReadonlyArray<{ x: number; z: number }>): Point => {
  let sx = 0;
  let sz = 0;
  for (const p of poly) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / poly.length, z: sz / poly.length };
};

/**
 * Chaikin's corner-cutting algorithm — smooths a polygon by cutting corners.
 * Each iteration inserts two new points per edge at 1/4 and 3/4 positions.
 */
const chaikinSmooth = (
  poly: ReadonlyArray<{ x: number; z: number }>,
  iterations: number
): Array<{ x: number; z: number }> => {
  let result: Array<{ x: number; z: number }> = [...poly];
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

// ---------------------------------------------------------------------------
// Phase 1: Initial center placement
// ---------------------------------------------------------------------------

const computeInitialCenters = (input: ThemeLayoutInput): Point[] => {
  const { themes, relationshipEdges, stage, options } = input;
  const themeCount = themes.length;
  const baseRadius = options.mapRadius * 0.6;
  const maxInward = baseRadius * 0.4;

  // 1. Radial anchors with heat-based inward shift
  const anchors: Point[] = themes.map((theme, i) => {
    const heat = stage.themeHeat[theme.id] ?? 0.2;
    const angle = (Math.PI * 2 * i) / themeCount - Math.PI / 2;
    const inwardShift = clamp(heat, 0, 1) * maxInward;
    const r = Math.max(2, baseRadius - inwardShift);
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r };
  });

  // 2. Cross-theme relationship pull
  const adjusted = [...anchors];
  const pullStrength = 0.3;

  for (let ti = 0; ti < themes.length; ti++) {
    let pullX = 0;
    let pullZ = 0;
    let totalW = 0;

    for (const edge of relationshipEdges) {
      const srcTheme = edge.sourceSectorId;
      const tgtTheme = edge.targetSectorId;

      if (srcTheme === themes[ti].id && tgtTheme !== themes[ti].id) {
        const oi = themes.findIndex((t) => t.id === tgtTheme);
        if (oi >= 0) {
          pullX += adjusted[oi].x * edge.weight;
          pullZ += adjusted[oi].z * edge.weight;
          totalW += edge.weight;
        }
      } else if (tgtTheme === themes[ti].id && srcTheme !== themes[ti].id) {
        const oi = themes.findIndex((t) => t.id === srcTheme);
        if (oi >= 0) {
          pullX += adjusted[oi].x * edge.weight;
          pullZ += adjusted[oi].z * edge.weight;
          totalW += edge.weight;
        }
      }
    }

    if (totalW > 0) {
      adjusted[ti] = {
        x: adjusted[ti].x + (pullX / totalW - adjusted[ti].x) * pullStrength,
        z: adjusted[ti].z + (pullZ / totalW - adjusted[ti].z) * pullStrength,
      };
    }
  }

  return adjusted;
};

// ---------------------------------------------------------------------------
// Phase 2: Lloyd's relaxation (produces more regular polygon-like cells)
// ---------------------------------------------------------------------------

/**
 * Lloyd's relaxation: iteratively move each center to the centroid of its
 * Voronoi cell. This converges toward a centroidal Voronoi tessellation
 * where cells become more uniform and regular (hexagonal-like).
 *
 * A heat-based inward bias keeps hot themes closer to the map center,
 * so they end up with more neighbors.
 */
const lloydRelaxation = (
  centers: Point[],
  input: ThemeLayoutInput,
  iterations: number
): Point[] => {
  const r = input.options.mapRadius;
  const { themes, stage } = input;
  const maxInward = r * 0.15; // gentle center-pull for hot themes
  let points = [...centers];

  for (let iter = 0; iter < iterations; iter++) {
    const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.z);
    const voronoi = delaunay.voronoi([-r, -r, r, r]);

    const next: Point[] = [];
    for (let i = 0; i < points.length; i++) {
      const cellPoly = voronoi.cellPolygon(i);
      if (!cellPoly || cellPoly.length < 4) {
        next.push(points[i]);
        continue;
      }

      // Compute centroid of the cell
      const poly: Array<{ x: number; z: number }> = [];
      for (let j = 0; j < cellPoly.length - 1; j++) {
        poly.push({ x: cellPoly[j][0], z: cellPoly[j][1] });
      }
      let cx = centroid(poly);

      // Heat-based inward bias: hot themes get pulled toward origin
      const heat = stage.themeHeat[themes[i].id] ?? 0.2;
      const inwardBias = clamp(heat, 0, 1) * maxInward;
      const distFromCenter = Math.sqrt(cx.x * cx.x + cx.z * cx.z);
      if (distFromCenter > 0.01) {
        cx = {
          x: cx.x - (cx.x / distFromCenter) * inwardBias,
          z: cx.z - (cx.z / distFromCenter) * inwardBias,
        };
      }

      next.push(cx);
    }
    points = next;
  }

  return points;
};

// ---------------------------------------------------------------------------
// Phase 3: Voronoi computation with circular clip + Chaikin smoothing
// ---------------------------------------------------------------------------

const computeThemeVoronoi = (
  centers: Point[],
  themeIds: readonly string[],
  options: ThemeLayoutOptions
): ThemeCell[] => {
  const r = options.mapRadius;
  const smoothIter = options.smoothIterations ?? 2;

  const delaunay = Delaunay.from(centers, (p) => p.x, (p) => p.z);
  const voronoi = delaunay.voronoi([-r, -r, r, r]);

  return centers.map((center, i) => {
    const themeId = themeIds[i] ?? `theme-${i}`;
    const cellPoly = voronoi.cellPolygon(i);
    if (!cellPoly || cellPoly.length < 4) {
      return { themeId, center, polygon: [] as ThemeCell["polygon"] };
    }

    // Convert d3 polygon → apply inset → clip to circle
    const rawPoly: Array<{ x: number; z: number }> = [];
    for (let j = 0; j < cellPoly.length - 1; j++) {
      rawPoly.push(insetPoint(cellPoly[j][0], cellPoly[j][1], center, options.borderGap));
    }

    const clipped = clipPolygonToCircle(rawPoly, r);
    if (clipped.length < 3) {
      return { themeId, center, polygon: [] };
    }

    // Smooth the theme polygon for rounder shapes
    const smoothed = smoothIter > 0 ? chaikinSmooth(clipped, smoothIter) : clipped;

    return { themeId, center, polygon: smoothed.length >= 3 ? smoothed : clipped };
  });
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function createThemeVoronoiLayout(input: ThemeLayoutInput): ThemeVoronoiLayout {
  const themeIds = input.themes.map((t) => t.id);
  const lloydIter = input.options.lloydIterations ?? 3;

  // Phase 1: Initial placement (radial + heat + relationship)
  const initial = computeInitialCenters(input);

  // Phase 2: Lloyd's relaxation → more regular, hexagonal-like cells
  const relaxed = lloydRelaxation(initial, input, lloydIter);

  // Phase 3: Voronoi computation + clip + smooth
  const cells = computeThemeVoronoi(relaxed, themeIds, input.options);

  return {
    cells: Object.freeze(cells),
    boundary: { radius: input.options.mapRadius },
  };
}
