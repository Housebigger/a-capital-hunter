# Gen4 Voronoi Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Gen3 grid-based map into a Voronoi-tiled country map with dynamic SubTheme areas and stock-level markers.

**Architecture:** New Voronoi layout engine replaces the grid-snap engine. SubTheme centers are relationship-weighted, then `d3-delaunay` generates Voronoi cells with iterative relaxation for area matching. Stocks render as cylinders within SubTheme polygon cells.

**Tech Stack:** React 19, TypeScript (strict), Three.js via @react-three/fiber + @react-three/drei, d3-delaunay (new), Vitest 3, Vite 6.

**Spec:** `docs/superpowers/specs/2026-06-10-a-capital-hunter-gen4-design.md`

---

## File Structure

### New Files
- `src/domain/stockRegistry.ts` — ~150-300 stock definitions
- `src/domain/stockRegistry.test.ts` — stock validation tests
- `src/domain/voronoiLayoutEngine.ts` — Voronoi layout engine (core algorithm)
- `src/domain/voronoiLayoutEngine.test.ts` — engine tests
- `src/domain/voronoiLayoutProvider.ts` — LayoutProvider using Voronoi engine
- `src/domain/voronoiLayoutProvider.test.ts` — provider tests

### Modified Files
- `src/domain/types.ts` — Stock, VoronoiCell, VoronoiLayout, StockRenderNode, SubTheme.areaWeight
- `src/domain/subThemeRegistry.ts` — areaWeight on all SubThemes
- `src/domain/renderNodes.ts` — buildStockRenderNodes
- `src/components/CapitalMapScene.tsx` — Voronoi plates + stock cylinders
- `src/components/InspectorPanel.tsx` — stock detail
- `src/components/ControlsPanel.tsx` — optional threshold slider
- `src/state/useHunterState.ts` — stock selection + threshold state
- `src/App.tsx` — switch to Voronoi pipeline

---

### Task 1: Install d3-delaunay

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install dependency**

```bash
npm install d3-delaunay
```

- [ ] **Step 2: Install types**

```bash
npm install -D @types/d3-delaunay
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(gen4): add d3-delaunay dependency"
```

---

### Task 2: Update Domain Types

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Add Stock interface**

```typescript
export interface Stock {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly subThemeId: string;
  readonly code: string;
}
```

- [ ] **Step 2: Add areaWeight to SubTheme**

Add `areaWeight` field to the existing `SubTheme` interface:

```typescript
export interface SubTheme {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly themeId: ThemeId;
  readonly displayOrder: number;
  readonly primarySectorId: SectorId;
  readonly areaWeight: number;  // NEW: 0-1, capital activity weight
}
```

- [ ] **Step 3: Add Voronoi types**

```typescript
export interface VoronoiCell {
  readonly subThemeId: string;
  readonly center: { readonly x: number; readonly z: number };
  readonly polygon: ReadonlyArray<{ readonly x: number; readonly z: number }>;
  readonly themeId: string;
}

export interface VoronoiLayout {
  readonly cells: ReadonlyArray<VoronoiCell>;
  readonly boundary: { readonly width: number; readonly height: number };
  readonly version: string;
  readonly stageId?: string;
}
```

- [ ] **Step 4: Add StockRenderNode**

```typescript
export interface StockRenderNode {
  readonly stock: Stock;
  readonly subTheme: SubTheme;
  readonly theme: Theme;
  readonly position: { readonly x: number; readonly z: number };
  readonly metric: NormalizedMetric;
  readonly visible: boolean;
  readonly cell?: VoronoiCell;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(gen4): add Stock, Voronoi types, areaWeight to SubTheme"
```

---

### Task 3: Update SubTheme Registry with areaWeight

**Files:**
- Modify: `src/domain/subThemeRegistry.ts`
- Modify: `src/domain/subThemeRegistry.test.ts`

- [ ] **Step 1: Add areaWeight test**

In `subThemeRegistry.test.ts`:

