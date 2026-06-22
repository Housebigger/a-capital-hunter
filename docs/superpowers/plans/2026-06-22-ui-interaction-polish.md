# SP4 — UI / Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pre-publish UI/interaction polish pass — make cell selection a real end-to-end interaction (gold ring + inspector detail across P1/P2/P3), fix the "模拟净流入" mislabel of real data, polish inspector lists, micro-interactions, and typography. Presentation-only; no data/heat/layout changes.

**Architecture:** A pure `buildSelectionDetail` turns the selected id + active aggregates into a small view-model the `InspectorPanel` renders (correct `主力净流入` label, demo-aware). `selectedSectorId` is threaded into the live 3D scenes, which draw a gold ring + emissive bump on the matching cell; P1 theme cells are made clickable. The rest is CSS (lists, transitions, loading pulse, typography/contrast). Desktop + mobile both benefit (shared components/CSS); all changes are gated by nothing data-related.

**Tech Stack:** React 19 + TS, @react-three/fiber + drei, three (`LineLoop`/`BufferGeometry`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-22-ui-interaction-polish-design.md`

**Branch:** `feat/ui-interaction-polish` (Task 0).

**Key facts (verified; don't re-derive):**
- `aggregates` (App) = `{ byTheme: ReadonlyMap<string,number>, bySubTheme: ReadonlyMap<string,number>, ... }`. `themes` (`./domain/themeRegistry`, fields `id`,`name`,`shortName`,`color`) and `subThemes` (`./domain/subThemeRegistry`, fields `id`,`themeId`,`name`,`shortName`) are imported in `App.tsx`.
- `viewMode: "P1" | "P2" | "P3"`; `hunterState.selectedSectorId` holds the selection; `App.tsx:312` renders `<InspectorPanel overview={overview} overviewTitle={…} />` — and **nothing else** (no `node`/selection today).
- **Selection id model:** P2 sub-theme cells + P3 stocks already call `onSelectSector(subThemeId)` (`CapitalMapScene.tsx` ~757, ~798). **P1 `ThemeCapitalMapScene` (~1273) has NO onClick** — its `ThemePlate`s (~1287) and columns aren't clickable.
- `HunterScene.tsx` `sceneProps`: the `theme`/`subtheme`/`stock` branches do NOT include `selectedSectorId` (only the legacy `voronoi`/default do). App already passes `selectedSectorId={hunterState.selectedSectorId}` to both `<HunterScene>` usages (`App.tsx:292,303`).
- Live scene prop interfaces: `ThemeCapitalMapSceneProps` (~1222), `SubThemeCapitalMapSceneProps` (~845), `P3CapitalMapSceneProps` (~859) — none has `selectedSectorId`. The `CapitalMapScene` dispatcher (~1376) passes props explicitly per branch.
- `InspectorPanel.tsx`: branches are `selectedStockNode` → `!node && overview` → `!node` empty → `node.subTheme` → `node` (legacy). The legacy detail branches (with hardcoded "模拟净流入") are unreachable on the live path. Empty-state copy (~73-74) has "第三版" + "模拟净流入". Overview branch (~57-68) uses `<ul><li>` (default bullets) and already says "主力净流入合计".
- `App.css`: `button` hover at ~36 (no transition); `button.active` ~47; `.loading-state` ~476 (plain text); secondary text colors `#9ba8a7`/`#aab7b3`/`#a4afad`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/domain/selectionDetail.ts` (new) | Pure `buildSelectionDetail` → `SelectionDetail \| null`. |
| `src/domain/selectionDetail.test.ts` (new) | Unit tests. |
| `src/components/InspectorPanel.tsx` (modify) | `isDemo` + `selection` props; live-detail branch; copy fixes; list/tag classes. |
| `src/components/InspectorPanel.test.tsx` (modify) | Live-detail + copy + list assertions. |
| `src/App.tsx` (modify) | Compute `selectionDetail`; pass `selection`+`isDemo` to InspectorPanel. |
| `src/components/HunterScene.tsx` (modify) | `selectedSectorId` into live `sceneProps`. |
| `src/components/CapitalMapScene.tsx` (modify) | P1 clickable; `selectedSectorId` prop on live scenes; gold ring + emissive. |
| `src/App.css` (modify) | transitions, loading pulse, overview-list + rel-tag styles, typography/contrast, ring token. |

---

### Task 0: Feature branch

- [ ] **Step 1**
```bash
cd /Users/housebigger/Documents/01_work/playground_claude_code/ws_a_capital_hunter
git checkout main && git checkout -b feat/ui-interaction-polish
git status -sb   # ## feat/ui-interaction-polish
```

---

### Task 1: Pure `buildSelectionDetail`

**Files:** Create `src/domain/selectionDetail.ts`; Test `src/domain/selectionDetail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/selectionDetail.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildSelectionDetail } from "./selectionDetail";

const themes = [{ id: "ai", name: "AI算力", shortName: "AI", color: "#fff" }] as const;
const subThemes = [{ id: "chips", themeId: "ai", name: "AI芯片", shortName: "芯片" }] as const;
const data = {
  themes: themes as any,
  subThemes: subThemes as any,
  byTheme: new Map([["ai", 5e8]]),
  bySubTheme: new Map([["chips", -2e8]]),
};

describe("buildSelectionDetail", () => {
  it("returns null when nothing is selected", () => {
    expect(buildSelectionDetail(undefined, "P1", data)).toBeNull();
  });
  it("P1: theme id → theme detail with byTheme net inflow + direction", () => {
    const d = buildSelectionDetail("ai", "P1", data)!;
    expect(d).toMatchObject({ kind: "theme", name: "AI算力", netInflow: 5e8, direction: "inflow" });
    expect(d.parentThemeName).toBeUndefined();
  });
  it("P2/P3: sub-theme id → sub-theme detail with parent + bySubTheme + outflow", () => {
    const d = buildSelectionDetail("chips", "P2", data)!;
    expect(d).toMatchObject({ kind: "subTheme", name: "AI芯片", parentThemeName: "AI算力", netInflow: -2e8, direction: "outflow" });
    expect(buildSelectionDetail("chips", "P3", data)!.kind).toBe("subTheme");
  });
  it("net 0 → flat; unknown id → null", () => {
    expect(buildSelectionDetail("ai", "P1", { ...data, byTheme: new Map([["ai", 0]]) })!.direction).toBe("flat");
    expect(buildSelectionDetail("ghost", "P1", data)).toBeNull();
    expect(buildSelectionDetail("ghost", "P2", data)).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/selectionDetail.test.ts` → FAIL (no module).

- [ ] **Step 3: Implement**

Create `src/domain/selectionDetail.ts`:
```typescript
import type { Theme, SubTheme } from "./types";

export interface SelectionDetail {
  readonly kind: "theme" | "subTheme";
  readonly name: string;
  readonly parentThemeName?: string;
  readonly netInflow: number;
  readonly direction: "inflow" | "outflow" | "flat";
}

interface SelectionData {
  readonly themes: readonly Theme[];
  readonly subThemes: readonly SubTheme[];
  readonly byTheme: ReadonlyMap<string, number>;
  readonly bySubTheme: ReadonlyMap<string, number>;
}

const directionOf = (v: number): SelectionDetail["direction"] =>
  v > 0 ? "inflow" : v < 0 ? "outflow" : "flat";

/**
 * Turn the selected id (themeId in P1, subThemeId in P2/P3) + the active window's
 * aggregates into a small inspector view-model. Pure. Returns null when nothing
 * is selected or the id is unknown.
 */
export function buildSelectionDetail(
  selectedSectorId: string | undefined,
  viewMode: "P1" | "P2" | "P3",
  data: SelectionData
): SelectionDetail | null {
  if (!selectedSectorId) return null;
  if (viewMode === "P1") {
    const theme = data.themes.find((t) => t.id === selectedSectorId);
    if (!theme) return null;
    const net = data.byTheme.get(theme.id) ?? 0;
    return { kind: "theme", name: theme.name, netInflow: net, direction: directionOf(net) };
  }
  const sub = data.subThemes.find((s) => s.id === selectedSectorId);
  if (!sub) return null;
  const net = data.bySubTheme.get(sub.id) ?? 0;
  const parent = data.themes.find((t) => t.id === sub.themeId);
  return {
    kind: "subTheme",
    name: sub.name,
    parentThemeName: parent?.name,
    netInflow: net,
    direction: directionOf(net),
  };
}
```
> Verify `Theme`/`SubTheme` field names in `src/domain/types.ts` (`name`, `themeId`); adapt if different.

- [ ] **Step 4: Run** → PASS (4). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add src/domain/selectionDetail.ts src/domain/selectionDetail.test.ts
git commit -m "feat: pure buildSelectionDetail (selected id + aggregates -> inspector view-model)"
```

---

### Task 2: InspectorPanel — live-detail branch + copy fixes

**Files:** Modify `src/components/InspectorPanel.tsx`; Modify `src/components/InspectorPanel.test.tsx`

- [ ] **Step 1: Write the failing tests** (append to `InspectorPanel.test.tsx`)
```tsx
import { buildSelectionDetail } from "../domain/selectionDetail";

const selData = {
  themes: [{ id: "ai", name: "AI算力", shortName: "AI", color: "#fff" }] as any,
  subThemes: [{ id: "chips", themeId: "ai", name: "AI芯片", shortName: "芯片" }] as any,
  byTheme: new Map([["ai", 5e8]]),
  bySubTheme: new Map([["chips", 2e8]]),
};

describe("InspectorPanel live selection detail", () => {
  it("labels real data 主力净流入 (not 模拟) and shows parent + value", () => {
    const sel = buildSelectionDetail("chips", "P2", selData)!;
    render(<InspectorPanel selection={sel} isDemo={false} />);
    expect(screen.getByText("主力净流入")).toBeInTheDocument();
    expect(screen.queryByText("模拟净流入")).toBeNull();
    expect(screen.getByText("主线：AI算力")).toBeInTheDocument();
    expect(screen.getByText("AI芯片")).toBeInTheDocument();
  });
  it("labels demo data 模拟净流入", () => {
    const sel = buildSelectionDetail("ai", "P1", selData)!;
    render(<InspectorPanel selection={sel} isDemo={true} />);
    expect(screen.getByText("模拟净流入")).toBeInTheDocument();
  });
});
```
Also update the existing empty-state test (currently asserts `"点击板块查看资金状态"` + `"第三版展示资金方向、模拟净流入、算法布局解释和分题材信息。"`) to the new copy:
```tsx
  it("renders an empty state without a selection", () => {
    render(<InspectorPanel node={undefined} />);
    expect(screen.getByText("点击地图上的板块查看详情")).toBeInTheDocument();
    expect(screen.queryByText(/第三版/)).toBeNull();
    expect(screen.queryByText(/模拟/)).toBeNull();
  });
```

- [ ] **Step 2: Run** `npx vitest run src/components/InspectorPanel.test.tsx` → FAIL (no `selection` prop / old copy).

- [ ] **Step 3: Implement**

In `src/components/InspectorPanel.tsx`:
1. Import the type: `import type { SelectionDetail } from "../domain/selectionDetail";`
2. Extend props:
```tsx
interface InspectorPanelProps {
  node?: RenderNode;
  selectedStockNode?: StockRenderNode;
  selection?: SelectionDetail;
  isDemo?: boolean;
  overview?: CapitalFlowOverview;
  overviewTitle?: string;
}
```
3. Destructure `selection`, `isDemo` and add a NEW branch as the FIRST return (before `selectedStockNode`):
```tsx
export function InspectorPanel({ node, selectedStockNode, selection, isDemo, overview, overviewTitle }: InspectorPanelProps) {
  if (selection) {
    const fmt = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) / 1e8).toFixed(2)}亿`;
    const label = isDemo ? "模拟净流入" : "主力净流入";
    const color =
      selection.direction === "inflow" ? "#e64646" : selection.direction === "outflow" ? "#3fae6a" : "#9ba8a7";
    const dirText =
      selection.direction === "inflow" ? "流入" : selection.direction === "outflow" ? "流出" : "平盘";
    return (
      <section className="inspector-panel" aria-label="板块详情">
        {selection.parentThemeName && <div className="inspector-kicker">主线：{selection.parentThemeName}</div>}
        <h2>{selection.name}</h2>
        <div className="metric-row"><span>{label}</span><strong style={{ color }}>{fmt(selection.netInflow)}</strong></div>
        <div className="metric-row"><span>状态</span><strong>{dirText}</strong></div>
      </section>
    );
  }
  // ... existing selectedStockNode / overview / empty / node branches unchanged below
```
4. Fix the empty-state copy (the `!node` && no-overview return):
```tsx
    return (
      <section className="inspector-panel" aria-label="板块详情">
        <h2>点击地图上的板块查看详情</h2>
        <p>查看该板块的主力净流入、资金方向与产业链/联动关系解释。</p>
      </section>
    );
```
5. In the legacy `selectedStockNode`/`node.subTheme`/`node` branches, change the hardcoded `"模拟净流入"` row label to `{isDemo ? "模拟净流入" : "主力净流入"}` (cheap honesty fix even though those are dead on the live path).

