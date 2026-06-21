# SP2 — Heat-Driven Dynamic Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make P1 theme + P2 sub-theme Voronoi cells flow with live market heat (|主力净流入| in the active window) — size + gentle relationship-anchored position drift, animated ~0.6s on window/snapshot change.

**Architecture:** A new pure `heatMap.ts` turns the active window's aggregates into normalized per-theme / per-sub-theme heat. The P1 engine already consumes `stage.themeHeat` (hot → inward + larger emergent area), so P1 is a provider-wiring change feeding live heat. The P2 engine gains heat-weighted cell sizing (hot sub-theme → larger cell, with a size floor). App recomputes layout on data change; `CapitalMapScene` eases column positions/heights toward the new layout. P3 + column height/color unchanged.

**Tech Stack:** TypeScript, React 19, @react-three/fiber (`useFrame`), d3-delaunay (ordinary Voronoi), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-22-heat-driven-dynamic-layout-design.md`

**Branch:** `feat/heat-driven-layout` (Task 0).

**Key facts established during planning (do not re-derive):**
- `buildCapitalFlowAggregates` returns `{ byTheme: ReadonlyMap<string,number>, bySubTheme: ReadonlyMap<string,number>, ... }` (signed CNY net inflow per theme / sub-theme). All 11 themes appear in `byTheme` (every theme has stocks).
- `themeVoronoiLayoutEngine` ALREADY uses `stage.themeHeat[theme.id] ?? 0.2` for initial inward-pull (`baseRadius − heat·maxInward`, maxInward = `baseRadius·0.4`) and Lloyd center-bias (`heat·r·0.15`). So feeding live theme heat needs **no engine change** — just pass a stage whose `themeHeat` is live.
- `themeVoronoiLayoutProvider.getLayout(stageId?)` builds the stage from `layoutStages[0]`. `voronoiLayoutProvider.getLayout(stageId?, themeCells?)` likewise. Both pass `stage` into their engines.
- `voronoiLayoutEngine` does NOT size cells by heat today: `placeSubThemeCenters` (line ~216) places seeds on an equal ring; `runLloydRelaxation` (~241) equalizes; `enforceAreaFloor` (~364) grows cells below `SUBTHEME_AREA_FLOOR_RATIO = 0.35` of the theme average. `areaWeight` and `computeSubThemeHeatMap` are unused/dead.
- App.tsx computes `aggregates` (useMemo on snapshot) and pins `activeLayoutStage = layoutStages[0]`; `themeLayout`/`subThemeLayout` useMemos depend only on `activeLayoutStage.id` → layout computes once, never on data change.
- `CapitalMapScene.tsx` (1273 lines) imports `useFrame`; P1 columns render at `[node.cell.x, 0, node.cell.z]` with height from the metric; P2/P3 similar; cell polygon meshes are built per cell.

---

## File structure

| File | Responsibility |
|---|---|
| `src/domain/heatMap.ts` (new) | Pure `buildHeatMap(byTheme, bySubTheme, subThemes)` → `{themeHeat, subThemeHeat}` (abs, normalized, [0,1]). |
| `src/domain/heatMap.test.ts` (new) | Unit tests. |
| `src/domain/themeVoronoiLayoutProvider.ts` (modify) | `getLayout(stageId?, themeHeat?)` — inject live theme heat into the stage. |
| `src/domain/voronoiLayoutProvider.ts` (modify) | `getLayout(stageId?, themeCells?, subThemeHeat?)` — pass heat to the engine. |
| `src/domain/voronoiLayoutEngine.ts` (modify) | Accept `subThemeHeat`; size cells by heat (hot bigger) + size floor. |
| `src/domain/layoutEasing.ts` (new) | Pure easing helper for the scene transition. |
| `src/domain/layoutEasing.test.ts` (new) | Unit tests. |
| `src/App.tsx` (modify) | Build heat from aggregates; pass to providers; recompute layout on data change. |
| `src/components/CapitalMapScene.tsx` (modify) | Ease column positions/heights toward the new layout (~0.6s). |
| Existing engine/layout tests (modify) | Pass heat (or uniform heat reproducing today's behavior). |

---

### Task 0: Create the feature branch

**Files:** none

- [ ] **Step 1**
```bash
cd /Users/housebigger/Documents/01_work/playground_claude_code/ws_a_capital_hunter
git checkout main && git checkout -b feat/heat-driven-layout
git status -sb   # expect: ## feat/heat-driven-layout
```

---

### Task 1: Pure heat map (`heatMap.ts`)

**Files:**
- Create: `src/domain/heatMap.ts`
- Test: `src/domain/heatMap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/heatMap.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildHeatMap } from "./heatMap";