```typescript
it("every sub-theme has areaWeight between 0 and 1", () => {
  for (const st of subThemes) {
    expect(st.areaWeight, `SubTheme ${st.id} has invalid areaWeight`).toBeGreaterThanOrEqual(0);
    expect(st.areaWeight, `SubTheme ${st.id} has invalid areaWeight`).toBeLessThanOrEqual(1);
  }
});
```

- [ ] **Step 2: Add areaWeight to all 30 SubThemes**

Assign initial `areaWeight` values based on expected capital activity. Higher for major SubThemes, lower for niche ones. Example values:

- Core AI/tech SubThemes (ai-computing-infra, design-manufacturing): 0.8-0.9
- Secondary SubThemes (perception-layer, storage-battery): 0.5-0.7
- Niche SubThemes (traditional-medicine, charging-infra): 0.3-0.4

Each entry gains one field:
```typescript
{ id: "ai-computing-infra", ..., areaWeight: 0.85 },
```

- [ ] **Step 3: Run tests and commit**

Run: `npx vitest run src/domain/subThemeRegistry.test.ts`
Expected: PASS

```bash
git add src/domain/subThemeRegistry.ts src/domain/subThemeRegistry.test.ts
git commit -m "feat(gen4): add areaWeight to all SubThemes"
```

---

### Task 4: Create Stock Registry

**Files:**
- Create: `src/domain/stockRegistry.ts`
- Create: `src/domain/stockRegistry.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { stocks } from "./stockRegistry";
import { subThemes } from "./subThemeRegistry";

describe("stockRegistry", () => {
  it("has 150-300 stocks", () => {
    expect(stocks.length).toBeGreaterThanOrEqual(150);
    expect(stocks.length).toBeLessThanOrEqual(300);
  });

  it("every stock references a valid subThemeId", () => {
    const subThemeIds = new Set(subThemes.map((st) => st.id));
    for (const stock of stocks) {
      expect(subThemeIds.has(stock.subThemeId), `Stock ${stock.id} has invalid subThemeId ${stock.subThemeId}`).toBe(true);
    }
  });

  it("every sub-theme has at least 3 stocks", () => {
    const counts = new Map<string, number>();
    for (const stock of stocks) {
      counts.set(stock.subThemeId, (counts.get(stock.subThemeId) ?? 0) + 1);
    }
    for (const st of subThemes) {
      expect(counts.get(st.id) ?? 0, `SubTheme ${st.id} has fewer than 3 stocks`).toBeGreaterThanOrEqual(3);
    }
  });

  it("stocks are frozen", () => {
    expect(Object.isFrozen(stocks)).toBe(true);
  });
});
```

- [ ] **Step 2: Create stock registry**

Create `src/domain/stockRegistry.ts`. For each SubTheme, list 3-15 representative A-share stocks. Use real stock names/codes where possible. Stocks with higher `areaWeight` SubThemes get more entries.

Structure:
```typescript
import type { Stock } from "./types";

const freezeStock = (stock: Stock): Readonly<Stock> => Object.freeze(stock);

const stockConfig = [
  // AI算力基础设施 SubTheme stocks
  { id: "zq-kj", name: "中际旭创", shortName: "中际旭创", subThemeId: "ai-computing-infra", code: "300308.SZ" },
  { id: "xysx", name: "新易盛", shortName: "新易盛", subThemeId: "ai-computing-infra", code: "300502.SZ" },
  { id: "tszg", name: "天孚通信", shortName: "天孚通信", subThemeId: "ai-computing-infra", code: "300394.SZ" },
  // ... more stocks per SubTheme
] satisfies readonly Stock[];

export const stocks: readonly Readonly<Stock>[] = Object.freeze(stockConfig.map(freezeStock));
```

The full stock list should include 5-8 stocks for high-activity SubThemes and 3-4 for low-activity ones. Total: ~150-200 stocks.

- [ ] **Step 3: Run tests and commit**

