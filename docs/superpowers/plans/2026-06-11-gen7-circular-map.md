# Gen7 Circular Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the rectangular map into a circular map by clipping Voronoi cells to a circle, eliminating wasted peripheral space.

**Architecture:** Add a `clipPolygonToCircle` utility shared by both engines. Each engine computes Voronoi within square bounds inscribed in the circle, then clips every cell polygon to the circle boundary. Theme centers redistribute radially to fill the circle evenly.

**Tech Stack:** d3-delaunay, Three.js, TypeScript

---

### Task 1: Create circle clipping utility with tests

**Files:**
- Create: `src/domain/circleClip.ts`
- Create: `src/domain/circleClip.test.ts`

This utility clips a polygon to a circle using Sutherland-Hodgman algorithm adapted for circular boundaries.

- [ ] **Step 1: Write tests**

```typescript
// src/domain/circleClip.test.ts
import { describe, it, expect } from "vitest";
import { clipPolygonToCircle, isInsideCircle } from "./circleClip";

describe("circleClip", () => {
  it("keeps polygon fully inside circle unchanged", () => {
    const poly = [
      { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    expect(result.length).toBe(4);
  });

  it("clips polygon that extends outside circle", () => {
    const poly = [
      { x: 10, z: 0 }, { x: 0, z: 10 }, { x: -10, z: 0 }, { x: 0, z: -10 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    // All vertices must be inside or on circle
    for (const p of result) {
      expect(Math.sqrt(p.x * p.x + p.z * p.z)).toBeLessThanOrEqual(5.01);
    }
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty for polygon entirely outside circle", () => {
    const poly = [
      { x: 20, z: 20 }, { x: 22, z: 20 }, { x: 22, z: 22 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    expect(result.length).toBe(0);
  });

  it("handles polygon at circle edge", () => {
    const poly = [
      { x: 5, z: 0 }, { x: 0, z: 5 }, { x: -5, z: 0 }, { x: 0, z: -5 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    expect(result.length).toBe(4);
  });

  it("isInsideCircle works correctly", () => {
    expect(isInsideCircle({ x: 0, z: 0 }, 5)).toBe(true);
    expect(isInsideCircle({ x: 4, z: 0 }, 5)).toBe(true);
    expect(isInsideCircle({ x: 5, z: 0 }, 5)).toBe(true); // on boundary
    expect(isInsideCircle({ x: 6, z: 0 }, 5)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/circleClip.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement circleClip**

```typescript
// src/domain/circleClip.ts
interface Point2D {
  readonly x: number;
  readonly z: number;
}

export function isInsideCircle(p: Point2D, radius: number): boolean {
  return p.x * p.x + p.z * p.z <= radius * radius;
}

/** Intersect line segment A→B with circle boundary, return intersection point. */
function intersectLineCircle(
  a: Point2D,
  b: Point2D,
  radius: number
): Point2D {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const aCoeff = dx * dx + dz * dz;
  const bCoeff = 2 * (a.x * dx + a.z * dz);
  const cCoeff = a.x * a.x + a.z * a.z - radius * radius;
  const disc = bCoeff * bCoeff - 4 * aCoeff * cCoeff;
  if (disc < 0 || aCoeff === 0) return a;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-bCoeff - sqrtDisc) / (2 * aCoeff);
  const t2 = (-bCoeff + sqrtDisc) / (2 * aCoeff);
  // Pick the t in [0, 1] closest to the inside point
  for (const t of [t1, t2]) {
    if (t >= 0 && t <= 1) {
      return { x: a.x + t * dx, z: a.z + t * dz };
    }
  }
  return a;
}

/**
 * Sutherland-Hodgman clip of a polygon to a circle centered at origin.
 * Returns the clipped polygon vertices (may be empty if fully outside).
 */
