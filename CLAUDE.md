# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Capital Hunter (A股主力资金动向捕捉神器) — a React + Three.js 3D visualization that maps A-share market sector capital flows onto an interactive 3D surface. Sectors are positioned by industrial-chain/market-comovement relationships; column height encodes net capital inflow intensity. The UI is in Chinese with English identifiers in code.

## Commands

```bash
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build
npm test             # Run all unit tests once (vitest, jsdom)
npm run test:watch   # Run tests in watch mode
npm run e2e          # Playwright e2e tests (requires dev server running)
```

Run a single test file: `npx vitest run src/domain/layoutProvider.test.ts`
Run a specific test: `npx vitest run -t "test name pattern"`

## Tech Stack

- **React 19** + **TypeScript** (strict mode, ES2022 target, `react-jsx`)
- **Three.js** via **@react-three/fiber** (R3F v9) + **@react-three/drei** — all 3D rendering
- **Vite 6** with `@vitejs/plugin-react`
- **Vitest 3** for unit tests (jsdom environment, globals enabled, setup at `src/test/setup.ts` which imports `@testing-library/jest-dom/vitest`)
- **Playwright** for e2e (Chromium only, viewport 1440×960)
- **Testing Library** (`@testing-library/react`, `@testing-library/user-event`)
- **Lucide React** for icons

## Architecture

### Data Flow (unidirectional)

```
themeRegistry + relationshipRegistry + layoutStages
        ↓
layoutProvider.getLayout(stageId) → SectorLayout
        ↓
buildRenderNodes(layout, scenario, filters) → RenderNode[]
        ↓
HunterScene → CapitalMapScene (R3F Canvas)
```

### Domain Layer (`src/domain/`)

All domain files are pure functions / immutable data with no React dependencies. This is the core of the application.

- **types.ts** — Shared type definitions (`Theme`, `Sector`, `RelationshipEdge`, `LayoutStage`, `RenderNode`, etc.). All domain interfaces use `readonly` properties.
- **themeRegistry.ts** — Immutable frozen arrays of `Theme` and `Sector` objects. Sectors belong to themes via `primaryThemeId`. ~38 sectors across 7 themes.
- **relationshipRegistry.ts** — Weighted, typed edges (`industrial-chain` | `market-comovement` | `heat-correction`) between sectors. Includes `validateRelationshipEdges()` for integrity checks.
- **layoutStages.ts** — 3 `LayoutStage` objects representing market rotation phases, each with per-theme and per-sector heat maps (0–1 scale). Stages form a linked list via `previousStageId`.
- **algorithmicLayoutEngine.ts** — Pure algorithmic positioning: theme anchors arranged radially, sectors placed by theme membership + relationship pull + heat-based inward shift, then snapped to an integer grid. Also generates `LayoutExplanation` records per sector.
- **layoutProvider.ts** — `LayoutProvider` interface (`getLayout(stageId)`) with two implementations: `createManualLayoutProvider` (hand-placed cells) and `createAlgorithmicLayoutProvider` (delegates to the engine).
- **renderNodes.ts** — `buildRenderNodes()` joins layout cells + scenario data + filters into `RenderNode[]` used by the 3D scene.
- **metricNormalizer.ts** — Converts raw capital values to 3D heights, colors (red=inflow, green=outflow, gray=flat), and intensity.
- **scenarioDataProvider.ts** — Generates `MarketScenario` objects from layout stages. Currently simulated data; `DataProvider` interface is ready for real data sources.

### State (`src/state/`)

- **useHunterState.ts** — Single hook managing all UI state: active scenario, theme/capital filters, camera preset, center-only toggle, selected sector.

### Components (`src/components/`)

- **HunterScene.tsx** — R3F `Canvas` wrapper with lighting and `OrbitControls`.
- **CapitalMapScene.tsx** — Core 3D scene: grid floor, clickable base cells per sector, capital columns, sector labels via drei `Text`. Handles camera preset transitions.
- **ControlsPanel.tsx** — Left sidebar: scenario timeline, theme/capital filters, camera preset, read-mode notes.
- **InspectorPanel.tsx** — Right sidebar: selected sector details, capital metrics, algorithmic layout explanations.
- **SceneLegend.tsx** — Overlay legend (inflow/outflow/flat color dots).

### Key Design Patterns

- Domain layer has **zero React imports** — all testable as pure functions.
- Data registries (`themes`, `sectors`, `relationshipEdges`) are `Object.freeze`-deep and consumed as immutable.
- `LayoutProvider` and `DataProvider` are interface-based; swapping implementations (manual → algorithmic, mock → real API) requires no component changes.
- Tests are co-located: `Foo.ts` → `Foo.test.ts` in the same directory.

## Test Conventions

- Unit tests use Vitest globals (`describe`, `it`, `expect`) — no imports needed.
- React component tests use `@testing-library/react` with jsdom.
- E2E tests in `tests/e2e/` use Playwright; they expect the dev server on `http://127.0.0.1:5173`.
- Vitest config excludes `.worktrees/**` and `tests/e2e/**`.