Run: `npx vitest run src/domain/stockRegistry.test.ts`
Expected: PASS

```bash
git add src/domain/stockRegistry.ts src/domain/stockRegistry.test.ts
git commit -m "feat(gen4): add stock registry with ~200 representative stocks"
```

---

### Task 5: Create Voronoi Layout Engine

**Files:**
- Create: `src/domain/voronoiLayoutEngine.ts`
- Create: `src/domain/voronoiLayoutEngine.test.ts`

This is the core algorithm task. The engine takes SubTheme centers and areaWeights, produces Voronoi cells with area-proportional sizing.

- [ ] **Step 1: Write engine tests**

```typescript
import { describe, it, expect } from "vitest";
import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import { relationshipEdges } from "./relationshipRegistry";
import { layoutStages } from "./layoutStages";

describe("voronoiLayoutEngine", () => {
  const result = createVoronoiLayout({
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
  });

  it("produces one Voronoi cell per SubTheme", () => {
    expect(result.cells.length).toBe(subThemes.length);
  });

  it("is deterministic", () => {
    const result2 = createVoronoiLayout({
      subThemes, themes, relationshipEdges,
      stage: layoutStages[0],
      options: {
        mapWidth: 30, mapHeight: 22,
        relaxationIterations: 20, areaConvergenceThreshold: 0.05,
        provinceBorderGap: 0.15, cityBorderGap: 0.06,
      },
    });
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
      // Allow 10% tolerance for Voronoi approximation
      expect(Math.abs(areaRatio - weightRatio)).toBeLessThan(0.10);
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
```

- [ ] **Step 2: Implement Voronoi engine**

Create `src/domain/voronoiLayoutEngine.ts`. The engine has 4 phases:

```typescript
import { Delaunay } from "d3-delaunay";
import type { RelationshipEdge, SubTheme, Theme, LayoutStage, VoronoiCell, VoronoiLayout } from "./types";

interface VoronoiLayoutOptions {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly relaxationIterations: number;
  readonly areaConvergenceThreshold: number;
  readonly provinceBorderGap: number;
  readonly cityBorderGap: number;
}

interface VoronoiLayoutInput {
  readonly subThemes: readonly SubTheme[];
  readonly themes: readonly Theme[];
  readonly relationshipEdges: readonly RelationshipEdge[];
  readonly stage: LayoutStage;
  readonly options: VoronoiLayoutOptions;
}
```

**Phase 1 — SubTheme center positioning:**

```typescript
const computeSubThemeCenters = (
  input: VoronoiLayoutInput
): Map<string, { x: number; z: number }> => {
  // 1. Theme anchors: arranged radially but tighter than Gen3
  //    Use relationship pull to group related themes
  // 2. SubTheme offsets: around theme anchor, distance inversely proportional to areaWeight
  //    (higher areaWeight = closer to theme center = "provincial capital")
  // 3. Cross-theme relationship pull on SubTheme level
  // Returns: Map<subThemeId, Point>
};
```

**Phase 2 — Weighted Voronoi with iterative relaxation:**

