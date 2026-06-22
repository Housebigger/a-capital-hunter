# SP3 — Mobile / Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "A主猎人" solid on phones — sticky primary-control bar above the map, two-finger-rotate/one-finger-scroll/tap-select touch, balanced perf (dpr cap, lighter shadows, reduced label density) — all gated to a single ≤900px compact mode, leaving desktop unchanged.

**Architecture:** A `useIsMobile()` hook (`matchMedia`, default `(max-width: 900px)`) is the single source of truth for JS-driven mobile behavior. The time-window + view-mode controls are extracted into shared `WindowSelector`/`ViewModeSelector` components used by both the desktop `ControlsPanel` and a new sticky `MobileControlBar`. `HunterScene` caps `dpr` and switches `OrbitControls` touch config when compact; the live P2/P3 scenes reduce label density via pure helpers in `labelDensity.ts`. Pure CSS in `App.css` handles the sticky bar, tap targets, `touch-action`, and `.data-status` placement. Presentation-only: no data/heat/registry/backend changes.

**Tech Stack:** React 19 + TypeScript, @react-three/fiber + drei (`OrbitControls`, `three`'s `TOUCH`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-22-mobile-responsive-design.md`

**Branch:** `feat/mobile-responsive` (Task 0).

**Key facts (verified; don't re-derive):**
- `src/App.css` already stacks the `.workspace` 3-column grid into a flex column at `≤900px` (scene `order:1`, controls `order:2`, inspector `order:3`); `≤520px` has fine-tuning. Viewport meta is present.
- `src/App.tsx` render: `.workspace` contains `<ControlsPanel ... activeWindow onWindowChange={setActiveWindow} viewMode onViewModeChange={setViewMode} ... />` then `<section className="scene-panel">` (toolbar, `<DataStatus>`, `<HunterScene>` in two branches P1 vs P2/P3, `<SceneLegend>`). `activeWindow`, `setActiveWindow`, `viewMode`, `setViewMode` are in scope.
- `ControlsPanel` holds `WINDOW_OPTIONS` (1d/5d/10d/20d → 今日/近5日/近10日/近20日) as a `.segmented` button group, and an inline view-mode `.segmented` group (P1 主线 / P2 子题材 / P3 个股), plus filters + camera + collapsible notes.
- `HunterScene` renders `<Canvas camera shadows gl={{antialias:true}}>` with `<directionalLight castShadow>` and `<OrbitControls enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI/2.15}>`. No dpr cap, no touch config.
- Live label `<Text>` sites in `CapitalMapScene.tsx`: **P2** `SubThemeCapitalMapScene` renders a label for **every** `subThemeNodes` entry (~line 1053, `node.subTheme.shortName`); **P3** `P3CapitalMapScene` labels **top-3 stocks per sub-theme** by `|metric.height|` (~line 1134, inline IIFE) and **every** sub-theme cell (~line 1167); **P1** `ThemeCapitalMapScene` labels the 11 themes (~line 1314, leave as-is). The `shouldShow*`/`legacyShouldShowLabel` predicates the spec mentioned are on the **legacy** `VoronoiCapitalMapScene`/`LegacyCapitalMapScene` paths — NOT the live modes; this plan targets the live sites above.
- Live scene component chain: `App` → `HunterScene` (builds `sceneProps` with `mode: "theme"|"subtheme"|"stock"`) → `CapitalMapScene` (dispatcher) → `ThemeCapitalMapScene`/`SubThemeCapitalMapScene`/`P3CapitalMapScene`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/hooks/useIsMobile.ts` (new) | `matchMedia` boolean hook; SSR-safe. |
| `src/hooks/useIsMobile.test.ts` (new) | Unit tests (mock matchMedia). |
| `src/components/WindowSelector.tsx` (new) | Time-window pill group (extracted). |
| `src/components/ViewModeSelector.tsx` (new) | P1/P2/P3 segmented control (extracted). |
| `src/components/MobileControlBar.tsx` (new) | Sticky bar composing the two selectors. |
| `src/components/MobileControlBar.test.tsx` (new) | Render + click tests. |
| `src/domain/labelDensity.ts` (new) | Pure label-selection helpers. |
| `src/domain/labelDensity.test.ts` (new) | Unit tests. |
| `src/components/ControlsPanel.tsx` (modify) | Use the shared selectors. |
| `src/App.tsx` (modify) | `useIsMobile`; render `MobileControlBar`; thread `compact` to scenes. |
| `src/components/HunterScene.tsx` (modify) | dpr cap; mobile shadow size; OrbitControls touch config; thread `compact`. |
| `src/components/CapitalMapScene.tsx` (modify) | `compact` prop → reduce P2/P3 label density via `labelDensity.ts`; `touch-action` not here (CSS). |
| `src/App.css` (modify) | Sticky bar, tap targets, `.data-status`, `touch-action: pan-y` on `.scene-panel`/canvas. |

---

### Task 0: Feature branch

- [ ] **Step 1**
```bash
cd /Users/housebigger/Documents/01_work/playground_claude_code/ws_a_capital_hunter
git checkout main && git checkout -b feat/mobile-responsive
git status -sb   # expect: ## feat/mobile-responsive
```

---

### Task 1: `useIsMobile` hook

**Files:** Create `src/hooks/useIsMobile.ts`; Test `src/hooks/useIsMobile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useIsMobile.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "./useIsMobile";

type Listener = () => void;

function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() { return matches; },
    media: "",
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  };
  const set = (v: boolean) => { matches = v; listeners.forEach((cb) => cb()); };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
  return { set };
}