export function clipPolygonToCircle(
  polygon: ReadonlyArray<Point2D>,
  radius: number
): Array<{ x: number; z: number }> {
  if (polygon.length < 3) return [];

  let output: Array<{ x: number; z: number }> = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currentInside = isInsideCircle(current, radius);
    const nextInside = isInsideCircle(next, radius);

    if (currentInside) {
      output.push({ x: current.x, z: current.z });
    }

    if (currentInside !== nextInside) {
      const intersection = intersectLineCircle(current, next, radius);
      output.push(intersection);
    }
  }

  return output;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/circleClip.test.ts`
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/circleClip.ts src/domain/circleClip.test.ts
git commit -m "feat: add circle clipping utility for Gen7 circular map"
```

---

### Task 2: Update P1 theme-level engine to use circular boundary

**Files:**
- Modify: `src/domain/themeVoronoiLayoutEngine.ts`

**Context:** The engine currently uses `mapWidth`/`mapHeight` for rectangular bounds. Change to use `mapRadius` for circular bounds. d3-delaunay only supports rectangular bounds, so we compute Voronoi in the inscribed square then clip each cell to the circle.

- [ ] **Step 1: Update options type**

In `themeVoronoiLayoutEngine.ts`, change `ThemeLayoutOptions`:
```typescript
export interface ThemeLayoutOptions {
  readonly mapRadius: number;
  readonly borderGap: number;
}
```

Change `ThemeVoronoiLayout.boundary`:
```typescript
export interface ThemeVoronoiLayout {
  readonly cells: ReadonlyArray<ThemeCell>;
  readonly boundary: { readonly radius: number };
}
```

- [ ] **Step 2: Update engine internals**

Replace all `options.mapWidth` / `options.mapHeight` / `halfW` / `halfH` with `options.mapRadius`:

1. Add import: `import { clipPolygonToCircle } from "./circleClip";`

2. In `computeThemeCenters`, replace the radius calculation:
```typescript
const baseRadius = options.mapRadius * 0.6;
```

3. In `computeThemeVoronoi`, use square inscribed in circle for d3 bounds, then clip:
```typescript
const computeThemeVoronoi = (
  centers: Point[],
  options: ThemeLayoutOptions
): ThemeCell[] => {
  const r = options.mapRadius;
  // d3-delaunay needs rectangular bounds — use inscribed square
  const delaunay = Delaunay.from(centers, (p) => p.x, (p) => p.z);
  const voronoi = delaunay.voronoi([-r, -r, r, r]);

  return centers.map((center, i) => {
    const cellPoly = voronoi.cellPolygon(i);
    if (!cellPoly || cellPoly.length < 4) {
      return { themeId: `theme-${i}`, center, polygon: [] as ThemeCell["polygon"] };
    }

    // Convert d3 polygon to our format, apply border inset
    const rawPoly: Array<{ x: number; z: number }> = [];
    for (let j = 0; j < cellPoly.length - 1; j++) {
      const vx = cellPoly[j][0];
      const vz = cellPoly[j][1];
      rawPoly.push(insetPoint(vx, vz, center, options.borderGap));
    }

    // Clip to circle
    const clipped = clipPolygonToCircle(rawPoly, r);
    if (clipped.length < 3) {
      return { themeId: `theme-${i}`, center, polygon: [] };
    }

    return { themeId: `theme-${i}`, center, polygon: clipped };
  });
};
```