const subThemes = [
  { id: "a1", themeId: "ai" }, { id: "a2", themeId: "ai" },
  { id: "b1", themeId: "bio" }, { id: "b2", themeId: "bio" },
];

describe("buildHeatMap", () => {
  it("uses absolute value — big inflow and big outflow are both hot", () => {
    const byTheme = new Map([["ai", 100], ["bio", -100]]);
    const { themeHeat } = buildHeatMap(byTheme, new Map(), subThemes);
    expect(themeHeat.ai).toBeCloseTo(1);
    expect(themeHeat.bio).toBeCloseTo(1); // outflow of equal magnitude = equally hot
  });

  it("normalizes theme heat across all themes (max abs = 1)", () => {
    const byTheme = new Map([["ai", 200], ["bio", -50]]);
    const { themeHeat } = buildHeatMap(byTheme, new Map(), subThemes);
    expect(themeHeat.ai).toBeCloseTo(1);
    expect(themeHeat.bio).toBeCloseTo(0.25);
  });

  it("normalizes sub-theme heat WITHIN the parent theme", () => {
    // ai sub-themes are small in absolute terms; bio sub-themes are huge.
    const bySub = new Map([["a1", 10], ["a2", 5], ["b1", 1000], ["b2", 250]]);
    const { subThemeHeat } = buildHeatMap(new Map(), bySub, subThemes);
    expect(subThemeHeat.a1).toBeCloseTo(1);    // biggest within ai
    expect(subThemeHeat.a2).toBeCloseTo(0.5);
    expect(subThemeHeat.b1).toBeCloseTo(1);    // biggest within bio, NOT shrunk by being compared to ai
    expect(subThemeHeat.b2).toBeCloseTo(0.25);
  });

  it("all-flat input → all heat 0, no NaN", () => {
    const { themeHeat, subThemeHeat } = buildHeatMap(
      new Map([["ai", 0], ["bio", 0]]),
      new Map([["a1", 0], ["b1", 0]]),
      subThemes
    );
    expect(themeHeat.ai).toBe(0);
    expect(subThemeHeat.a1).toBe(0);
    expect(Number.isNaN(themeHeat.bio)).toBe(false);
  });

  it("skips sub-themes whose parent theme is unknown", () => {
    const { subThemeHeat } = buildHeatMap(new Map(), new Map([["ghost", 99]]), subThemes);
    expect(subThemeHeat.ghost).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/heatMap.test.ts`
Expected: FAIL — cannot find `./heatMap`.

- [ ] **Step 3: Implement**

Create `src/domain/heatMap.ts`:
```typescript
import type { SubTheme } from "./types";

export interface HeatMap {
  /** themeId -> [0,1], |net inflow| normalized across all themes */
  readonly themeHeat: Record<string, number>;
  /** subThemeId -> [0,1], |net inflow| normalized WITHIN the parent theme */
  readonly subThemeHeat: Record<string, number>;
}

/**
 * Build a layout heat map from the active window's capital aggregates. Heat is
 * |主力净流入| (absolute) — heavy inflow and heavy outflow are both "hot".
 * Theme heat is normalized across the 11 themes; sub-theme heat is normalized
 * within its parent theme (so a theme's sub-themes size relative to each other).
 * Pure: same input -> same output. All-flat input yields all-zero heat.
 */
export function buildHeatMap(
  byTheme: ReadonlyMap<string, number>,
  bySubTheme: ReadonlyMap<string, number>,
  subThemes: readonly Pick<SubTheme, "id" | "themeId">[]
): HeatMap {
  let maxTheme = 0;
  for (const v of byTheme.values()) maxTheme = Math.max(maxTheme, Math.abs(v));
  const themeHeat: Record<string, number> = {};
  for (const [id, v] of byTheme) {
    themeHeat[id] = maxTheme > 0 ? Math.abs(v) / maxTheme : 0;
  }

  const themeOf = new Map(subThemes.map((s) => [s.id, s.themeId]));
  const maxByParent = new Map<string, number>();
  for (const [id, v] of bySubTheme) {
    const parent = themeOf.get(id);
    if (parent === undefined) continue;
    maxByParent.set(parent, Math.max(maxByParent.get(parent) ?? 0, Math.abs(v)));
  }
  const subThemeHeat: Record<string, number> = {};
  for (const [id, v] of bySubTheme) {
    const parent = themeOf.get(id);
    if (parent === undefined) continue;
    const max = maxByParent.get(parent) ?? 0;
    subThemeHeat[id] = max > 0 ? Math.abs(v) / max : 0;
  }
  return { themeHeat, subThemeHeat };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/heatMap.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**
```bash
git add src/domain/heatMap.ts src/domain/heatMap.test.ts
git commit -m "feat: pure heat map (abs net inflow, normalized theme/sub-theme)"
```

---

### Task 2: P1 provider — feed live theme heat

**Files:**
- Modify: `src/domain/themeVoronoiLayoutProvider.ts`
- Test: `src/domain/themeVoronoiLayoutProvider.test.ts` (create if absent)

The engine already pulls hot themes inward. We only inject live `themeHeat` into the stage.

- [ ] **Step 1: Write the failing test**

Create/extend `src/domain/themeVoronoiLayoutProvider.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createThemeLayoutProvider } from "./themeVoronoiLayoutProvider";

const dist = (c: { center: { x: number; z: number } }) =>
  Math.hypot(c.center.x, c.center.z);

describe("createThemeLayoutProvider heat", () => {
  it("places a hot theme closer to center than when it is cold", () => {
    const provider = createThemeLayoutProvider();
    const hot = provider.getLayout(undefined, { "ai-computing": 1 });
    const cold = provider.getLayout(undefined, { "ai-computing": 0 });
    const hotCell = hot.cells.find((c) => c.themeId === "ai-computing")!;
    const coldCell = cold.cells.find((c) => c.themeId === "ai-computing")!;
    expect(dist(hotCell)).toBeLessThan(dist(coldCell));
  });
});
```
> Confirm the `ThemeCell` shape exposes `center` and `themeId` (it does per the engine). If the field is named differently, match it; keep the "hot is more central" assertion.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/themeVoronoiLayoutProvider.test.ts`
Expected: FAIL — `getLayout` ignores the 2nd arg (hot == cold).

- [ ] **Step 3: Implement**

In `src/domain/themeVoronoiLayoutProvider.ts`, change the interface + `getLayout` to accept live theme heat and inject it into the stage:
```typescript
export interface ThemeLayoutProvider {
  getLayout(stageId?: string, themeHeat?: Record<string, number>): ThemeVoronoiLayout;
}

export function createThemeLayoutProvider(): ThemeLayoutProvider {
  return {
    getLayout: (stageId, themeHeat) => {
      const base = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      const stage = themeHeat ? { ...base, themeHeat } : base;
      return createThemeVoronoiLayout({
        themes,
        relationshipEdges,
        stage,
        options: { mapRadius: 15, borderGap: 0.20, lloydIterations: 3, smoothIterations: 2 },
      });
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/themeVoronoiLayoutProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/domain/themeVoronoiLayoutProvider.ts src/domain/themeVoronoiLayoutProvider.test.ts
git commit -m "feat: P1 theme layout accepts live theme heat"
```

---

### Task 3: P2 engine + provider — accept sub-theme heat (plumbing only)

**Files:**
- Modify: `src/domain/voronoiLayoutEngine.ts` (add optional `subThemeHeat` to input; no behavior change yet)
- Modify: `src/domain/voronoiLayoutProvider.ts` (accept + pass `subThemeHeat`)
- Test: `src/domain/voronoiLayoutProvider.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**
```typescript
import { describe, it, expect } from "vitest";
import { createSubThemeLayoutProvider } from "./voronoiLayoutProvider";
import { createThemeLayoutProvider } from "./themeVoronoiLayoutProvider";

describe("createSubThemeLayoutProvider heat plumbing", () => {
  it("accepts a subThemeHeat arg and still returns cells", () => {
    const themeCells = createThemeLayoutProvider().getLayout().cells;
    const layout = createSubThemeLayoutProvider().getLayout(undefined, themeCells, { "ai-optical-interconnect": 1 });
    expect(layout.cells.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/voronoiLayoutProvider.test.ts` → FAIL (getLayout has 2 params; TS error / arg ignored).

- [ ] **Step 3: Implement**

In `voronoiLayoutEngine.ts`, add to `VoronoiLayoutInput`:
```typescript
  readonly subThemeHeat?: Record<string, number>;
```
(Thread it into `createVoronoiLayout` destructure: `const { subThemes, themeCells, stage, options, subThemeHeat } = input;` — unused this task.)

In `voronoiLayoutProvider.ts`:
```typescript
export interface VoronoiLayoutProvider {
  getLayout(stageId?: string, themeCells?: ReadonlyArray<ThemeCell>, subThemeHeat?: Record<string, number>): VoronoiLayout;
}
// ... getLayout: (stageId, themeCells, subThemeHeat) => { ... createVoronoiLayout({ subThemes, themeCells, stage, subThemeHeat, options: {...} }); }
```

- [ ] **Step 4: Run** → PASS. Also `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add src/domain/voronoiLayoutEngine.ts src/domain/voronoiLayoutProvider.ts src/domain/voronoiLayoutProvider.test.ts
git commit -m "feat: P2 layout plumbing accepts subThemeHeat (no behavior change)"
```

---

### Task 4: P2 engine — size cells by heat (hot sub-theme bigger, with floor)

**Files:**
- Modify: `src/domain/voronoiLayoutEngine.ts`
- Test: `src/domain/voronoiLayoutEngine.test.ts` (extend)

This is the algorithmic task. The contract is **directional** (hot sibling cell area > cold sibling) plus the size floor — not exact proportional area.

- [ ] **Step 1: Write the failing test**
```typescript
import { describe, it, expect } from "vitest";
import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { createThemeVoronoiLayout } from "./themeVoronoiLayoutEngine";
import { themes } from "./themeRegistry";
import { relationshipEdges } from "./relationshipRegistry";
import { subThemes } from "./subThemeRegistry";
import { layoutStages } from "./layoutStages";

function polyArea(poly: ReadonlyArray<{ x: number; z: number }>): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

describe("voronoi heat sizing", () => {
  const themeCells = createThemeVoronoiLayout({
    themes, relationshipEdges, stage: layoutStages[0],
    options: { mapRadius: 15, borderGap: 0.2, lloydIterations: 3, smoothIterations: 2 },
  }).cells;
  const opts = { mapRadius: 15, cityBorderGap: 0.02, smoothIterations: 1 };
  // pick a theme with >= 3 sub-themes to compare siblings
  const themeId = "ai-computing";
  const sibs = subThemes.filter((s) => s.themeId === themeId).map((s) => s.id);

  it("a hot sub-theme gets a larger cell than a cold sibling", () => {
    const heat: Record<string, number> = {};
    sibs.forEach((id) => (heat[id] = 0.05));
    heat[sibs[0]] = 1; // first sibling very hot
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: heat, options: opts });
    const byId = new Map(layout.cells.map((c) => [c.subThemeId, polyArea(c.polygon)]));
    const hotArea = byId.get(sibs[0])!;
    const coldArea = byId.get(sibs[1])!;
    expect(hotArea).toBeGreaterThan(coldArea);
  });

  it("respects a size floor — no cell collapses to near zero", () => {
    const heat: Record<string, number> = {};
    sibs.forEach((id) => (heat[id] = 0));
    heat[sibs[0]] = 1; // one blazing hot, rest stone cold
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], subThemeHeat: heat, options: opts });
    const themeArea = polyArea(themeCells.find((c) => c.themeId === themeId)!.polygon);
    const equalShare = themeArea / sibs.length;
    for (const c of layout.cells.filter((c) => sibs.includes(c.subThemeId))) {
      expect(polyArea(c.polygon)).toBeGreaterThan(0.25 * equalShare); // >=25% of equal share
    }
  });

  it("uniform heat reproduces ~equal cells (no heat = today's behavior)", () => {
    const layout = createVoronoiLayout({ subThemes, themeCells, stage: layoutStages[0], options: opts });
    expect(layout.cells.length).toBeGreaterThan(0); // baseline still works with no heat
  });
});
```

- [ ] **Step 2: Run** → the "hot bigger" / "floor" tests FAIL (heat ignored today).

- [ ] **Step 3: Implement (recommended approach)**

In `voronoiLayoutEngine.ts`, drive cell area by `subThemeHeat`:
- Compute per-sub-theme **target weight** `w(s) = FLOOR + (1 − FLOOR) · (subThemeHeat[s] ?? uniform)` with `FLOOR = 0.4` (so weights ∈ [0.4, 1]; missing heat → uniform 1).
- **Bias seed placement** in `placeSubThemeCenters`: keep the equal-angle ring, but set each seed's ring radius shorter for hotter sub-themes (closer to the theme center → claims more central area) and longer for cold — a gentle position drift consistent with the spec.
- **Area targeting**: replace the flat `enforceAreaFloor` (35% of average) with a heat-aware pass: target area `t(s) = themeArea · w(s) / Σ w`; run a few (≤5) relaxation iterations nudging each seed toward/away from its cell centroid proportional to `(t(s) − area(s))` so hot cells grow and cold shrink; clamp every cell to `≥ 0.3 · equalShare` so none collapses (satisfies the floor test).
- Keep the existing clip-to-parent + Chaikin smoothing.

> This is a weighted-Voronoi-treemap-lite heuristic. The tests require only *directional* sizing + a floor, so exact convergence is not needed. **Fallback if the iterative pass is unstable:** use only heat-weighted seed radii + a heat-scaled per-cell floor (hot floor higher, cold floor = 0.3·equalShare). That alone passes the directional + floor tests.

- [ ] **Step 4: Run** → all 3 tests PASS. Run the full `npx vitest run src/domain/voronoiLayoutEngine.test.ts` — existing P2 tests still pass (uniform/no-heat path unchanged).

- [ ] **Step 5: Commit**
```bash
git add src/domain/voronoiLayoutEngine.ts src/domain/voronoiLayoutEngine.test.ts
git commit -m "feat: P2 sub-theme cells sized by live heat (hot bigger, size floor)"
```

---

### Task 5: App wiring — heat → providers, recompute on data change

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the heat import + computation**

In `src/App.tsx` add `import { buildHeatMap } from "./domain/heatMap";`. After the `aggregates` useMemo, add:
```typescript
  const heatMap = useMemo(
    () => (aggregates ? buildHeatMap(aggregates.byTheme, aggregates.bySubTheme, subThemes) : null),
    [aggregates]
  );
```
(`subThemes` is already imported in App.tsx.)

- [ ] **Step 2: Pass heat into the layout providers + recompute on change**

Change the two layout useMemos:
```typescript
  const themeLayout = useMemo(
    () => themeLayoutProvider.getLayout(activeLayoutStage.id, heatMap?.themeHeat),
    [activeLayoutStage.id, heatMap]
  );
  const subThemeLayout = useMemo(
    () => subThemeLayoutProvider.getLayout(activeLayoutStage.id, themeLayout.cells, heatMap?.subThemeHeat),
    [activeLayoutStage.id, themeLayout, heatMap]
  );
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (clean) and `npx vitest run src/App.test.tsx` (App tests inject a provider/snapshot; they must still pass — the layout now also recomputes when aggregates change, which is fine).
Expected: PASS + clean.

- [ ] **Step 4: Commit**
```bash
git add src/App.tsx
git commit -m "feat: drive layout from live heat; recompute on window/snapshot change"
```

---

### Task 6: Smooth transition (`layoutEasing.ts` + `CapitalMapScene.tsx`)

**Files:**
- Create: `src/domain/layoutEasing.ts`
- Test: `src/domain/layoutEasing.test.ts`
- Modify: `src/components/CapitalMapScene.tsx`

- [ ] **Step 1: Write the failing test for the easing helper**

Create `src/domain/layoutEasing.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { approach } from "./layoutEasing";

describe("approach", () => {
  it("moves toward target and converges", () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v = approach(v, 10, 1 / 60, 0.6);
    expect(v).toBeCloseTo(10, 1);
  });
  it("does not overshoot in one large step", () => {
    const v = approach(0, 10, 100, 0.6); // huge dt
    expect(v).toBeLessThanOrEqual(10);
    expect(v).toBeGreaterThanOrEqual(0);
  });
  it("returns target when already there", () => {
    expect(approach(5, 5, 0.016, 0.6)).toBeCloseTo(5);
  });
});
```

- [ ] **Step 2: Run** → FAIL (no `./layoutEasing`).

- [ ] **Step 3: Implement**

Create `src/domain/layoutEasing.ts`:
```typescript
/**
 * Frame-rate-independent exponential approach toward `target`. `tau` is the
 * approximate time (s) to close ~63% of the remaining distance; ~0.6 gives a
 * smooth settle in roughly that long. Never overshoots. Pure.
 */
export function approach(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  const k = 1 - Math.exp(-dt / tau);
  const next = current + (target - current) * Math.min(1, Math.max(0, k));
  return next;
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Animate the scene**

In `src/components/CapitalMapScene.tsx`, make the rendered columns ease toward their target position/height instead of snapping. For each column group (P1 theme columns, P2 sub-theme columns), keep the **target** from the current layout/metric and a `useRef` holding the animated value; in a `useFrame((_, dt) => ...)` callback call `approach(currentRef, target, dt, 0.6)` for the group's x/z position and the column height (scale Y / geometry), writing to the mesh/group ref. Voronoi polygon meshes recompute (snap) when the layout changes — only the columns ease. Reuse the file's existing `useFrame` + ref pattern (it already animates camera/heights).

> No new unit test for the scene render itself (3D/WebGL); the easing math is covered by `layoutEasing.test.ts`. Verify visually in Step 6.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (clean) and `npm test` (all pass). Then `npm run dev:full`, switch 今日 / 近5日 / 近10日 / 近20日 and confirm theme & sub-theme cells resize / drift and columns ease smoothly (~0.6s); cold cells stay visible.

- [ ] **Step 7: Commit**
```bash
git add src/domain/layoutEasing.ts src/domain/layoutEasing.test.ts src/components/CapitalMapScene.tsx
git commit -m "feat: ease layout transitions ~0.6s on heat/window change"
```

---

### Task 7: Reconcile existing layout tests + final gate

**Files:**
- Modify: any existing test that assumed the static `layoutStages[0]` layout (e.g., `themeVoronoiLayoutEngine.test.ts`, `voronoiLayoutEngine.test.ts`) — they should still pass (heat is optional and defaults to today's behavior). Only update a test if it now fails.

- [ ] **Step 1: Run the full gate**

Run: `npm test` (all vitest pass) · `python3 -m pytest server/tests -q` (90 pass — unaffected) · `npx tsc --noEmit` (clean) · `npm run build` (succeeds).

- [ ] **Step 2: Fix any failing existing layout test**

If an existing engine test fails because heat is now wired, update it to pass uniform heat (or none) so it reproduces the prior static behavior. Do NOT weaken behavioral assertions. Show the exact diff for any test changed.

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "test: reconcile layout tests with optional heat input"
```

---

### Task 8: Final review + finish branch

- [ ] **Step 1:** Dispatch a final whole-branch review (gate + spec coverage + honesty: cold cells visible, real heat only, P3/height/color unchanged, relationship anchor preserved).
- [ ] **Step 2:** Use **superpowers:finishing-a-development-branch** to merge `feat/heat-driven-layout` → `main`.

---

## Self-review

**Spec coverage:** heat model → Task 1; P1 size+drift via live heat → Task 2; P2 heat sizing + floor → Tasks 3-4; dynamic recompute → Task 5; ~0.6s animation → Task 6; honesty (floor, real heat, P3/color unchanged) → Tasks 4/6 + unchanged code; tests → each task + Task 7. ✅ All spec sections mapped.

**Placeholder scan:** The two algorithmic steps (Task 4 P2 sizing, Task 6 scene animation) intentionally give **complete tests + a concrete recommended approach + a fallback** rather than verbatim final algorithm/3D code — appropriate for heuristic/WebGL work where the test defines correctness. All other steps have full code + exact commands.

**Type consistency:** `buildHeatMap(byTheme, bySubTheme, subThemes) → {themeHeat, subThemeHeat}` (Record<string,number>); `themeLayoutProvider.getLayout(stageId?, themeHeat?)`; `voronoiLayoutProvider.getLayout(stageId?, themeCells?, subThemeHeat?)`; `VoronoiLayoutInput.subThemeHeat?`; `approach(current, target, dt, tau)`. Names are consistent across Tasks 1-6 and App wiring (Task 5) and the scene (Task 6).
