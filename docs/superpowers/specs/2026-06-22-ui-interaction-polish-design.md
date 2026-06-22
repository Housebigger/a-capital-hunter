# SP4 — UI / Interaction Polish — Design

**Date:** 2026-06-22
**Status:** Approved (design); spec under review
**Sub-project:** SP4 of the pre-publish optimization set (SP1 content, SP2 heat layout, SP3 mobile done; SP5 share/SEO remains).

## Goal

A focused UI/interaction polish pass before public release — no structural, data, layout, or heat changes. Four areas (all approved in scope): copy/honesty fixes, selected-cell feedback + micro-interactions, inspector/list styling, and typography/visual hierarchy. Everything stays behind the existing honesty rules; desktop and mobile both benefit (changes are either CSS or small component edits gated by nothing data-related).

## Approved decisions

| Decision | Choice |
|---|---|
| Scope | All four areas: (1) copy/honesty, (2) selected feedback + micro-interactions, (3) inspector/lists, (4) typography/hierarchy |
| Real-mode value label | **"主力净流入"** (the product's core term); **"模拟净流入"** only in demo mode |
| Selected-cell highlight | **Gold outline ring around the selected cell's polygon + brightened column `emissiveIntensity`** (mock option "A"); ~0.2s fade-in |
| Constraint | Presentation-only — no data/heat/layout/registry/backend changes; palette unchanged |

## 1. Copy / honesty fixes

`src/components/InspectorPanel.tsx` hardcodes **"模拟净流入"** (simulated net inflow) as the value-row label in all three detail views (stock, sub-theme, sector) — but in real mode the data is the real main-force net inflow, so this mislabels real data as fake. This is a (mild) honesty violation and confusing.

- Add an `isDemo: boolean` prop to `InspectorPanel`, passed from `App.tsx` (which already tracks `isDemo`). The value-row label becomes `isDemo ? "模拟净流入" : "主力净流入"` at all three sites (and the stock view). Demo stays correct (it *is* simulated).
- Rewrite the empty-state copy (currently `"点击板块查看资金状态"` + `"第三版展示资金方向、模拟净流入、算法布局解释和分题材信息。"`) to accurate, user-facing text, e.g. heading `"点击地图上的板块查看详情"` and body `"查看该板块的主力净流入、资金方向与产业链/联动关系解释。"` — drop the dev-internal "第三版" and the real-mode "模拟".
- Scan InspectorPanel (and adjacent visible copy) for any other "模拟"/"第三版"/gen-N dev language on the real-data path and correct it.

## 2. Selected feedback + micro-interactions

**Selected-cell highlight (option A):** Today clicking a cell only updates the right-hand InspectorPanel; the 3D map gives no "which one is selected" feedback.
- Thread `selectedSectorId` into the live scene props (`HunterScene` `sceneProps` for the `theme` / `subtheme` / `stock` modes — today only the legacy `voronoi`/default modes carry it) and into the live scene components.
- In `CapitalMapScene`'s live scenes, the cell whose id matches `selectedSectorId` renders a **gold outline ring** (a line loop around its polygon, color ~`#ffd54a`) and its column's `emissiveIntensity` is bumped. The ring fades in over ~0.2s (opacity ease; reuse the `approach`/`useFrame` pattern from SP2 or a simple CSS-less material opacity tween — keep it lightweight).
- Selecting clears/moves the ring to the new cell; deselect removes it. Must not disturb the heat-flow sizing/animation or clickability.

**Micro-interactions (CSS, `src/App.css`):**
- Add `transition: border-color .15s ease, background .15s ease` to `button` and `button.active` (currently instant).
- Polish the **loading state** (`.loading-state`, currently plain centered text) into a subtle pulsing indicator (CSS `@keyframes` opacity pulse on the existing text or a small dot) — no spinner library.
- Keep the existing `:focus-visible` outline (already good a11y) untouched.

## 3. Inspector / list polish

- The overview **Top 净流入 / 净流出 lists** (`InspectorPanel`, the `overview` branch) currently render as default browser `<ul><li>` bullets — restyle as clean aligned rows (name left, value right), reusing a shared row style akin to `.metric-row` (new `.overview-list` / `.overview-row` classes in `App.css`). Remove bullets/indentation.
- Move the **relationship tags** (`renderRelationshipReasons`, currently inline `style={{color,fontSize,fontWeight}}`) into CSS classes (e.g. `.rel-tag`) for consistency; keep the per-type color via a CSS custom property or a small class set.
- Tidy `h3` spacing and section dividers in the inspector for consistent vertical rhythm.

## 4. Typography / visual hierarchy

- Refine the type scale and spacing: top-bar (`.eyebrow` / `h1` / `.scenario-story`), `.section-title`, inspector headings — consistent sizes and margins.
- Improve secondary-text contrast to meet WCAG AA on the dark background (audit `#9ba8a7`, `#aab7b3`, `#a4afad` against their backgrounds; darken/lighten minimally where they fail).
- Tighten panel padding rhythm. **No palette redesign** — same dark theme + red accent; header keeps the Chinese eyebrow + "A Capital Hunter" wordmark (verify spacing/contrast, do not rename).

## Honesty & invariants (preserved / improved)

- **Improves honesty:** real main-force data is no longer labeled "模拟" — it's correctly "主力净流入"; demo stays "模拟". The real-data-or-explicit-error rule, validators, aggregation invariant, heat, and layout are all untouched.
- **Presentation-only:** no data, registry, backend, snapshot, or layout-math changes. SP2 heat-flow + SP3 mobile behavior continue unchanged (the selected ring is additive; label gating and `compact` are untouched).

## Components & files

| File | Change |
|---|---|
| `src/components/InspectorPanel.tsx` | `isDemo` prop → conditional value label; rewrite empty-state copy; list + relationship-tag classes. |
| `src/components/InspectorPanel.test.tsx` (extend) | Label-by-mode + copy + list-render assertions. |
| `src/App.tsx` | Pass `isDemo` to InspectorPanel; thread `selectedSectorId` into the live `HunterScene` usages. |
| `src/components/HunterScene.tsx` | Include `selectedSectorId` in the `theme`/`subtheme`/`stock` `sceneProps`. |
| `src/components/CapitalMapScene.tsx` | Gold selected-ring + emissive bump on the matching cell in the live scenes; ~0.2s fade-in. |
| `src/App.css` | Button/active transitions, loading pulse, overview-list + rel-tag styles, typography/spacing/contrast, ring color token. |

## Testing strategy

- **Unit (`InspectorPanel.test.tsx`):** value label is "主力净流入" when `isDemo=false` and "模拟净流入" when `isDemo=true` (stock + sub-theme + sector views); empty-state copy contains neither "第三版" nor "模拟" in real mode; overview branch renders name+value rows for Top inflow/outflow.
- **Optional pure helper:** if it clarifies the scene, extract `isSectorSelected(id, selectedId)` and unit-test it; otherwise inline.
- **Not unit-testable (WebGL/visual):** the gold ring + emissive, the ~0.2s fade, button transitions, loading pulse, and all typography/contrast/spacing → **in-browser verification** (user check, as in SP2/SP3).
- **Regression:** all existing ~200 frontend + 90 backend tests stay green; existing `InspectorPanel.test.tsx` assertions updated only where the copy/label intentionally changed (not weakened).

## Risks & considerations

- **`selectedSectorId` id matching:** the id a cell is keyed by (subThemeId vs sectorId vs stock id) must match what `onSelectSector` sets, per scene level — verify per live scene so the ring lands on the right cell. Main implementation risk.
- **Ring + heat animation overlap:** the selected ring must not interfere with SP2's eased size/position; render it as a separate additive line loop following the cell's current (animated) polygon/center.
- **Contrast tweaks** are subjective/visual — keep minimal and verify in-browser; don't churn the palette.
- **InspectorPanel test churn:** updating the label/copy assertions is expected and intentional; keep the behavioral intent.

## Out of scope

- SP5 (share/SEO meta, OG tags, favicon/title polish for sharing).
- Any data / heat / layout / registry / backend / deployment change.
- Palette redesign, new chart types, or new features.
- Hover-lift or other gesture-driven 3D affordances beyond the selected ring.
- Mobile-specific layout changes (SP3 owns those; SP4 copy/inspector/typography changes apply to both via shared components/CSS).
