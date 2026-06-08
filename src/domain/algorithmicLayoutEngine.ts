import type {
  LayoutExplanation,
  LayoutStage,
  RelationshipEdge,
  Sector,
  SectorLayout,
  Theme
} from "./types";

interface LayoutOptions {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly maxStageShift: number;
  readonly centerPullStrength: number;
}

interface AlgorithmicLayoutInput {
  readonly themes: readonly Readonly<Theme>[];
  readonly sectors: readonly Readonly<Sector>[];
  readonly relationshipEdges: readonly RelationshipEdge[];
  readonly stage: LayoutStage;
  readonly previousStage?: LayoutStage;
  readonly options: LayoutOptions;
}

interface AlgorithmicLayoutResult {
  readonly layout: SectorLayout;
  readonly explanations: Readonly<Record<string, LayoutExplanation>>;
}

interface Point {
  readonly x: number;
  readonly z: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

const themeAnchor = (index: number, count: number, stageHeat: number, options: LayoutOptions): Point => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const baseRadius = 5.2;
  const inwardShift = clamp(stageHeat, 0, 1) * (options.centerPullStrength + options.maxStageShift);
  const radius = Math.max(2.4, baseRadius - inwardShift);
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  };
};

const sectorOffset = (index: number, count: number): Point => {
  if (index === 0) return { x: 0, z: 0 };
  const ring = Math.ceil(index / 6);
  const angle = (Math.PI * 2 * (index - 1)) / Math.max(1, count - 1);
  return {
    x: Math.cos(angle) * ring * 1.1,
    z: Math.sin(angle) * ring * 1.1
  };
};

const relationPull = (
  sector: Readonly<Sector>,
  edges: readonly RelationshipEdge[],
  anchorsByTheme: ReadonlyMap<string, Point>,
  sectorsById: ReadonlyMap<string, Readonly<Sector>>
): Point => {
  const related = edges
    .filter((edge) => edge.sourceSectorId === sector.id || edge.targetSectorId === sector.id)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  if (related.length === 0) return { x: 0, z: 0 };

  let x = 0;
  let z = 0;
  let total = 0;

  for (const edge of related) {
    const otherId = edge.sourceSectorId === sector.id ? edge.targetSectorId : edge.sourceSectorId;
    const other = sectorsById.get(otherId);
    if (!other) continue;
    const anchor = anchorsByTheme.get(other.primaryThemeId);
    if (!anchor) continue;
    x += anchor.x * edge.weight;
    z += anchor.z * edge.weight;
    total += edge.weight;
  }

  if (total === 0) return { x: 0, z: 0 };

  return {
    x: (x / total) * 0.18,
    z: (z / total) * 0.18
  };
};

const snapToGrid = (
  desired: readonly { sector: Readonly<Sector>; point: Point; strength: 1 | 2 | 3 }[],
  options: LayoutOptions
) => {
  const occupied = new Set<string>();
  const sorted = [...desired].sort((a, b) => {
    if (a.sector.isThemeCenter !== b.sector.isThemeCenter) return a.sector.isThemeCenter ? -1 : 1;
    return a.sector.id.localeCompare(b.sector.id);
  });

  return sorted.map(({ sector, point, strength }) => {
    let best: Point | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    const halfWidth = Math.floor(options.gridWidth / 2);
    const halfHeight = Math.floor(options.gridHeight / 2);

    for (let x = -halfWidth; x <= halfWidth; x += 1) {
      for (let z = -halfHeight; z <= halfHeight; z += 1) {
        const key = `${x},${z}`;
        if (occupied.has(key)) continue;
        const candidate = { x, z };
        const distance = manhattan(candidate, point);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }

    if (!best) {
      throw new Error(`No grid cell available for ${sector.id}`);
    }

    occupied.add(`${best.x},${best.z}`);
    return {
      sectorId: sector.id,
      x: best.x,
      z: best.z,
      role: sector.isThemeCenter ? "theme-center" : "related-sector",
      relationshipStrength: strength
    } as const;
  });
};

const buildExplanations = (
  sectors: readonly Readonly<Sector>[],
  edges: readonly RelationshipEdge[],
  stage: LayoutStage
): Record<string, LayoutExplanation> => {
  const explanations: Record<string, LayoutExplanation> = {};

  for (const sector of sectors) {
    const reasons = edges
      .filter((edge) => edge.sourceSectorId === sector.id || edge.targetSectorId === sector.id)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((edge) => ({
        relatedSectorId: edge.sourceSectorId === sector.id ? edge.targetSectorId : edge.sourceSectorId,
        relationshipType: edge.type,
        weight: edge.weight,
        note: edge.note,
        stageInfluenced: (stage.sectorHeat[sector.id] ?? 0) >= 0.55
      }));

    explanations[sector.id] = {
      sectorId: sector.id,
      summary:
        reasons.length > 0
          ? `靠近 ${reasons[0].relatedSectorId}，主要因为${reasons[0].note}。`
          : "主题中心锚定在本阶段的基础位置。",
      reasons
    };
  }

  return explanations;
};

export function createAlgorithmicLayout(input: AlgorithmicLayoutInput): AlgorithmicLayoutResult {
  const anchorsByTheme = new Map(
    input.themes.map((theme, index) => [
      theme.id,
      themeAnchor(index, input.themes.length, input.stage.themeHeat[theme.id] ?? 0.2, input.options)
    ])
  );
  const sectorsById = new Map(input.sectors.map((sector) => [sector.id, sector]));
  const sectorIndexByTheme = new Map<string, number>();

  const desired = input.sectors.map((sector) => {
    const themePosition = anchorsByTheme.get(sector.primaryThemeId) ?? { x: 0, z: 0 };
    const localIndex = sectorIndexByTheme.get(sector.primaryThemeId) ?? 0;
    sectorIndexByTheme.set(sector.primaryThemeId, localIndex + 1);
    const offset = sectorOffset(
      localIndex,
      input.sectors.filter((candidate) => candidate.primaryThemeId === sector.primaryThemeId).length
    );
    const pull = relationPull(sector, input.relationshipEdges, anchorsByTheme, sectorsById);
    const heat = input.stage.sectorHeat[sector.id] ?? 0.2;

    return {
      sector,
      point: {
        x: themePosition.x + offset.x + pull.x - heat * 0.25,
        z: themePosition.z + offset.z + pull.z - heat * 0.25
      },
      strength: (heat >= 0.8 ? 3 : heat >= 0.5 ? 2 : 1) as 1 | 2 | 3
    };
  });

  const cells = snapToGrid(desired, input.options);
  const previousCells = input.previousStage
    ? createAlgorithmicLayout({ ...input, stage: input.previousStage, previousStage: undefined }).layout.cells
    : [];
  const previousById = new Map(previousCells.map((cell) => [cell.sectorId, cell]));
  const cellsWithPrevious = cells.map((cell) => {
    const previous = previousById.get(cell.sectorId);
    return previous ? { ...cell, previousPosition: { x: previous.x, z: previous.z } } : cell;
  });
  const explanations = buildExplanations(input.sectors, input.relationshipEdges, input.stage);

  return {
    layout: {
      cells: cellsWithPrevious,
      version: `algorithmic-${input.stage.id}`,
      stageId: input.stage.id,
      explanations
    },
    explanations
  };
}