- [ ] **Step 4: Run** → PASS (new + existing, with the updated empty-state assertion). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add src/components/InspectorPanel.tsx src/components/InspectorPanel.test.tsx
git commit -m "feat: InspectorPanel live-selection detail (主力净流入, demo-aware) + copy fixes"
```

---

### Task 3: App — compute + pass selection detail

**Files:** Modify `src/App.tsx`

- [ ] **Step 1: Import + compute**

Add `import { buildSelectionDetail } from "./domain/selectionDetail";`. After the `overview` memo, add:
```tsx
  const selectionDetail = useMemo(
    () =>
      aggregates
        ? buildSelectionDetail(hunterState.selectedSectorId, viewMode, {
            themes,
            subThemes,
            byTheme: aggregates.byTheme,
            bySubTheme: aggregates.bySubTheme,
          })
        : null,
    [hunterState.selectedSectorId, viewMode, aggregates]
  );
```

- [ ] **Step 2: Pass to InspectorPanel**

Change `App.tsx:312` to:
```tsx
        <InspectorPanel
          selection={selectionDetail ?? undefined}
          isDemo={isDemo}
          overview={overview}
          overviewTitle={viewMode === "P1" ? "主线概览" : "子题材概览"}
        />
```
(When `selectionDetail` is set it takes precedence; otherwise the overview shows — exactly today's behavior when nothing is selected.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (clean) · `npx vitest run src/App.test.tsx` (PASS). 
> If an App test selects a cell and now expects the overview, it may need updating — but App tests don't currently click cells, so they should pass unchanged. If one fails, report it.

- [ ] **Step 4: Commit**
```bash
git add src/App.tsx
git commit -m "feat: drive InspectorPanel from live selection (detail on select, overview otherwise)"
```

---

### Task 4: Thread `selectedSectorId` into the live scenes

**Files:** Modify `src/components/HunterScene.tsx`, `src/components/CapitalMapScene.tsx`

- [ ] **Step 1: HunterScene sceneProps**

In `src/components/HunterScene.tsx`, add `selectedSectorId: props.selectedSectorId,` to the `theme`, `subtheme`, and `stock` branches of the `sceneProps` IIFE (the `voronoi`/default branches already have it).

- [ ] **Step 2: CapitalMapScene prop types + dispatcher**

In `src/components/CapitalMapScene.tsx`:
- Add `selectedSectorId?: SectorId;` to `ThemeCapitalMapSceneProps`, `SubThemeCapitalMapSceneProps`, `P3CapitalMapSceneProps` (match the file's field style; `SectorId` is already imported/used).
- In the `CapitalMapScene` dispatcher, pass `selectedSectorId={(props as <Mode>CapitalMapSceneProps).selectedSectorId}` to each of `<ThemeCapitalMapScene>`, `<SubThemeCapitalMapScene>`, `<P3CapitalMapScene>` (match the existing explicit-prop pattern).

- [ ] **Step 3: Verify** `npx tsc --noEmit` clean; `npm test` all pass (no behavior change yet — the scenes don't read it until Task 6).

- [ ] **Step 4: Commit**
```bash
git add src/components/HunterScene.tsx src/components/CapitalMapScene.tsx
git commit -m "feat: thread selectedSectorId into live theme/subtheme/stock scenes"
```

---

### Task 5: Make P1 theme cells clickable

**Files:** Modify `src/components/CapitalMapScene.tsx`

- [ ] **Step 1: Add a click target to the P1 theme plate**

In `ThemeCapitalMapScene` (~1273), the theme plates render as `<ThemePlate key={theme.id} cell={cell} themeColor={theme.color} />` (~1287) with no onClick. Make each theme selectable. Read `ThemePlate` first; it renders a plate mesh. Add an optional `onClick?: () => void` prop to `ThemePlate` and bind it to its plate `<mesh onClick={...}>` (with `e.stopPropagation()`), then in `ThemeCapitalMapScene` pass `onClick={() => props.onSelectSector(theme.id)}`:
```tsx
          <ThemePlate
            key={theme.id}
            cell={cell}
            themeColor={theme.color}
            onClick={() => props.onSelectSector(theme.id)}
          />
