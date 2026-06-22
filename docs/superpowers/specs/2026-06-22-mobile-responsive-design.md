# SP3 — Mobile / Responsive — Design

**Date:** 2026-06-22
**Status:** Approved (design); spec under review
**Sub-project:** SP3 of the pre-publish optimization set (SP1 content depth done; SP2 heat-driven layout done; SP4 polish, SP5 SEO remain).

## Goal

Make "A主猎人" genuinely usable on a phone. The responsive **skeleton already exists** (`src/App.css` stacks the 3-column desktop workspace into a single column at ≤900px, with tweaks at ≤520px), so SP3 is about making the small-screen experience **solid** across three axes — layout ergonomics, touch interaction, and rendering performance — **without** changing the desktop experience, the data pipeline, or any product invariant.

## Approved decisions

| Decision | Choice |
|---|---|
| Scope | **Polish the existing single-column stack** (not a mobile-first redesign, not perf-only) |
| Phone layout | **Sticky primary-control bar** on top (time-window + view-mode), map directly below, secondary controls + inspector scroll under (mock option "B") |
| Touch model | **Two-finger rotate / pinch-zoom; one-finger drag scrolls the page; one-finger tap selects a cell** |
| Mobile quality | **Balanced** — cap `dpr` at 2, keep (lighter) shadows, reduce label density on phones |
| Desktop | **Unchanged** (≥900px 3-column workspace, mouse-orbit, full labels) |

## Architecture

A single `useIsMobile()` hook (wrapping `matchMedia`) is the **one source of truth** for the JS-driven mobile behaviors (touch config, dpr/shadow tuning, label density, which control bar renders). Pure-CSS concerns (the sticky bar styling, tap-target sizes, `.data-status` placement, `touch-action`) live in `src/App.css` under the existing breakpoints. Desktop code paths are reached whenever `isMobile` is false, so nothing about the desktop render changes.

- **Compact ("mobile") mode** is a *single* breakpoint, `matchMedia("(max-width: 900px)")`, aligned with the existing stacked-layout breakpoint — it drives the sticky bar, touch model, label density, and shadow tuning **together**, so touch tablets in the 640–900px range get the touch model too (not just phones). `dpr` is capped on all sizes. `≤520px` keeps its existing CSS fine-tuning. The 900px threshold is tunable after device testing.

### 1. Layout — sticky control bar

- New presentational components **`WindowSelector`** and **`ViewModeSelector`**, extracted from `ControlsPanel` so the markup/handlers are shared (no divergence between desktop and mobile).
- New **`MobileControlBar`** component: renders `WindowSelector` + `ViewModeSelector` in a `position: sticky; top: 0` bar. `App.tsx` renders it **above** the scene panel in the stacked layout; it is hidden on desktop via CSS. The map sits directly below, so changing a control re-flows a map that's already in view (no scroll round-trip).
- `ControlsPanel` (below the map in the stack) keeps the **secondary** controls — filters (already collapsible, default collapsed) and camera presets. In mobile its now-duplicated primary controls (window + view) are hidden via CSS so they live only in the sticky bar.
- `InspectorPanel` / overview stays last in the scroll order (existing `order: 3`).
- `.data-status` (today `position:absolute; top:14px; right:14px; max-width:46%`) is repositioned on small screens so it doesn't overlap the sticky bar or the scene toolbar.
- Desktop (`≥900px`): `MobileControlBar` is `display:none`; `ControlsPanel` shows everything as today. No layout change.

### 2. Touch interaction

- `HunterScene` `<OrbitControls>`, **only when `isMobile`**: `touches={{ ONE: THREE.TOUCH.NONE, TWO: THREE.TOUCH.DOLLY_ROTATE }}` — one finger no longer drives the camera, two fingers rotate + pinch-zoom. Desktop keeps default mouse orbit.
- The scene container gets `touch-action: pan-y` on mobile so a one-finger drag on the canvas scrolls the **page** (the browser handles it because OrbitControls no longer consumes one-finger gestures).
- **Tap-to-select is preserved**: a tap is a click (quick pointerdown/up, no drag), so the existing R3F `onClick` raycast on cells still fires — one finger taps to select in all cases.
- **Tap targets ≥44px** on touch: window pills, the view-mode segmented control, and the retry / load-demo buttons get larger min hit areas in the mobile CSS.

### 3. Performance + label density

