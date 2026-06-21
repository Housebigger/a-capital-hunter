# SP2 — Heat-Driven Dynamic Layout — Design

**Date:** 2026-06-22
**Status:** Approved (design); spec under review
**Sub-project:** SP2 of the pre-publish optimization set (SP1 content depth done; SP3 mobile, SP4 polish, SP5 SEO remain).

## Goal

Make the **P1 theme** and **P2 sub-theme** Voronoi cells' **position and size flow with live market heat** (|主力净流入| in the active time window), animated smoothly when the window/snapshot changes — while keeping the industrial-chain / market-comovement **relationship structure as the position anchor** and never hiding real data. This delivers the product's "动态捕捉" promise (today the layout is static, pinned to `layoutStages[0]`).

## Approved decisions

| Decision | Choice |
|---|---|
| Heat metric | `|主力净流入|` (absolute value) — big inflow OR big outflow are both "hot" |
| What flows | Cell **size + gentle position drift** (relationship-anchored), not full rearrangement |
| Animation | **Smooth ~0.6s eased** transition on window/snapshot change |
| Scope | **P1 themes + P2 sub-themes**; P3 stocks unchanged |
| Unchanged | Column height & color (already encode signed net inflow via `metricNormalizer`) |

## Heat model — `src/domain/heatMap.ts` (new, pure, zero React)

`buildHeatMap(aggregates) → { themeHeat: Record<ThemeId, number>, subThemeHeat: Record<string, number> }`

- **Theme heat:** `themeHeat[t] = |byTheme[t]| / maxAbsTheme`, clamped to [0,1], where `maxAbsTheme = max over the 11 themes of |byTheme|`. Normalized **across all themes**.
- **Sub-theme heat:** `subThemeHeat[s] = |bySubTheme[s]| / maxAbsInParentTheme`, clamped to [0,1], normalized **within the sub-theme's parent theme** (so a theme's sub-themes size relative to each other, not to the whole market).
- **Source:** the **active window's** `aggregates` (`buildCapitalFlowAggregates` over the current snapshot/window). Switching 今日/近5日/近10日/近20日 recomputes heat → re-flows the layout.
- **All-flat / empty:** if `maxAbs == 0`, every heat is 0 → a uniform layout (the size floor makes all cells equal). Honest, no division-by-zero.
- **Demo mode:** derive heat from the scenario's per-sector/theme values (demo already provides these); never fabricate heat for real mode.

Pure and fully unit-testable.

## Layout

### P1 themes — `themeVoronoiLayoutEngine.ts` (modify)
The engine already consumes a `themeHeat` map for (a) initial radial inward-pull (`baseRadius − heat·maxInward`) and (b) a Lloyd-relaxation center-bias — hot themes drift toward center and claim more Voronoi area. **Change: feed LIVE `themeHeat` (from `buildHeatMap`) instead of the static `layoutStages[0]` heat.** The cross-theme relationship-pull (weighted `relationshipEdges`) is retained as the position anchor; the heat inward-pull is kept moderate so positions stay recognizable.

### P2 sub-themes — `voronoiLayoutEngine.ts` (modify)
Today sub-theme cells are equal-area (Lloyd equalizes them); the `areaWeight` field exists but is unused. **Change: drive cell area by live `subThemeHeat`** — weight each sub-theme's target area as `weight(s) = floor + (1 − floor)·subThemeHeat[s]`, and bias seed placement / Lloyd toward those weights so hot sub-themes get larger cells, plus a gentle center drift within the parent theme polygon.

### Size floor — cold cells stay visible (honesty rule, load-bearing)
A real but cold theme/sub-theme must never disappear from the map. The mechanism differs by level because P1 area is emergent while P2 area is weighted:
- **P2 (explicit):** `weight(s) = floor + (1 − floor)·subThemeHeat[s]` biases area, and the engine's **existing `enforceAreaFloor` pass** (today 35% of the theme's average) is reused/tuned to keep every sub-theme cell **≥ ~40% of its equal share** (`equalShare = themeArea / subThemeCount`).
- **P1 (emergent):** theme area emerges from the Voronoi of the heat-shifted seeds, so there is no direct weight to floor. Cold themes are kept visible by **bounding the heat inward-pull** (moderate magnitude, so no seed is squeezed off the map); if in-browser review shows a cold theme getting too thin, add a P1 area-floor post-pass analogous to P2's. Either way no theme vanishes.