```
> If `ThemePlate` is shared with P2 (`SubThemeCapitalMapScene` also renders `<ThemePlate>`), the `onClick` is optional so P2's usage (no onClick) is unaffected — P2 selection stays on its sub-theme cells. Confirm P2's `ThemePlate` calls omit `onClick`.

- [ ] **Step 2: Verify** `npx tsc --noEmit` clean; `npm test` pass. Manual: in P1, clicking a theme now sets `selectedSectorId` → InspectorPanel shows that theme's detail (Task 2/3 wired it).

- [ ] **Step 3: Commit**
```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat: make P1 theme cells clickable (select theme)"
```

---

### Task 6: Gold selected-ring + emissive in the live scenes

**Files:** Modify `src/components/CapitalMapScene.tsx`

Visual/WebGL — verified in-browser; bar is tsc + tests green + correct id matching.

- [ ] **Step 1: Add a `SelectedRing` component** (module scope, near the other scene helpers)
```tsx
const SELECT_RING_COLOR = "#ffd54a";
const SELECT_RING_TAU = 0.2;

/** A gold line-loop just above a cell's polygon, fading in over ~0.2s. */
function SelectedRing({ polygon, y }: { polygon: ReadonlyArray<Point2D>; y: number }) {
  const matRef = useRef<THREE.LineBasicMaterial | null>(null);
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (const p of polygon) pts.push(p.x, y, p.z);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [polygon, y]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    const m = matRef.current;
    if (m) m.opacity = approach(m.opacity, 1, dt, SELECT_RING_TAU);
  });
  if (polygon.length < 3) return null;
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial ref={matRef} color={SELECT_RING_COLOR} transparent opacity={0} linewidth={2} />
    </lineLoop>
  );
}
```
(`approach` from `../domain/layoutEasing`, `Point2D` already used in the file.)

- [ ] **Step 2: Render the ring on the matching cell in each live scene**
- **P2 `SubThemeCapitalMapScene`:** after the sub-theme cells, add `{voronoiCells.filter(c => c.subThemeId === props.selectedSectorId).map(c => <SelectedRing key={`sel-${c.subThemeId}`} polygon={c.polygon} y={THEME_PLATE_THICKNESS + 0.02} />)}`.
- **P3 `P3CapitalMapScene`:** same against its `voronoiCells` and `props.selectedSectorId` (a stock's sub-theme).
- **P1 `ThemeCapitalMapScene`:** match `themeCells[i]` to `themeList[i].id === props.selectedSectorId` and draw a ring around that theme cell's polygon at `y = THEME_PLATE_THICKNESS + 0.02`.

- [ ] **Step 3: Emissive bump on the selected column**
In each live scene's column render, raise `emissiveIntensity` when the node's id matches `selectedSectorId` (P1: `node.theme.id`; P2: `node.subTheme.id`; P3: `node.subTheme.id`), e.g. `emissiveIntensity={isSelected ? 0.35 : 0.08}` — matching the `AnimatedColumnMesh` prop already in use.

- [ ] **Step 4: Verify** `npx tsc --noEmit` clean; `npm test` pass (no scene unit assertions for the ring). 

- [ ] **Step 5: Commit**
```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat: gold selected-ring + emissive on the selected cell (P1/P2/P3, ~0.2s fade)"
```

> **In-browser (user):** click cells in P1/P2/P3 — gold ring appears on the right cell + its column brightens, inspector shows that cell's 主力净流入/方向; ring follows SP2 animation; deselect clears it.

---

### Task 7: Inspector / list CSS polish

**Files:** Modify `src/components/InspectorPanel.tsx`, `src/App.css`

- [ ] **Step 1: Class the overview lists + relationship tags**
In `InspectorPanel.tsx` overview branch, give the two `<ul>` a class `overview-list` and each `<li>` `overview-row` (keep the name + `<strong>` value children). In `renderRelationshipReasons`, replace the inline-styled type `<span>` with `<span className="rel-tag" style={{ color: typeInfo.color }}>` (keep the per-type color inline; move font-size/weight to CSS).

- [ ] **Step 2: Add styles to `src/App.css`**
```css
.overview-list { display: grid; gap: 6px; margin: 8px 0 14px; padding: 0; list-style: none; }
.overview-row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; font-size: 13px; color: #b7c3c0; }
.rel-tag { font-size: 11px; font-weight: 600; }
```

- [ ] **Step 3: Verify** `npx vitest run src/components/InspectorPanel.test.tsx` (overview test still finds names/values) · `npx tsc --noEmit` clean · `npm run build` ok.

- [ ] **Step 4: Commit**
```bash
git add src/components/InspectorPanel.tsx src/App.css
git commit -m "feat: style overview lists + relationship tags"
```

---

### Task 8: Micro-interactions (transitions + loading pulse)

**Files:** Modify `src/App.css`

- [ ] **Step 1: Button transition** — add to the `button` rule (~line 29-34): `transition: border-color .15s ease, background .15s ease, color .15s ease;`
- [ ] **Step 2: Loading pulse** — replace the static `.loading-state` with a gentle pulse:
```css
.loading-state { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #8a96ad; font-size: 14px; letter-spacing: .04em; animation: loading-pulse 1.4s ease-in-out infinite; }
@keyframes loading-pulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
```
- [ ] **Step 3: Verify** `npm run build` ok; `npm test` pass.
- [ ] **Step 4: Commit**
```bash
git add src/App.css
git commit -m "feat: button transitions + loading pulse"
```

---

### Task 9: Typography / contrast / spacing

**Files:** Modify `src/App.css`

- [ ] **Step 1: Contrast + rhythm** — audit the three low-contrast secondary colors and lift the weakest where they fail AA on their backgrounds (e.g. `.eyebrow`/`.inspector-kicker` `#9ba8a7` → `#aebaB8`-ish; `.compact-note p` `#a4afad`; inspector `p` `#aab7b3`). Tighten heading margins for consistent rhythm (`h1`, `.section-title`, `.inspector-panel h2/h3`). Keep the palette + red accent; do NOT rename the header. Make minimal, conservative changes.
- [ ] **Step 2: Verify** `npm run build` ok; `npm test` pass.
- [ ] **Step 3: Commit**
```bash
git add src/App.css
git commit -m "polish: typography rhythm + secondary-text contrast (AA)"
```

> **In-browser (user):** overall hierarchy/contrast reads well; nothing regressed on desktop or mobile.

---

### Task 10: Full gate + reconcile

- [ ] **Step 1:** Run `npm test` · `npx tsc --noEmit` · `npm run build` · `python3 -m pytest server/tests -q` (90).
- [ ] **Step 2:** Fix any regression without weakening assertions (esp. the InspectorPanel empty-state/overview tests, intentionally updated). Show diffs for any test changed.
- [ ] **Step 3:** Commit if needed.

---

### Task 11: Final review + finish branch

- [ ] **Step 1:** Dispatch a final whole-branch review (gate + spec coverage + honesty: presentation-only, no data/heat/layout/registry/backend changes; "模拟" only in demo; desktop+mobile intact; selection wired end-to-end).
- [ ] **Step 2:** User in-browser sign-off (selection ring + inspector detail across P1/P2/P3, copy, lists, transitions, typography).
- [ ] **Step 3:** Use **superpowers:finishing-a-development-branch** to merge `feat/ui-interaction-polish` → `main`.

---

## Self-review

**Spec coverage:** copy/honesty (§1) → Task 2 (live-detail label + empty copy + legacy label) ; selection wiring (§2) → Tasks 1 (view-model), 3 (App), 4 (thread id), 5 (P1 clickable), 6 (ring+emissive); inspector/lists (§3) → Task 7; micro-interactions (§2) → Task 8; typography (§4) → Task 9; testing → Tasks 1/2 unit + Task 10 gate. ✅ All mapped.

**Placeholder scan:** the two scene tasks (5, 6) give component code + exact seams + per-scene id matching rather than a full re-print of the 1400-line scene — appropriate for WebGL work verified in-browser. Task 9 (contrast) is inherently a visual audit; it names the exact colors/selectors and bounds the change ("minimal, conservative"). All other steps have full code + commands.

**Type consistency:** `buildSelectionDetail(selectedSectorId, viewMode, {themes,subThemes,byTheme,bySubTheme}) → SelectionDetail|null`; `SelectionDetail {kind,name,parentThemeName?,netInflow,direction}`; InspectorPanel props `selection?: SelectionDetail`, `isDemo?: boolean`; scene prop `selectedSectorId?: SectorId`; `SelectedRing({polygon,y})`. Names consistent across Tasks 1-6.