- `Canvas dpr={[1, 2]}` — caps the device-pixel-ratio blow-up (phones report up to 3) that quadruples fragment work; `[1,2]` keeps it crisp without melting weaker GPUs. (Applies on all sizes; harmless on desktop.)
- Shadows **kept** (the "balanced" choice) but with a modest `shadow-mapSize` on mobile to keep the shadow pass cheap; antialias kept.
- **Label density on phones** (gate the *existing* visibility predicates with the mobile flag):
  - `shouldShowStockLabel` — P3 individual-stock labels **off by default** in compact mode; shown only for the currently selected sub-theme's stocks.
  - `shouldShowSubThemeLabel` — on phones, show labels only for larger cells (skip the smallest).
  - `legacyShouldShowLabel` — same mobile gating where it drives labels on the live path.
  - Desktop behavior is unchanged (flag false).

## Honesty & invariants (preserved)

- **No data / registry / aggregation changes.** Heat, snapshots, validators, the P1==P2==unique-P3 invariant, and the "real data or explicit error, never fake-as-real" rule are untouched — SP3 is presentation only.
- **Desktop unchanged.** Every mobile behavior is gated behind `isMobile` (JS) or a `≤900/≤520px` media query (CSS); the desktop render path is byte-for-byte the same.
- **SP2 heat-flow + ~0.6s animation continue to work** on mobile (label gating and dpr cap don't touch the layout/animation logic).

## Components & files

| File | Change |
|---|---|
| `src/hooks/useIsMobile.ts` (new) | `useIsMobile(query = "(max-width: 900px)")` → boolean, via `matchMedia` + listener; SSR-safe default `false`. |
| `src/components/WindowSelector.tsx` (new) | Extracted time-window pills (props: current window + onChange); used by `ControlsPanel` and `MobileControlBar`. |
| `src/components/ViewModeSelector.tsx` (new) | Extracted P1/P2/P3 segmented control; used by both. |
| `src/components/MobileControlBar.tsx` (new) | Sticky bar composing the two selectors; rendered above the scene in the stack. |
| `src/components/ControlsPanel.tsx` (modify) | Use the shared selectors; primary controls hidden in mobile (CSS), secondary (filters/camera) kept. |
| `src/App.tsx` (modify) | Compute `isMobile`; render `MobileControlBar` above the scene; thread `isMobile` into `HunterScene` + scene props. |
| `src/components/HunterScene.tsx` (modify) | `dpr={[1,2]}`; mobile shadow-mapSize; `OrbitControls touches` gated by `isMobile`. |
| `src/components/CapitalMapScene.tsx` (modify) | Thread the mobile flag into the `shouldShow*` label predicates; set `touch-action` on the scene container. |
| `src/App.css` (modify) | Sticky-bar styles; hide desktop primaries in mobile / mobile primaries on desktop; tap-target sizing; `.data-status` reposition; `touch-action: pan-y` on the scene container. |

## Testing strategy

- **`useIsMobile`** — unit test with a mocked `matchMedia`: returns the initial match, and updates when the (mocked) media query flips. SSR-safe default.
- **Label-density predicates** — unit test `shouldShowStockLabel` / `shouldShowSubThemeLabel` / `legacyShouldShowLabel` with the mobile flag on/off (mobile hides P3 individual labels / small-cell labels; desktop unchanged).
- **`MobileControlBar` + extracted selectors** — Testing Library: the window pills + view buttons render, and clicking each calls the supplied handler with the right value.
- **Regression** — all existing ~194 frontend tests stay green; the extraction of `WindowSelector`/`ViewModeSelector` must not change `ControlsPanel`'s behavior (its existing tests pass unchanged).
- **Not unit-testable (WebGL / real touch)** — `dpr`/shadow tuning, `OrbitControls touches`, and the one-finger-scroll-vs-two-finger-rotate behavior: verified **in-browser on a real device / devtools device mode** (the user's check, as with SP2's animation). The touch-action ↔ OrbitControls interplay is the highest-risk item.

## Risks & considerations

- **Touch ↔ scroll interplay** is the main risk: getting `touch-action: pan-y` + `OrbitControls touches` to reliably give "one-finger scrolls page, two-finger rotates, tap selects" across iOS Safari + Android Chrome needs device testing; the `ONE: TOUCH.NONE` config is the intended lever but may need a small tweak after testing.
- **Selector extraction** touches `ControlsPanel`; keep its public props/behavior identical so its tests don't regress.
- **Sticky bar height** eats vertical space on small phones; keep it slim (one row, wrapping pills if needed) so the map keeps ~55vh.
- **Label gating** must not change the *clickable* cells — only the text labels are hidden; tapping an unlabeled cell still selects it and reveals its name in the inspector.

## Out of scope

- Mobile-first redesign (bottom-sheet controls, full-bleed canvas, gesture-driven nav) — explicitly declined.
- Landscape-phone-specific layout (portrait is the design target; landscape just gets the stack).
- P3 stock *layout* changes (SP2 left P3 as-is; SP3 only changes its label density).
- UI/interaction polish beyond mobile (SP4) and share/SEO meta (SP5).
- Any data, registry, backend, or deployment change.