```typescript
const computeWeightedVoronoi = (
  centers: Map<string, { x: number; z: number }>,
  subThemes: readonly SubTheme[],
  options: VoronoiLayoutOptions
): VoronoiCell[] => {
  const halfW = options.mapWidth / 2;
  const halfH = options.mapHeight / 2;

  let points = [...centers.values()];

  for (let iter = 0; iter < options.relaxationIterations; iter++) {
    // Generate Voronoi from current points
    const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.z);
    const voronoi = delaunay.voronoi([-halfW, -halfH, halfW, halfH]);

    // Compute cell areas
    const cells = [];
    for (let i = 0; i < points.length; i++) {
      const cellPolygon = voronoi.cellPolygon(i);
      if (!cellPolygon) continue;
      // Shoelace formula for area
      let area = 0;
      for (let j = 0; j < cellPolygon.length - 1; j++) {
        area += cellPolygon[j][0] * cellPolygon[j + 1][1];
        area -= cellPolygon[j + 1][0] * cellPolygon[j][1];
      }
      area = Math.abs(area / 2);
      cells.push({ index: i, area, polygon: cellPolygon });
    }

    // Compute target areas (proportional to areaWeight)
    const totalWeight = subThemes.reduce((s, st) => s + st.areaWeight, 0);
    const totalMapArea = options.mapWidth * options.mapHeight;

    // Adjust points toward/away from cell centroids based on area ratio
    let maxError = 0;
    const subThemeArray = [...subThemes];
    for (let i = 0; i < cells.length; i++) {
      const targetArea = (subThemeArray[i].areaWeight / totalWeight) * totalMapArea;
      const areaRatio = cells[i].area / targetArea;
      const error = Math.abs(areaRatio - 1);
      maxError = Math.max(maxError, error);

      // Move center toward cell centroid if too small, away if too large
      const cx = cells[i].polygon.reduce((s, p) => s + p[0], 0) / (cells[i].polygon.length - 1);
      const cz = cells[i].polygon.reduce((s, p) => s + p[1], 0) / (cells[i].polygon.length - 1);
      const dx = cx - points[i].x;
      const dz = cz - points[i].z;
      // Relaxation step: move 30% toward centroid if area too small
      const step = areaRatio < 1 ? 0.3 : -0.1;
      points[i] = { x: points[i].x + dx * step, z: points[i].z + dz * step };
    }

    if (maxError < options.areaConvergenceThreshold) break;
  }

  // Final Voronoi generation
  const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.z);
  const voronoi = delaunay.voronoi([-halfW, -halfH, halfW, halfH]);

  // Convert to VoronoiCell[] with inset for gaps
  return subThemeArray.map((st, i) => {
    const cellPoly = voronoi.cellPolygon(i);
    const poly = cellPoly
      ? cellPoly.slice(0, -1).map(([x, z]) => insetPoint(x, z, centers.get(st.id)!, options.cityBorderGap))
      : [];
    return {
      subThemeId: st.id,
      center: centers.get(st.id)!,
      polygon: poly,
      themeId: st.themeId,
    };
  });
};

// Inset a polygon vertex toward the cell center by gap amount
const insetPoint = (px: number, pz: number, center: { x: number; z: number }, gap: number) => {
  const dx = center.x - px;
  const dz = center.z - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < gap) return { x: px, z: pz };
  return {
    x: px + (dx / dist) * gap,
    z: pz + (dz / dist) * gap,
  };
};
```

**Phase 3 — Province border detection:**

After computing all cells, identify edges that separate different themes. These edges get a larger inset (provinceBorderGap). Cells sharing a border within the same theme only get cityBorderGap inset.

```typescript
const applyProvincialInsets = (cells: VoronoiCell[], options: VoronoiLayoutOptions): VoronoiCell[] => {
  // For each cell, check which neighbors are in different themes
  // Vertices along cross-theme borders get provinceBorderGap inset
  // Vertices along same-theme borders get cityBorderGap inset
  // This is done by identifying shared edges between cells
};
```

**Phase 4 — Stock positioning:**

```typescript
const positionStocks = (
  cell: VoronoiCell,
  stocksInSubTheme: readonly Stock[],
  maxStocks: number
): Array<{ stock: Stock; x: number; z: number }> => {
  // Place largest stock at cell center
  // Remaining stocks in a spiral/ring pattern outward
  // Keep all positions within cell polygon bounds
};
```

**Main export:**

```typescript
export function createVoronoiLayout(input: VoronoiLayoutInput): VoronoiLayout {
  const centers = computeSubThemeCenters(input);
  const cells = computeWeightedVoronoi(centers, input.subThemes, input.options);
  const cellsWithProvincialInsets = applyProvincialInsets(cells, input.options);

  return {
    cells: cellsWithProvincialInsets,
    boundary: { width: input.options.mapWidth, height: input.options.mapHeight },
    version: `voronoi-${input.stage.id}`,
    stageId: input.stage.id,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/domain/voronoiLayoutEngine.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/voronoiLayoutEngine.ts src/domain/voronoiLayoutEngine.test.ts
git commit -m "feat(gen4): Voronoi layout engine with weighted area relaxation"
```

