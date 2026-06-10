# A Capital Hunter Fourth-Generation Design Spec

Date: 2026-06-10

## Product Intent

Gen4 transforms the map from a sparse grid of square cells into a tight, Voronoi-tiled country map. SubTheme areas become organic polygonal regions sized by capital activity, and individual stocks appear as markers within each SubTheme cell.

Gen4 validates three upgrades:

- Replace the grid-snap layout with a weighted Voronoi (power diagram) engine for natural, adjacency-driven region shapes.
- Introduce a stock-level data layer beneath SubThemes, with capital-flow thresholds determining which stocks appear.
- Make SubTheme area sizes dynamic — proportional to capital activity and the number of qualifying stocks.

## Chosen Direction

**Voronoi-based map engine (方案 A):** Use `d3-delaunay` to compute Voronoi diagrams from SubTheme center points. Iterative relaxation adjusts cell sizes to match `areaWeight` targets. Pure-function domain layer, deterministic, explainable.

## Scope

Gen4 includes:

- A Voronoi layout engine using `d3-delaunay` with weighted area allocation via iterative relaxation.
- A stock data model and registry (~150-300 stocks) with capital-flow thresholds.
- Dynamic SubTheme area sizing driven by capital activity.
- Voronoi cell rendering as polygon base plates with provincial/city border gaps.
- Stock marker rendering (small cylinders) within SubTheme cells.
- UI panel updates for stock-level detail and optional threshold control.

Gen4 does not include:

- Real-time stock quote refresh.
- Full A-share market coverage (all ~5000 stocks).
- User-authored stock selection.
- Public-data adapter implementation.

## Data Model

### Stock Type

```typescript
interface Stock {
  readonly id: string;           // e.g. "300750"
  readonly name: string;        // e.g. "宁德时代"
  readonly shortName: string;   // e.g. "宁德时代"
  readonly subThemeId: string;  // parent SubTheme
  readonly code: string;        // e.g. "300750.SZ"
}
```

### SubTheme Update

```typescript
interface SubTheme {
  // ... existing fields ...
  readonly areaWeight: number;  // 0-1, capital activity weight, determines Voronoi cell area
}
```

`areaWeight` is data-driven: more qualifying stocks and higher capital flow volume → higher weight. Initial version uses simulated data; interface preserves real data source swap.

### Voronoi Layout Output

```typescript
interface VoronoiCell {
  readonly subThemeId: string;
  readonly center: { readonly x: number; readonly z: number };
  readonly polygon: ReadonlyArray<{ readonly x: number; readonly z: number }>;
  readonly themeId: string;
}

interface VoronoiLayout {
  readonly cells: ReadonlyArray<VoronoiCell>;
  readonly boundary: { readonly width: number; readonly height: number };
  readonly version: string;
  readonly stageId?: string;
}
```

### Stock Render Node

```typescript
interface StockRenderNode {
  readonly stock: Stock;
  readonly subTheme: SubTheme;
  readonly theme: Theme;
  readonly position: { readonly x: number; readonly z: number };
  readonly metric: NormalizedMetric;
  readonly visible: boolean;
  readonly cell?: VoronoiCell;
}
```

### Capital Flow Threshold

Stocks appear on the map only when their capital flow volume exceeds a preset threshold. Threshold is a configurable constant, adjustable via UI slider (optional). Initial threshold set by `scenarioDataProvider`.

### Data Scale

- SubThemes: ~30 (unchanged from Gen3)
- Qualifying stocks per SubTheme: 3-15 (capital activity determines)
- Total stocks on map: ~150-300
- Relationship edges: ~179 (unchanged from Gen3)

## Voronoi Layout Engine

### Algorithm (4 Steps)

**Step 1: SubTheme center positioning**

Relationship-weighted positioning at SubTheme granularity:

1. Theme anchors: 11 anchors arranged by relationship proximity (closely related themes near each other). Tighter grouping than Gen3.
2. SubTheme offsets: Each SubTheme positioned around its theme anchor. Higher `areaWeight` SubThemes sit closer to theme center (as "provincial capitals").
3. Relationship pull: All 5 relationship types participate. Stronger cross-theme relationships pull SubTheme centers closer together.

**Step 2: Weighted Voronoi (Power Diagram)**

Use `d3-delaunay` to generate Voronoi diagram. Area allocation via iterative relaxation:

1. Compute current Voronoi cell areas.
2. Compare against target areas (proportional to `areaWeight`).
3. Move center points outward/inward to adjust.
4. Regenerate Voronoi.
5. Convergence: area error < 5%.

Relaxation iterations: 15-20 rounds.

**Step 3: Theme region merging**

All SubTheme Voronoi cells within the same theme merge into a continuous region. After merging:

- SubTheme boundaries: 0.06 unit gap (city borders).
- Theme boundaries: 0.15 unit gap (provincial borders).
- Visual effect: complete jigsaw map.

Gap rendering: polygon vertices inset inward, not separate border lines.

**Step 4: Stock positioning**

Within each SubTheme's Voronoi cell, qualifying stocks arrange by capital flow volume:

- Largest stock at cell center.
- Remaining stocks arranged compactly around center.
- Spacing determined by SubTheme cell area.

### Engine Parameters

| Parameter | Value | Notes |
| --- | --- | --- |
| mapWidth | 30 | larger than Gen3 (22) to accommodate stocks |
| mapHeight | 22 | larger than Gen3 (16) |
| relaxationIterations | 15-20 | balance precision vs performance |
| areaConvergenceThreshold | 5% | stop when area error below this |
| provinceBorderGap | 0.15 | theme boundary gap |
| cityBorderGap | 0.06 | SubTheme boundary gap |

