import { Delaunay } from "d3-delaunay";
import type {
  RelationshipEdge,
  SubTheme,
  Theme,
  LayoutStage,
  VoronoiCell,
  VoronoiLayout,
  SectorId,
} from "./types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VoronoiLayoutOptions {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly relaxationIterations: number;
  readonly areaConvergenceThreshold: number;
  readonly provinceBorderGap: number;
  readonly cityBorderGap: number;
}

export interface VoronoiLayoutInput {
  readonly subThemes: readonly SubTheme[];
  readonly themes: readonly Theme[];
  readonly relationshipEdges: readonly RelationshipEdge[];
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

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Shoelace formula for polygon area. */
const shoelaceArea = (poly: ReadonlyArray<{ x: number; z: number }>): number => {
  let area = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += poly[i].x * poly[j].z;
    area -= poly[j].x * poly[i].z;
  }
  return Math.abs(area / 2);
};

/** Centroid of a polygon (arithmetic mean of vertices). */
const centroid = (poly: ReadonlyArray<{ x: number; z: number }>): Point => {
  const n = poly.length;
  let sx = 0;
  let sz = 0;
  for (const p of poly) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / n, z: sz / n };
};

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

// ---------------------------------------------------------------------------
// Phase 1 — SubTheme center positioning
// ---------------------------------------------------------------------------

/**
 * Arrange theme anchors radially (tighter than Gen3) and then offset
 * SubTheme centers around their parent theme anchor.
 */
const computeSubThemeCenters = (
  input: VoronoiLayoutInput
): Map<string, Point> => {
  const { themes: themeList, subThemes, relationshipEdges, stage, options } = input;
  const halfW = options.mapWidth / 2;
  const halfH = options.mapHeight / 2;

  // --- 1a. Theme anchors (radial, tighter radius) ---
  const themeCount = themeList.length;
  const baseRadius = Math.min(halfW, halfH) * 0.55;
  const maxInward = baseRadius * 0.35;

  const themeAnchors: Map<string, Point> = new Map();
  for (let i = 0; i < themeCount; i++) {
    const theme = themeList[i];
    const heat = stage.themeHeat[theme.id] ?? 0.2;
    const angle = (Math.PI * 2 * i) / themeCount - Math.PI / 2;
    const inwardShift = clamp(heat, 0, 1) * maxInward;
    const r = Math.max(2, baseRadius - inwardShift);
    themeAnchors.set(theme.id, { x: Math.cos(angle) * r, z: Math.sin(angle) * r });
  }

  // --- 1b. Cross-theme relationship pull on theme anchors ---
  // Map sectors that share a theme ID to that theme (theme centers)
  const sectorToTheme = new Map<SectorId, string>();
  for (const t of themeList) {
    sectorToTheme.set(t.id, t.id);
  }

  // Apply pull: for each theme, compute net pull toward related themes
  const adjustedThemeAnchors = new Map(themeAnchors);
  const pullStrength = 0.25;
  for (const theme of themeList) {
    const themePos = adjustedThemeAnchors.get(theme.id)!;
    let pullX = 0;
    let pullZ = 0;
    let totalW = 0;

    for (const edge of relationshipEdges) {
      const srcTheme = sectorToTheme.get(edge.sourceSectorId);
      const tgtTheme = sectorToTheme.get(edge.targetSectorId);

      if (srcTheme === theme.id && tgtTheme && tgtTheme !== theme.id) {
        const other = adjustedThemeAnchors.get(tgtTheme)!;
        pullX += other.x * edge.weight;
        pullZ += other.z * edge.weight;
        totalW += edge.weight;
      } else if (tgtTheme === theme.id && srcTheme && srcTheme !== theme.id) {
        const other = adjustedThemeAnchors.get(srcTheme)!;
        pullX += other.x * edge.weight;
        pullZ += other.z * edge.weight;
        totalW += edge.weight;
      }
    }

    if (totalW > 0) {
      adjustedThemeAnchors.set(theme.id, {
        x: themePos.x + (pullX / totalW - themePos.x) * pullStrength,
        z: themePos.z + (pullZ / totalW - themePos.z) * pullStrength,
      });
    }
  }

  // --- 1c. SubTheme offsets around theme anchor ---
  const centers = new Map<string, Point>();
  const subThemeDistance = 1.8;

  for (const theme of themeList) {
    const themePos = adjustedThemeAnchors.get(theme.id)!;
    const themeSubThemes = subThemes.filter((st) => st.themeId === theme.id);
    const count = themeSubThemes.length;

    for (let i = 0; i < count; i++) {
      const st = themeSubThemes[i];
      // Higher areaWeight = closer to theme center ("provincial capital")
      const distFactor = 1 - st.areaWeight * 0.4;
      const dist = subThemeDistance * distFactor;
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      centers.set(st.id, {
        x: themePos.x + Math.cos(angle) * dist,
        z: themePos.z + Math.sin(angle) * dist,
      });
    }
  }

  return centers;
};

// ---------------------------------------------------------------------------
// Phase 2 — Weighted Voronoi with iterative relaxation
// ---------------------------------------------------------------------------