### P3 stocks
Unchanged. Column height/color already encode signed net inflow; stocks are placed geometrically within their (now heat-sized) sub-theme cell.

## Dynamic recompute + animation

- **Providers take heat:** `themeVoronoiLayoutProvider.getLayout(...)` and `voronoiLayoutProvider.getLayout(...)` gain a `heatMap` parameter.
- **App recomputes on change:** `App.tsx` computes `heatMap = buildHeatMap(aggregates)` and passes it to the providers; the layout `useMemo`s gain `heatMap` (or the active window) as a dependency, so layout recomputes when the window/snapshot changes (today it computes once). This is the single wiring change the architecture trace identified.
- **Animation (`CapitalMapScene.tsx`):** on layout change, ease cell **center positions**, a per-cell **scale**, and **column heights** to the new layout over **~0.6s** (easeInOutCubic), reusing the existing camera-transition pattern. Voronoi **polygon geometry recomputes** at the new layout (shape may "pop"); the columns/positions/heights animate. (Smooth polygon morphing is out of scope — accepted.)

## Honesty & stability invariants (preserved)

- Heat is computed from the **real snapshot** (or the labeled demo scenario) — never fabricated.
- The **size floor** guarantees cold real cells stay visible/clickable.
- **Relationship structure remains the position anchor** — the map stays recognizable across days (mental map preserved); heat adds moderate drift, not a full rearrange.
- Column height/color semantics unchanged; the aggregation invariant (P1==P2==unique-P3) and registry validators are untouched.

## Components & files

| File | Change |
|---|---|
| `src/domain/heatMap.ts` (new) | Pure `buildHeatMap(aggregates)` → theme/sub-theme heat (abs, normalized, floored-input). |
| `src/domain/heatMap.test.ts` (new) | Unit tests. |
| `src/domain/themeVoronoiLayoutEngine.ts` | Accept live `themeHeat`; keep relationship anchor; bound heat inward-pull so cold themes stay visible (area is emergent). |
| `src/domain/voronoiLayoutEngine.ts` | Accept `subThemeHeat`; weight cell areas (wire `areaWeight` seam to live heat); enforce size floor. |
| `src/domain/themeVoronoiLayoutProvider.ts` / `voronoiLayoutProvider.ts` | Add `heatMap` param; pass through. |
| `src/App.tsx` | Build heat from aggregates; pass to providers; add to layout `useMemo` deps. |
| `src/components/CapitalMapScene.tsx` | Animate cell centers + scale + column heights (~0.6s) on layout change. |

## Testing strategy

- **`heatMap.test.ts`:** absolute value (inflow & outflow both heat); theme heat normalized across 11; sub-theme heat normalized within parent; clamp [0,1]; all-flat → all 0 (no NaN); floor applied.
- **Engine tests:** a hot theme ends with larger area + more central position than a cold one; a hot sub-theme gets a larger cell than a cold sibling; the size floor is respected (no cell below 40% equal share); relationship anchor still pulls related themes together; deterministic output for the same heat input.
- **Update existing layout tests** that assume the static `layoutStages[0]` layout to pass a heat map (or a uniform heat that reproduces today's behavior).
- **Aggregation/registry invariants:** untouched (no changes there).
- **Animation:** logic of the interpolation (start→end over t) unit-tested if extracted; the visual transition is verified in-browser.

## Risks & considerations

- **Polygon "pop":** smooth polygon morphing is hard (topology changes); we animate columns/positions/sizes and recompute polygons. Accepted; can cross-fade later if jarring.
- **Recompute cost:** recomputing the Voronoi on every window switch is cheap (11 themes, ≤8 sub-themes/theme) — well within frame budget; memoize per (window, snapshot).
- **Layout-test churn:** several existing tests assume the pinned static layout; they need a heat input. Bounded.
- **Stability tuning:** the heat inward-pull / drift magnitude is a feel parameter; default moderate, tunable after in-browser review.

## Out of scope

- P3 stock layout by heat (height already encodes flow).
- Full smooth polygon morphing.
- New data / registry changes (SP1 done), mobile (SP3), polish (SP4), SEO (SP5).
- The legacy `layoutStages` rotation mechanism / `algorithmicLayoutEngine` (not on the live path).