### Engine Requirements

- Deterministic: identical input produces identical output.
- Explainable: each SubTheme position has a reason.
- Compatible: output feeds rendering pipeline.
- New: area allocation respects `areaWeight` proportions.

### New Dependency

```bash
npm install d3-delaunay
```

`d3-delaunay` — pure JS, zero dependencies, ~10KB gzip. Only Delaunay triangulation and Voronoi diagram computation.

## 3D Scene

### Voronoi Base Plates

Each SubTheme rendered as an `ExtrudeGeometry` or `ShapeGeometry` polygon:

- Thickness: 0.08 units (thin floor tile).
- Color: inherits theme color, opacity 0.3-0.4.
- Gaps: inset polygon vertices for city (0.06) and province (0.15) borders.

### Province Border Lines

Theme region outer contours rendered as `LineSegments`:
- Color: theme color + 30% brightness boost.
- Line width: 1.5 units.
- Visual effect: provincial border highlight.

### Stock Markers

Each qualifying stock rendered as a small cylinder:
- Diameter: 0.25 units.
- Height: determined by capital flow volume (reuses `metricNormalizer`).
- Color: red=inflow, green=outflow, gray=flat.
- Labels: default shows only top 3 stock names per SubTheme; focus mode shows all.

### Theme and SubTheme Labels

- Theme labels: positioned at weighted centroid of all SubTheme cells, fontSize 0.28, white with glow.
- SubTheme labels: at Voronoi cell center, fontSize 0.18, light gray.

### Focus Mode

- Click SubTheme area → all stocks in that SubTheme show labels.
- Other SubThemes dim to opacity 0.15.
- Click elsewhere or another SubTheme to exit.
- Reuses Gen3 `focusSubThemeId` state.

### Camera

Map expands to 30×22. Camera positions:

```typescript
const cameraPositions = {
  angled: [18, 18, 22],
  top: [0, 28, 0.1],
  side: [24, 9, 0]
};
```

## UI Panels

### InspectorPanel

- Click stock → stock detail (code, name, capital flow direction/volume, SubTheme, theme, area proportion).
- Click SubTheme area (not stock) → SubTheme detail (name, theme, qualifying stock count, areaWeight, relationship list with 5 colored types).

### ControlsPanel

- Optional: capital flow threshold slider — lower threshold shows more stocks per SubTheme.
- Retains Gen3: 11 theme filter + 5 stage selector.

## Data Pipeline

```
registries (themes + subThemes + sectors + stocks)
        ↓
voronoiLayoutEngine.getLayout(stageId) → VoronoiLayout
        ↓
buildStockRenderNodes(layout, scenario, filters) → StockRenderNode[]
        ↓
CapitalMapScene
```

## Architecture

### New Files

| File | Responsibility |
| --- | --- |
| `src/domain/stockRegistry.ts` | Stock definitions (simulated data) |
| `src/domain/voronoiLayoutEngine.ts` | Voronoi layout engine |
| `src/domain/voronoiLayoutProvider.ts` | Voronoi LayoutProvider implementation |

### Modified Files

| File | Change |
| --- | --- |
| `src/domain/types.ts` | Add Stock, VoronoiCell, VoronoiLayout, StockRenderNode |
| `src/domain/subThemeRegistry.ts` | Add areaWeight field |
| `src/domain/renderNodes.ts` | Add buildStockRenderNodes |
| `src/components/CapitalMapScene.tsx` | Voronoi plates + stock cylinders |
| `src/components/InspectorPanel.tsx` | Stock detail display |
| `src/components/ControlsPanel.tsx` | Optional threshold slider |
| `src/state/useHunterState.ts` | Stock selection state, threshold state |
| `src/App.tsx` | Switch to Voronoi pipeline |

### Unchanged

- Data flow architecture (unidirectional).
- Domain layer purity (zero React imports).
- 5 relationship types with colored labels.
- Focus mode interaction.
- Testing strategy.

## Testing And Acceptance Criteria

### Data Tests

- SubTheme count approximately 30.
- Stock count in range 150-300.
- Every stock references a valid SubTheme.
- Every SubTheme has areaWeight in [0, 1].
- areaWeight sums are approximately proportional across SubThemes.

### Algorithm Tests

- Same input produces same Voronoi cells every run (determinism).
- Every SubTheme receives exactly one Voronoi cell.
- No two Voronoi cells overlap (except at boundaries).
- Voronoi cell areas are approximately proportional to areaWeight (within 5% convergence).
- SubThemes within the same theme form contiguous regions.
- Stocks are positioned within their SubTheme's Voronoi cell bounds.
- Iterative relaxation converges within 20 iterations.

### UI Tests

- Clicking a stock shows stock detail in inspector.
- Clicking a SubTheme area shows SubTheme detail.
- Focus mode expands stock labels in focused SubTheme.
- Theme filter and stage selector work with Voronoi layout.

### Visual Tests

- 3D scene renders Voronoi polygon base plates, not square cells.
- Province borders (theme boundaries) visible as brighter outlines.
- City borders (SubTheme boundaries) visible as thin gaps.
- Stock cylinders visible within SubTheme cells.
- Multi-theme capital peaks remain distinguishable.

## Success Definition

Gen4 is successful when a user opens the website and sees a country-map-like surface where theme regions are provinces with natural borders, SubTheme areas are organically shaped city regions sized by capital activity, and individual stock markers sit within their SubTheme cells. The map feels like a geographic landscape of capital flow, not a grid of boxes.