const computeWeightedVoronoi = (
  centersMap: Map<string, Point>,
  subThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions
): VoronoiCell[] => {
  const halfW = options.mapWidth / 2;
  const halfH = options.mapHeight / 2;

  // Build ordered array of points matching subThemes order
  const stArray = [...subThemes];
  let points: Point[] = stArray.map((st) => centersMap.get(st.id)!);

  const totalWeight = stArray.reduce((s, st) => s + st.areaWeight, 0);
  const totalMapArea = options.mapWidth * options.mapHeight;

  // Target area for each cell
  const targetAreas = stArray.map((st) => (st.areaWeight / totalWeight) * totalMapArea);

  // Relaxation: adjust point positions so cell areas converge to target areas.
  // Uses log-proportional step for fast convergence (standard weighted Voronoi technique).
  for (let iter = 0; iter < options.relaxationIterations; iter++) {
    const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.z);
    const voronoi = delaunay.voronoi([-halfW, -halfH, halfW, halfH]);

    let maxError = 0;
    const newPoints: Point[] = [];

    for (let i = 0; i < points.length; i++) {
      const cellPolygon = voronoi.cellPolygon(i);
      if (!cellPolygon || cellPolygon.length < 4) {
        newPoints.push(points[i]);
        continue;
      }

      // Convert d3 polygon format to our Point format
      const poly: Array<{ x: number; z: number }> = [];
      for (let j = 0; j < cellPolygon.length - 1; j++) {
        poly.push({ x: cellPolygon[j][0], z: cellPolygon[j][1] });
      }

      const area = shoelaceArea(poly);
      const c = centroid(poly);
      const areaRatio = area / targetAreas[i];
      const error = Math.abs(areaRatio - 1);
      maxError = Math.max(maxError, error);

      // Log-proportional step: move toward centroid when too small, away when too large.
      // The log scale prevents oscillation and converges faster than linear steps.
      // Clamp to prevent extreme movements.
      const stepScale = clamp(Math.log(areaRatio) * 0.3, -0.5, 0.5);
      const dx = c.x - points[i].x;
      const dz = c.z - points[i].z;
      newPoints.push({
        x: points[i].x + dx * stepScale,
        z: points[i].z + dz * stepScale,
      });
    }

    points = newPoints;
    if (maxError < options.areaConvergenceThreshold) break;
  }

  // --- Final Voronoi generation (no insets for area measurement) ---
  const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.z);
  const voronoi = delaunay.voronoi([-halfW, -halfH, halfW, halfH]);

  // Build neighbor map from Delaunay triangulation for province border detection
  const neighborSet = new Set<string>();
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const a = delaunay.triangles[i];
    const b = delaunay.triangles[i + 1];
    const c = delaunay.triangles[i + 2];
    const addPair = (x: number, y: number) => {
      const lo = Math.min(x, y);
      const hi = Math.max(x, y);
      neighborSet.add(`${lo}-${hi}`);
    };
    addPair(a, b);
    addPair(b, c);
    addPair(a, c);
  }

  // Convert to VoronoiCell[] with per-vertex inset
  return stArray.map((st, i) => {
    const cellPoly = voronoi.cellPolygon(i);
    if (!cellPoly || cellPoly.length < 4) {
      return {
        subThemeId: st.id,
        center: centersMap.get(st.id)!,
        polygon: [] as VoronoiCell["polygon"],
        themeId: st.themeId,
      };
    }

    // Find neighbors of this cell
    const neighbors: number[] = [];
    for (let j = 0; j < stArray.length; j++) {
      if (j === i) continue;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      if (neighborSet.has(`${lo}-${hi}`)) {
        neighbors.push(j);
      }
    }

    // Determine per-vertex inset based on neighbor theme
    const cellCenter = centersMap.get(st.id)!;
    const openPoly: Array<{ x: number; z: number }> = [];

    for (let j = 0; j < cellPoly.length - 1; j++) {
      const vx = cellPoly[j][0];
      const vz = cellPoly[j][1];

      // Default: same-theme inset
      let maxGap = options.cityBorderGap;

      for (const ni of neighbors) {
        if (stArray[ni].themeId !== st.themeId) {
          // Cross-theme border: use province gap for vertices near the border midpoint
          const neighborCenter = centersMap.get(stArray[ni].id)!;
          const midX = (cellCenter.x + neighborCenter.x) / 2;
          const midZ = (cellCenter.z + neighborCenter.z) / 2;
          const distToMid = Math.sqrt((vx - midX) ** 2 + (vz - midZ) ** 2);
          const cellDist = Math.sqrt(
            (cellCenter.x - neighborCenter.x) ** 2 + (cellCenter.z - neighborCenter.z) ** 2
          );
          if (distToMid < cellDist * 0.6) {
            maxGap = Math.max(maxGap, options.provinceBorderGap);
          }
        }
      }

      openPoly.push(insetPoint(vx, vz, cellCenter, maxGap));
    }

    return {
      subThemeId: st.id,
      center: cellCenter,
      polygon: openPoly,
      themeId: st.themeId,
    };
  });
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function createVoronoiLayout(input: VoronoiLayoutInput): VoronoiLayout {
  const centers = computeSubThemeCenters(input);
  const cells = computeWeightedVoronoi(centers, input.subThemes, input.options);

  return {
    cells: Object.freeze(cells),
    boundary: { width: input.options.mapWidth, height: input.options.mapHeight },
    version: `voronoi-${input.stage.id}`,
    stageId: input.stage.id,
  };
}