describe("useIsMobile", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("returns the initial match state", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("updates when the media query flips", () => {
    const { set } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => set(true));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/hooks/useIsMobile.test.ts`
Expected: FAIL — cannot find `./useIsMobile`.

- [ ] **Step 3: Implement**

Create `src/hooks/useIsMobile.ts`:
```typescript
import { useEffect, useState } from "react";

/**
 * True when the viewport is in "compact" mode (phones + small tablets). Drives
 * the SP3 mobile behaviors. SSR-safe (returns false when matchMedia is absent).
 */
export function useIsMobile(query = "(max-width: 900px)"): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/hooks/useIsMobile.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**
```bash
git add src/hooks/useIsMobile.ts src/hooks/useIsMobile.test.ts
git commit -m "feat: useIsMobile hook (compact-mode media query)"
```

---

### Task 2: Extract `WindowSelector` + `ViewModeSelector`

**Files:** Create `src/components/WindowSelector.tsx`, `src/components/ViewModeSelector.tsx`; Modify `src/components/ControlsPanel.tsx`

This is a refactor — `ControlsPanel`'s rendered DOM (button text, `.segmented` groups, `aria-pressed`) must stay identical so `ControlsPanel.test.tsx` passes unchanged.

- [ ] **Step 1: Create `WindowSelector.tsx`**
```tsx
import type { CapitalFlowWindowKey } from "../data/capitalFlowDataProvider";

export const WINDOW_OPTIONS: readonly { value: CapitalFlowWindowKey; label: string }[] = [
  { value: "1d", label: "今日" },
  { value: "5d", label: "近5日" },
  { value: "10d", label: "近10日" },
  { value: "20d", label: "近20日" },
];

export function WindowSelector(props: {
  activeWindow: CapitalFlowWindowKey;
  onWindowChange: (window: CapitalFlowWindowKey) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="时间档位">
      {WINDOW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={props.activeWindow === value ? "active" : ""}
          aria-pressed={props.activeWindow === value}
          onClick={() => props.onWindowChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `ViewModeSelector.tsx`**
```tsx
export type ViewMode = "P1" | "P2" | "P3";

const VIEW_OPTIONS: readonly { value: ViewMode; label: string }[] = [
  { value: "P1", label: "P1 主线" },
  { value: "P2", label: "P2 子题材" },
  { value: "P3", label: "P3 个股" },
];

export function ViewModeSelector(props: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="视图层级">
      {VIEW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={props.viewMode === value ? "active" : ""}
          aria-pressed={props.viewMode === value}
          onClick={() => props.onViewModeChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Use them in `ControlsPanel.tsx`**

Add imports near the top of `src/components/ControlsPanel.tsx`:
```tsx
import { WindowSelector } from "./WindowSelector";
import { ViewModeSelector } from "./ViewModeSelector";
```
Remove the local `WINDOW_OPTIONS` const (now in `WindowSelector`). Replace the window `.segmented` block (inside the 资金流快照 section) with:
```tsx
        <WindowSelector activeWindow={props.activeWindow} onWindowChange={props.onWindowChange} />
```
Replace the view-mode `.segmented` block (inside the 视图层级 section) with:
```tsx
        <ViewModeSelector viewMode={props.viewMode} onViewModeChange={props.onViewModeChange} />
```
Leave the section titles, filters, camera, and notes untouched.

- [ ] **Step 4: Verify no regression**

Run: `npx vitest run src/components/ControlsPanel.test.tsx` → PASS (unchanged behavior).
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**
```bash
git add src/components/WindowSelector.tsx src/components/ViewModeSelector.tsx src/components/ControlsPanel.tsx
git commit -m "refactor: extract WindowSelector + ViewModeSelector (shared by panel + mobile bar)"
```

---

### Task 3: `MobileControlBar`

**Files:** Create `src/components/MobileControlBar.tsx`; Test `src/components/MobileControlBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/MobileControlBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileControlBar } from "./MobileControlBar";

describe("MobileControlBar", () => {
  it("renders window + view controls and fires handlers", () => {
    const onWindowChange = vi.fn();
    const onViewModeChange = vi.fn();
    render(
      <MobileControlBar
        activeWindow="1d"
        onWindowChange={onWindowChange}
        viewMode="P1"
        onViewModeChange={onViewModeChange}
      />
    );
    fireEvent.click(screen.getByText("近10日"));
    expect(onWindowChange).toHaveBeenCalledWith("10d");
    fireEvent.click(screen.getByText("P2 子题材"));
    expect(onViewModeChange).toHaveBeenCalledWith("P2");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/MobileControlBar.test.tsx`
Expected: FAIL — cannot find `./MobileControlBar`.

- [ ] **Step 3: Implement**

Create `src/components/MobileControlBar.tsx`:
```tsx
import { WindowSelector } from "./WindowSelector";
import { ViewModeSelector, type ViewMode } from "./ViewModeSelector";
import type { CapitalFlowWindowKey } from "../data/capitalFlowDataProvider";

/**
 * Sticky primary-control bar shown only in compact (≤900px) layout — keeps the
 * high-frequency time-window + view-mode controls one tap away above the map.
 */
export function MobileControlBar(props: {
  activeWindow: CapitalFlowWindowKey;
  onWindowChange: (window: CapitalFlowWindowKey) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="mobile-control-bar" role="group" aria-label="移动端主控件">
      <WindowSelector activeWindow={props.activeWindow} onWindowChange={props.onWindowChange} />
      <ViewModeSelector viewMode={props.viewMode} onViewModeChange={props.onViewModeChange} />
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/MobileControlBar.test.tsx` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/MobileControlBar.tsx src/components/MobileControlBar.test.tsx
git commit -m "feat: MobileControlBar (sticky window + view controls)"
```

---

### Task 4: Pure label-density helpers

**Files:** Create `src/domain/labelDensity.ts`; Test `src/domain/labelDensity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/labelDensity.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { selectTopLabelsPerGroup, selectTopLabels } from "./labelDensity";

describe("selectTopLabelsPerGroup", () => {
  const cands = [
    { id: "a1", subThemeId: "A", weight: 5 },
    { id: "a2", subThemeId: "A", weight: 9 },
    { id: "a3", subThemeId: "A", weight: 1 },
    { id: "b1", subThemeId: "B", weight: 4 },
  ];
  it("keeps the top-N by weight within each group", () => {
    const ids = selectTopLabelsPerGroup(cands, 1);
    expect(ids.has("a2")).toBe(true);   // A's biggest
    expect(ids.has("a1")).toBe(false);
    expect(ids.has("b1")).toBe(true);   // B's only
    expect(ids.size).toBe(2);
  });
  it("perGroup 0 selects nothing", () => {
    expect(selectTopLabelsPerGroup(cands, 0).size).toBe(0);
  });
});

describe("selectTopLabels", () => {
  it("keeps the global top-N by weight", () => {
    const ids = selectTopLabels(
      [{ id: "x", weight: 1 }, { id: "y", weight: 9 }, { id: "z", weight: 5 }],
      2
    );
    expect([...ids].sort()).toEqual(["y", "z"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/domain/labelDensity.test.ts`
Expected: FAIL — cannot find `./labelDensity`.

- [ ] **Step 3: Implement**

Create `src/domain/labelDensity.ts`:
```typescript
/**
 * Pure label-thinning helpers. On phones the 408-stock / 74-sub-theme map is too
 * dense to label everything, so the scenes label only the heaviest few. Pure:
 * sort is on a copy; same input → same output.
 */
export interface GroupedLabelCandidate {
  readonly id: string;
  readonly subThemeId: string;
  readonly weight: number; // typically |metric.height|
}

/** Ids of the top `perGroup` candidates (by weight, desc) within each sub-theme. */
export function selectTopLabelsPerGroup(
  candidates: readonly GroupedLabelCandidate[],
  perGroup: number
): Set<string> {
  const byGroup = new Map<string, GroupedLabelCandidate[]>();
  for (const c of candidates) {
    const arr = byGroup.get(c.subThemeId) ?? [];
    arr.push(c);
    byGroup.set(c.subThemeId, arr);
  }
  const ids = new Set<string>();
  for (const arr of byGroup.values()) {
    [...arr]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(0, perGroup))
      .forEach((c) => ids.add(c.id));
  }
  return ids;
}

/** Ids of the global top `n` candidates by weight, desc. */
export function selectTopLabels(
  candidates: readonly { id: string; weight: number }[],
  n: number
): Set<string> {
  return new Set(
    [...candidates]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(0, n))
      .map((c) => c.id)
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/labelDensity.test.ts` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/domain/labelDensity.ts src/domain/labelDensity.test.ts
git commit -m "feat: pure label-density helpers for compact mode"
```

---

### Task 5: App wiring — render the sticky bar, thread `compact`

**Files:** Modify `src/App.tsx`

- [ ] **Step 1: Imports + compute flag**

In `src/App.tsx` add:
```tsx
import { MobileControlBar } from "./components/MobileControlBar";
import { useIsMobile } from "./hooks/useIsMobile";
```
Inside the component body (near the other hooks), add:
```tsx
  const isMobile = useIsMobile();
```

- [ ] **Step 2: Render the sticky bar above the scene**

In the `.workspace` JSX, insert `MobileControlBar` BETWEEN `<ControlsPanel .../>` and `<section className="scene-panel">`:
```tsx
        <MobileControlBar
          activeWindow={activeWindow}
          onWindowChange={setActiveWindow}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
```
(CSS in Task 7 hides it on desktop and pins it on mobile with `order` above the scene.)

- [ ] **Step 3: Thread `compact` into both `HunterScene` branches**

Add `compact={isMobile}` to both `<HunterScene .../>` usages (the P1 branch and the P2/P3 branch).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (will fail until Task 6 adds the `compact` prop to `HunterScene` — that's expected; proceed to Task 6 before re-checking, OR temporarily add `compact?: boolean` to `HunterSceneProps` now). To keep this task green on its own, add the prop to `HunterSceneProps` here:

In `src/components/HunterScene.tsx`, add to `HunterSceneProps`:
```tsx
  compact?: boolean;
```
(Task 6 consumes it.) Then:
Run: `npx tsc --noEmit` → clean. Run: `npx vitest run src/App.test.tsx` → PASS (App tests inject a snapshot/provider; the new bar renders but doesn't change their assertions).

- [ ] **Step 5: Commit**
```bash
git add src/App.tsx src/components/HunterScene.tsx
git commit -m "feat: render MobileControlBar; thread compact flag to scenes"
```

---

### Task 6: HunterScene perf + touch; thread `compact` to CapitalMapScene

**Files:** Modify `src/components/HunterScene.tsx`

- [ ] **Step 1: Cap dpr + lighter mobile shadows + touch config**

In `src/components/HunterScene.tsx`:
- Add the import: `import { TOUCH } from "three";`
- On `<Canvas>`, add `dpr={[1, 2]}` (keep existing `camera`, `shadows`, `gl`).
- On `<directionalLight ... castShadow>`, add `shadow-mapSize={props.compact ? [512, 512] : [1024, 1024]}`.
- On `<OrbitControls>`, add a touch config applied only when compact:
```tsx
      <OrbitControls
        ref={orbitControlsRef}
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.15}
        touches={
          props.compact
            ? { ONE: TOUCH.NONE, TWO: TOUCH.DOLLY_ROTATE }
            : { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
        }
      />
```
(`TOUCH.NONE` frees one finger for page scroll; two fingers rotate + pinch. Desktop mouse orbit is unaffected by `touches`.)

- [ ] **Step 2: Thread `compact` into every `sceneProps` branch**

In the `sceneProps` IIFE, add `compact: props.compact ?? false,` to each returned object (the `"theme"`, `"subtheme"`, `"stock"`, `"voronoi"`, and default branches), so `CapitalMapScene` receives it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — this will error in `CapitalMapScene` prop types until Task 6b/Task 7 add `compact` to the scene prop types. To keep HunterScene self-consistent, also do Step 4 now.

- [ ] **Step 4: Accept `compact` in `CapitalMapScene` prop types (no behavior yet)**

In `src/components/CapitalMapScene.tsx`, add `compact?: boolean;` to each of `ThemeCapitalMapSceneProps`, `SubThemeCapitalMapSceneProps`, `P3CapitalMapSceneProps` (and the `CapitalMapSceneProps` union members already include these). In the `CapitalMapScene` dispatcher, pass `compact={(props as any).compact}` through to each scene — or, cleaner, add `compact` to each branch's prop spread. Leave the scenes ignoring it for now.

Run: `npx tsc --noEmit` → clean. Run: `npm test` → all pass (no behavior change).

- [ ] **Step 5: Commit**
```bash
git add src/components/HunterScene.tsx src/components/CapitalMapScene.tsx
git commit -m "feat: mobile dpr cap, lighter shadows, two-finger-rotate touch config"
```

> **In-browser verification (user):** on a phone / devtools device mode, confirm one-finger drag scrolls the page, two fingers rotate + pinch-zoom, a tap selects a cell, and the map renders smoothly. The `touch-action` half lands in Task 7.

---

### Task 7: Label density in the live P2/P3 scenes

**Files:** Modify `src/components/CapitalMapScene.tsx`

- [ ] **Step 1: Import the helpers**

At the top of `src/components/CapitalMapScene.tsx`:
```tsx
import { selectTopLabelsPerGroup, selectTopLabels } from "../domain/labelDensity";
```

- [ ] **Step 2: P3 stock labels — fewer per group when compact**

In `P3CapitalMapScene`, replace the inline top-3 grouping IIFE (the `{(() => { ... })()}` block that builds `bySubTheme` and `labeled` for stock labels) with:
```tsx
      {(() => {
        const visible = stockNodes.filter((n) => n.visible);
        const perGroup = props.compact ? 1 : 3;
        const labeledIds = selectTopLabelsPerGroup(
          visible.map((n) => ({ id: n.stock.id, subThemeId: n.subTheme.id, weight: Math.abs(n.metric.height) })),
          perGroup
        );
        return visible
          .filter((node) => labeledIds.has(node.stock.id))
          .map((node) => (
            <Text
              key={`p3-label-${node.stock.id}`}
              position={[node.position.x, THEME_PLATE_THICKNESS + Math.abs(node.metric.height) + 0.08, node.position.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.12}
              color="#f3f6fa"
              outlineWidth={0.012}
              outlineColor="#0b0f14"
              anchorX="center"
              anchorY="middle"
              maxWidth={0.9}
            >
              {node.stock.shortName}
            </Text>
          ));
      })()}
```
(Desktop keeps top-3 — identical to today; compact drops to top-1.)

- [ ] **Step 3: P3 sub-theme labels — top-N when compact**

In `P3CapitalMapScene`, the "SubTheme name labels at cell centers" block maps every `voronoiCells`. Gate it:
```tsx
      {(() => {
        const allowed = props.compact
          ? selectTopLabels(
              subThemeNodesForCells(voronoiCells, stockNodes),
              10
            )
          : null; // null = show all (desktop)
        return voronoiCells
          .filter((cell) => allowed === null || allowed.has(cell.subThemeId))
          .map((cell) => (
            <Text
              key={`p3-sublabel-${cell.subThemeId}`}
              position={[cell.center.x, THEME_PLATE_THICKNESS + 0.02, cell.center.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.13}
              color="#b0bec5"
              anchorX="center"
              anchorY="middle"
              maxWidth={1.2}
              outlineWidth={0.01}
              outlineColor="#000000"
            >
              {/* keep the existing label text expression that was here */}
            </Text>
          ));
      })()}
```
where the weight for a cell is the max `|metric.height|` of its stocks. Add this small local helper near the top of the file (module scope):
```tsx
function subThemeNodesForCells(
  cells: ReadonlyArray<{ subThemeId: string }>,
  stockNodes: ReadonlyArray<StockRenderNode3>
): { id: string; weight: number }[] {
  const weight = new Map<string, number>();
  for (const n of stockNodes) {
    const w = Math.abs(n.metric.height);
    weight.set(n.subTheme.id, Math.max(weight.get(n.subTheme.id) ?? 0, w));
  }
  return cells.map((c) => ({ id: c.subThemeId, weight: weight.get(c.subThemeId) ?? 0 }));
}
```
> Preserve the EXACT existing children/label-text of that `<Text>` (copy it from the current file before editing) — only the wrapping filter changes.

- [ ] **Step 4: P2 sub-theme labels — top-N when compact**

In `SubThemeCapitalMapScene`, the "Layer 5: SubTheme labels" block maps every `subThemeNodes`. Gate it:
```tsx
      {(() => {
        const allowed = props.compact
          ? selectTopLabels(
              subThemeNodes.map((n) => ({ id: n.subTheme.id, weight: Math.abs(n.metric.height) })),
              10
            )
          : null;
        return subThemeNodes
          .filter((node) => allowed === null || allowed.has(node.subTheme.id))
          .map((node) => (
            <Text
              key={`p2-label-${node.subTheme.id}`}
              position={[node.position.x, THEME_PLATE_THICKNESS + 0.02, node.position.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              maxWidth={1.6}
              outlineWidth={0.02}
              outlineColor="#000000"
            >
              {node.subTheme.shortName}
            </Text>
          ));
      })()}
```
> Confirm `subThemeNodes` exposes `metric.height` (it drives the column height — check the `SubThemeRenderNode` type; if the field differs, use the node's net-inflow magnitude field). Desktop (`compact` false) shows all labels exactly as today.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm test` → all pass (desktop label paths unchanged; no scene unit tests assert label counts).

- [ ] **Step 6: Commit**
```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat: thin P2/P3 labels in compact mode (top movers per group)"
```

> Realizes the spec's "reduce label density on phones." The spec's literal "only the selected sub-theme's stocks" is implemented as top-movers thinning, because the live P3 scene labels by top-N (not by selection) and has no per-sub-theme selection state — top-N is the same decluttering intent, simpler and testable.

---

### Task 8: CSS — sticky bar, tap targets, touch-action, data-status

**Files:** Modify `src/App.css`

- [ ] **Step 1: Sticky bar (mobile only) + hide on desktop**

Add to `src/App.css` (base rules + inside the existing `@media (max-width: 900px)` block):
```css
/* Mobile primary-control bar — hidden on desktop, sticky in the stacked layout */
.mobile-control-bar { display: none; }

@media (max-width: 900px) {
  .mobile-control-bar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    order: 0;                 /* above the scene (scene is order:1) */
    position: sticky;
    top: 0;
    z-index: 5;
    padding: 8px;
    background: rgba(13, 18, 18, 0.92);
    backdrop-filter: blur(6px);
    border: 1px solid #2e3838;
    border-radius: 8px;
  }
  /* The desktop ControlsPanel still renders its own window+view selectors;
     hide those two sections on mobile so they live only in the sticky bar. */
  .controls-panel > .control-section:nth-child(1),
  .controls-panel > .control-section:nth-child(2) {
    display: none;
  }
}
```
> Verify the first two `.control-section`s of `ControlsPanel` are exactly the 资金流快照 (window) and 视图层级 (view) sections (they are, per the current file). If the order changes, target them by a class instead.

- [ ] **Step 2: Touch-action so one finger scrolls the page over the canvas**

Add (base or in the 900px block):
```css
@media (max-width: 900px) {
  .scene-panel,
  .hunter-canvas,
  .hunter-canvas canvas {
    touch-action: pan-y;
  }
}
```

- [ ] **Step 3: Tap targets ≥44px on touch**

Add to the existing `@media (max-width: 900px)` block:
```css
@media (max-width: 900px) {
  .segmented button,
  .data-error-actions button {
    min-height: 44px;
  }
}
```

- [ ] **Step 4: Keep `.data-status` clear of the sticky bar / toolbar**

In the existing `@media (max-width: 520px)` block (or 900px), make it non-overlapping:
```css
@media (max-width: 900px) {
  .data-status {
    position: static;
    max-width: none;
    margin: 8px 0;
  }
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` (CSS-only, still build-check) and `npm run build` → succeeds.

- [ ] **Step 6: Commit**
```bash
git add src/App.css
git commit -m "feat: mobile CSS — sticky bar, touch-action, tap targets, data-status"
```

> **In-browser verification (user):** devtools device mode + a real phone — sticky bar stays on top while scrolling, controls aren't duplicated, tap targets feel right, the map area scrolls the page with one finger, `.data-status` doesn't overlap.

---

### Task 9: Full gate + reconcile

- [ ] **Step 1: Run the whole gate**

Run: `npm test` (all pass) · `npx tsc --noEmit` (clean) · `npm run build` (succeeds) · `python3 -m pytest server/tests -q` (90 pass — unaffected, presentation-only change).

- [ ] **Step 2: Fix any regression**

If `ControlsPanel.test.tsx` or `App.test.tsx` broke, inspect and fix without weakening assertions (the selectors render identical DOM; the only new element is `MobileControlBar`, hidden on desktop via CSS so jsdom still renders it — if a test asserts a unique "今日" button and now finds two, scope the query to the panel/bar or assert `getAllByText` as appropriate). Show the diff for any test changed.

- [ ] **Step 3: Commit (if any fix)**
```bash
git add -A
git commit -m "test: reconcile tests with mobile control bar"
```

---

### Task 10: Final review + finish branch

- [ ] **Step 1:** Dispatch a final whole-branch review (gate + spec coverage + honesty: desktop unchanged, presentation-only, no data/heat changes; compact behaviors gated behind `isMobile`/media query).
- [ ] **Step 2:** Use **superpowers:finishing-a-development-branch** to merge `feat/mobile-responsive` → `main`.

> **Before merge — user in-browser sign-off** (the headless gate can't verify touch/perf/visual): phone or devtools device mode — sticky bar, one-finger scroll vs two-finger rotate vs tap-select, label declutter, map smoothness, no overlaps.

---

## Self-review

**Spec coverage:** scope (polish stack) → whole plan; sticky bar (option B) → Tasks 2/3/5/8; touch model → Task 6 (`touches`) + Task 8 (`touch-action`); balanced perf (dpr/shadows) → Task 6; label density → Tasks 4/7; single ≤900px compact breakpoint → Task 1 default + Task 8 media queries; desktop unchanged → every change gated by `isMobile`/`@media`; `useIsMobile` / extracted selectors / `MobileControlBar` / `labelDensity` → Tasks 1–4; testing strategy → unit tests in Tasks 1/3/4 + gate in Task 9; honesty (no data/heat changes) → no domain-data/backend files touched. ✅ Mapped. **Deviation noted:** the spec's "P3 labels only for the selected sub-theme" is realized as top-movers thinning (Task 7) — same intent, fits the live code which labels by top-N, not selection.

**Placeholder scan:** Two label `<Text>` edits (Task 7 Steps 3–4) say "preserve the existing label text/children" rather than re-printing a long JSX subtree verbatim — the full surrounding `<Text>` is shown; the instruction is to keep the one child expression. The CSS `:nth-child` selector has a written verification step. No TBD/TODO; all code steps have code; all commands have expected output.

**Type consistency:** `useIsMobile(query?)`→`boolean`; `WindowSelector({activeWindow,onWindowChange})`; `ViewModeSelector({viewMode,onViewModeChange})` + exported `ViewMode`; `MobileControlBar({activeWindow,onWindowChange,viewMode,onViewModeChange})`; `selectTopLabelsPerGroup(candidates, perGroup)→Set<string>`, `selectTopLabels(candidates, n)→Set<string>`; `compact?: boolean` threaded App→HunterScene→CapitalMapScene scenes. Names consistent across tasks.