---

### Task 6: Create Voronoi Layout Provider

**Files:**
- Create: `src/domain/voronoiLayoutProvider.ts`
- Create: `src/domain/voronoiLayoutProvider.test.ts`

- [ ] **Step 1: Implement provider**

```typescript
import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { layoutStages, getLayoutStageById } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import type { VoronoiLayout } from "./types";

export interface VoronoiLayoutProvider {
  getLayout(stageId?: string): VoronoiLayout;
}

export function createVoronoiLayoutProvider(): VoronoiLayoutProvider {
  return {
    getLayout: (stageId) => {
      const stage = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      return createVoronoiLayout({
        subThemes,
        themes,
        relationshipEdges,
        stage,
        options: {
          mapWidth: 30,
          mapHeight: 22,
          relaxationIterations: 20,
          areaConvergenceThreshold: 0.05,
          provinceBorderGap: 0.15,
          cityBorderGap: 0.06,
        },
      });
    },
  };
}
```

- [ ] **Step 2: Write basic tests**

```typescript
it("returns a VoronoiLayout with correct cell count", () => {
  const provider = createVoronoiLayoutProvider();
  const layout = provider.getLayout();
  expect(layout.cells.length).toBe(subThemes.length);
  expect(layout.boundary.width).toBe(30);
  expect(layout.boundary.height).toBe(22);
});

it("is deterministic across calls", () => {
  const provider = createVoronoiLayoutProvider();
  const a = provider.getLayout();
  const b = provider.getLayout();
  expect(a.cells).toEqual(b.cells);
});
```

- [ ] **Step 3: Run tests and commit**

```bash
git add src/domain/voronoiLayoutProvider.ts src/domain/voronoiLayoutProvider.test.ts
git commit -m "feat(gen4): Voronoi layout provider"
```

---

### Task 7: Update Render Nodes for Stocks

**Files:**
- Modify: `src/domain/renderNodes.ts`

- [ ] **Step 1: Add buildStockRenderNodes function**

Add a new function that takes VoronoiLayout + stock data + scenario → StockRenderNode[]:

```typescript
import { stocks } from "./stockRegistry";
import { subThemes } from "./subThemeRegistry";
import type { VoronoiLayout, StockRenderNode, MarketScenario, ThemeFilter, CapitalStateFilter } from "./types";

interface BuildStockRenderNodesInput {
  layout: VoronoiLayout;
  scenario: MarketScenario;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  capitalThreshold?: number;
}

export function buildStockRenderNodes(input: BuildStockRenderNodesInput): StockRenderNode[] {
  // For each Voronoi cell, find its stocks
  // Filter by threshold, theme, capital state
  // Position stocks within cell bounds
  // Return StockRenderNode[]
}
```

- [ ] **Step 2: Run tests and commit**

```bash
git add src/domain/renderNodes.ts
git commit -m "feat(gen4): add buildStockRenderNodes for stock-level rendering"
```

---

### Task 8: Update CapitalMapScene for Voronoi Rendering

**Files:**
- Modify: `src/components/CapitalMapScene.tsx`

This replaces the Gen3 TerrainPlane + box rendering with Voronoi polygon plates + stock cylinders.

- [ ] **Step 1: Add Voronoi cell renderer**

Replace `TerrainPlane` with a component that renders each Voronoi cell as a polygon base plate:

