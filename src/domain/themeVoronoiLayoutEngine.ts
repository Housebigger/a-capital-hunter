import { Delaunay } from "d3-delaunay";
import type { LayoutStage, RelationshipEdge, Theme } from "./types";

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
  readonly boundary: { readonly width: number; readonly height: number };
}

export interface ThemeLayoutOptions {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly borderGap: number;
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

// ---------------------------------------------------------------------------
// Theme center positioning
// ---------------------------------------------------------------------------

const computeThemeCenters = (input: ThemeLayoutInput): Point[] => {
  const { themes, relationshipEdges, stage, options } = input;
  const halfW = options.mapWidth / 2;
  const halfH = options.mapHeight / 2;

  const themeCount = themes.length;
  const baseRadius = Math.min(halfW, halfH) * 0.5;
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
  // Build sector→theme lookup (theme centers ARE themes)
  const sectorToTheme = new Map<string, string>();
  for (const t of themes) {
    sectorToTheme.set(t.id, t.id);
  }

  const adjusted = [...anchors];
  const pullStrength = 0.3;

  for (let ti = 0; ti < themes.length; ti++) {
    let pullX = 0;
    let pullZ = 0;
    let totalW = 0;

    for (const edge of relationshipEdges) {
      const srcTheme = sectorToTheme.get(edge.sourceSectorId);
      const tgtTheme = sectorToTheme.get(edge.targetSectorId);

      if (srcTheme === themes[ti].id && tgtTheme && tgtTheme !== themes[ti].id) {
        const oi = themes.findIndex((t) => t.id === tgtTheme);
        if (oi >= 0) {
          pullX += adjusted[oi].x * edge.weight;
          pullZ += adjusted[oi].z * edge.weight;
          totalW += edge.weight;
        }
      } else if (tgtTheme === themes[ti].id && srcTheme && srcTheme !== themes[ti].id) {
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
// Voronoi computation
// ---------------------------------------------------------------------------

const computeThemeVoronoi = (
  centers: Point[],
  options: ThemeLayoutOptions
): ThemeCell[] => {
  const halfW = options.mapWidth / 2;
  const halfH = options.mapHeight / 2;

  const delaunay = Delaunay.from(centers, (p) => p.x, (p) => p.z);
  const voronoi = delaunay.voronoi([-halfW, -halfH, halfW, halfH]);

  return centers.map((center, i) => {
    const cellPoly = voronoi.cellPolygon(i);
    if (!cellPoly || cellPoly.length < 4) {
      return { themeId: `theme-${i}`, center, polygon: [] as ThemeCell["polygon"] };
    }

    // Convert d3 polygon → our format, apply border inset
    const poly: Array<{ x: number; z: number }> = [];
    for (let j = 0; j < cellPoly.length - 1; j++) {
      const vx = cellPoly[j][0];
      const vz = cellPoly[j][1];
      poly.push(insetPoint(vx, vz, center, options.borderGap));
    }

    return { themeId: `theme-${i}`, center, polygon: poly };
  });
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function createThemeVoronoiLayout(input: ThemeLayoutInput): ThemeVoronoiLayout {
  const centers = computeThemeCenters(input);
  const cells = computeThemeVoronoi(centers, input.options);

  return {
    cells: Object.freeze(cells),
    boundary: { width: input.options.mapWidth, height: input.options.mapHeight },
  };
}