4. Update `createThemeVoronoiLayout` return value:
```typescript
return {
  cells: Object.freeze(cells),
  boundary: { radius: input.options.mapRadius },
};
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All pass (theme engine has no test file yet, other tests unaffected)

- [ ] **Step 3: Commit**

```bash
git add src/domain/themeVoronoiLayoutEngine.ts
git commit -m "feat: theme-level engine uses circular boundary"
```

---

### Task 3: Update P2 sub-theme engine to use circular boundary

**Files:**
- Modify: `src/domain/voronoiLayoutEngine.ts`

**Context:** Same approach as Task 2 but for the sub-theme Voronoi engine with relaxation. Add circle clipping after the relaxation loop completes and polygons are built.

- [ ] **Step 1: Update options and imports**

Add import at top: `import { clipPolygonToCircle } from "./circleClip";`

Change `VoronoiLayoutOptions` — add `mapRadius`:
```typescript
export interface VoronoiLayoutOptions {
  readonly mapRadius: number;
  readonly relaxationIterations: number;
  readonly areaConvergenceThreshold: number;
  readonly provinceBorderGap: number;
  readonly cityBorderGap: number;
}
```

Remove `mapWidth` and `mapHeight` from the interface.

- [ ] **Step 2: Update computeSubThemeCenters**

Replace `halfW`/`halfH` with `mapRadius`:
```typescript
const halfR = options.mapRadius;
const baseRadius = halfR * 0.55;
```

- [ ] **Step 3: Update computeWeightedVoronoi**

Replace all `halfW`/`halfH` with `options.mapRadius`:
```typescript
const r = options.mapRadius;
// d3 bounds = inscribed square
const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.z);
const voronoi = delaunay.voronoi([-r, -r, r, r]);
```

After building the `openPoly` with inset, clip to circle:
```typescript
// After: openPoly.push(insetPoint(vx, vz, cellCenter, maxGap));
// ... close of the for loop over vertices ...

// Clip to circle
const clipped = clipPolygonToCircle(openPoly, r);
return {
  subThemeId: st.id,
  center: cellCenter,
  polygon: clipped.length >= 3 ? clipped : [],
  themeId: st.themeId,
};
```

- [ ] **Step 4: Update VoronoiLayout boundary**

```typescript
return {
  cells: Object.freeze(cells),
  boundary: { radius: input.options.mapRadius },
  version: `voronoi-${input.stage.id}`,
  stageId: input.stage.id,
};
```

Also update the `VoronoiLayout` type in `types.ts`:
```typescript
interface VoronoiLayout {
  readonly cells: ReadonlyArray<VoronoiCell>;
  readonly boundary: { readonly radius: number };
  readonly version: string;
  readonly stageId?: LayoutStageId;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/domain/voronoiLayoutEngine.test.ts`
Expected: boundary test may need update (no longer width/height)

- [ ] **Step 6: Fix any failing tests**

The "all cells stay within boundary" test checks against `halfW`/`halfH` — update to check against `mapRadius` using circular distance:
```typescript
for (const cell of result.cells) {
  for (const p of cell.polygon) {
    const dist = Math.sqrt(p.x * p.x + p.z * p.z);
    expect(dist).toBeLessThanOrEqual(mapRadius + 0.1);
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/voronoiLayoutEngine.ts src/domain/voronoiLayoutEngine.test.ts src/domain/types.ts
git commit -m "feat: sub-theme engine uses circular boundary"
```

---

### Task 4: Update providers to use mapRadius

**Files:**
- Modify: `src/domain/themeVoronoiLayoutProvider.ts`
- Modify: `src/domain/voronoiLayoutProvider.ts`

- [ ] **Step 1: Update P1 provider**

```typescript
// themeVoronoiLayoutProvider.ts
options: {
  mapRadius: 11,
  borderGap: 0.20,
},
```

- [ ] **Step 2: Update P2 provider**

For P1-mode provider (`createVoronoiLayoutProvider`):
```typescript
options: {
  mapRadius: 11,
  relaxationIterations: 20,
  areaConvergenceThreshold: 0.05,
  provinceBorderGap: 0.25,
  cityBorderGap: 0,
},
```

For P2-mode provider (`createSubThemeLayoutProvider`):
```typescript
options: {
  mapRadius: 11,
  relaxationIterations: 20,
  areaConvergenceThreshold: 0.05,
  provinceBorderGap: 0.30,
  cityBorderGap: 0.08,
},
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/domain/themeVoronoiLayoutProvider.ts src/domain/voronoiLayoutProvider.ts
git commit -m "feat: providers switch to mapRadius for circular layout"
```

---

### Task 5: Full verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit docs**

```bash
git add docs/superpowers/plans/2026-06-11-gen7-circular-map.md
git commit -m "docs: add Gen7 circular map plan"
```