```typescript
function VoronoiPlate({ cell, themeColor, opacity }: { cell: VoronoiCell; themeColor: string; opacity: number }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(cell.polygon[0].x - cell.center.x, cell.polygon[0].z - cell.center.z);
    for (let i = 1; i < cell.polygon.length; i++) {
      s.lineTo(cell.polygon[i].x - cell.center.x, cell.polygon[i].z - cell.center.z);
    }
    s.closePath();
    return s;
  }, [cell]);

  return (
    <mesh position={[cell.center.x, 0, cell.center.z]} receiveShadow>
      <extrudeGeometry args={[shape, { depth: 0.08, bevelEnabled: false }]} />
      <meshStandardMaterial color={themeColor} opacity={opacity} transparent roughness={0.75} />
    </mesh>
  );
}
```

- [ ] **Step 2: Add stock cylinder renderer**

```typescript
function StockMarker({ node }: { node: StockRenderNode }) {
  const height = Math.max(Math.abs(node.metric.height), 0.08);
  return (
    <group position={[node.position.x, 0.04, node.position.z]}>
      <mesh castShadow visible={node.visible}>
        <cylinderGeometry args={[0.12, 0.12, height, 8]} />
        <meshStandardMaterial color={node.metric.color} opacity={node.metric.intensity} transparent emissive={node.metric.color} emissiveIntensity={0.04} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 3: Update main scene render**

Replace the existing node loop with:
1. Render all Voronoi cell plates (grouped by theme for coloring)
2. Render province border lines (theme outlines)
3. Render stock markers within cells
4. Render labels for themes and SubThemes

- [ ] **Step 4: Update camera positions**

```typescript
const cameraPositions = {
  angled: [18, 18, 22],
  top: [0, 28, 0.1],
  side: [24, 9, 0],
};
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat(gen4): Voronoi polygon base plates + stock cylinder markers"
```

---

### Task 9: Update InspectorPanel

**Files:**
- Modify: `src/components/InspectorPanel.tsx`

- [ ] **Step 1: Add stock detail display**

When a stock is selected (passed as a new `selectedStock` prop), show:
- Stock name + code
- SubTheme and Theme membership
- Capital flow direction and volume

- [ ] **Step 2: Add SubTheme area info**

When a SubTheme area is clicked (no stock selected):
- Show areaWeight and area proportion
- Show qualifying stock count

- [ ] **Step 3: Commit**

```bash
git add src/components/InspectorPanel.tsx
git commit -m "feat(gen4): stock detail and SubTheme area info in inspector"
```

---

### Task 10: Update State and ControlsPanel

**Files:**
- Modify: `src/state/useHunterState.ts`
- Modify: `src/components/ControlsPanel.tsx`

- [ ] **Step 1: Add stock selection and threshold state**

In `useHunterState.ts`:

```typescript
const [selectedStockId, setSelectedStockId] = useState<string | undefined>();
const [capitalThreshold, setCapitalThreshold] = useState(20); // default threshold in 亿
```

- [ ] **Step 2: Add optional threshold slider to ControlsPanel**

Add a range input for capital threshold (optional, can be a separate section):

```typescript
<label>
  <span>资金门槛</span>
  <input type="range" min="5" max="50" value={capitalThreshold} onChange={(e) => onCapitalThresholdChange(Number(e.target.value))} />
  <span>{capitalThreshold}亿</span>
</label>
```

- [ ] **Step 3: Commit**

```bash
git add src/state/useHunterState.ts src/components/ControlsPanel.tsx
git commit -m "feat(gen4): stock selection state and capital threshold slider"
```

---

### Task 11: Wire Up App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Switch to Voronoi pipeline**

Replace `createAlgorithmicLayoutProvider` with `createVoronoiLayoutProvider`. Replace `buildRenderNodes` with `buildStockRenderNodes`. Pass new props to scene and panels.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual verification**

Run: `npm run dev`
Open `http://localhost:5173` and verify:
- Voronoi polygon base plates visible
- Province borders (theme outlines) visible
- Stock cylinders within cells
- Click SubTheme → focus mode
- Inspector shows stock/subtheme detail

- [ ] **Step 5: Final commit**

```bash
git add src/App.tsx
git commit -m "feat(gen4): wire up Voronoi pipeline, complete Gen4 implementation"
```
