# AGENTS.md

This file provides guidance to Codex (and other coding agents) when working with code in this repository. It mirrors `CLAUDE.md`; keep the two in sync.

## Project Overview

A Capital Hunter (A股主力资金动向捕捉神器) — a React + Three.js 3D visualization that maps A-share **main-force net capital inflow** (主力净流入) onto an interactive 3D surface. The 2D position of a column encodes industrial-chain / market-comovement relationships; column height encodes net inflow intensity. The UI is Chinese; code identifiers are English.

The map renders **three drill-down views** (toggled in `App.tsx` via `ViewMode`):
- **P1** — themes (主线, 11 of them)
- **P2** — sub-themes (子题材, 45)
- **P3** — individual stocks (个股, 184)

Data is **real end-of-day snapshots**, not simulated. The single most important product invariant: the frontend **never silently shows fake numbers as real** — on any fetch/validation failure it surfaces an explicit error with Retry, and demo data is only ever loaded via an opt-in button and always labeled "演示模式".

> **Current state / known blocker:** the data pipeline is complete and verified, but the browser frontend was last seen stuck on "等待真实资金流快照" despite the API returning real data. See `STATUS.md` for the full handoff, root-cause analysis, and the recommended next debugging steps (the suspect is the `App.tsx` load state machine / browser fetch layer, which unit tests bypass via a mock provider).

## Commands

```bash
# --- Frontend (Node) ---
npm run dev                # Vite dev server (localhost:5173, proxies /api → :5001)
npm run build              # tsc --noEmit check + Vite production build
npm test                   # Vitest unit suite once (jsdom)
npm run test:watch         # Vitest watch mode
npm run e2e                # Playwright e2e (needs dev server on 127.0.0.1:5173)

# --- Backend (Python) ---
python3 -m pip install -r server/requirements.txt   # one-time
npm run test:backend       # pytest server/tests  (python3 -m pytest server/tests -q)
npm run sync:capital-flow  # sync latest trading day from data source → SQLite
npm run dev:backend        # Flask API on :5001  (python3 -m server.app)

# --- Both at once ---
npm run dev:full           # Vite + Flask concurrently
```

Run a single frontend test file: `npx vitest run src/domain/capitalFlowAggregation.test.ts`
Run a single frontend test by name: `npx vitest run -t "test name pattern"`
Run a single backend test: `python3 -m pytest server/tests/test_service.py -q` (or `-k "pattern"`)
Sync a specific day: `npm run sync:capital-flow -- --trade-date 2026-06-17`

**Credentials:** `cp .env.example .env`, set `TUSHARE_TOKEN` (free at tushare.pro). The sync reads `.env` from the environment, so `set -a; source .env; set +a` before `npm run sync:capital-flow`.

## Tech Stack

**Frontend**
- **React 19** + **TypeScript** (strict, ES2022, `react-jsx`)
- **Three.js** via **@react-three/fiber** (R3F v9) + **@react-three/drei** — all 3D
- **d3-delaunay** — Voronoi tessellation for the sub-theme/stock layout
- **Vite 6** (`@vitejs/plugin-react`), **Vitest 3** (jsdom, globals; setup `src/test/setup.ts`)
- **Playwright** (Chromium, 1440×960), **Testing Library**, **Lucide React** icons

**Backend** (`server/`, Python 3)
- **Flask** (+ flask-cors, flask-caching) read-only snapshot API on port **5001**
- **SQLite** snapshot store (`server/data/capital_flow.sqlite3`)
- Data sources: **Tushare** (default), **JQData** (paid alt), **AkShare** (legacy diagnostics only)
- **pytest** for backend tests

## Architecture

### End-to-end data flow (offline-collect, online-read)

The browser **never triggers an upstream data-source call**. A daily CLI sync collects data into SQLite; the Flask API and React app only read that snapshot.

```
Tushare moneyflow_dc / moneyflow   (upstream, unit 万元)
      │  CapitalFlowSyncService: registry → source.fetch_daily → coverage check
      ▼
SQLite snapshot store  (unit converted to CNY at the adapter boundary)
      │  Flask read-only Blueprint  (/api/capital-flow/snapshot/*, /status)
      ▼   Vite dev proxy /api → :5001
React CapitalFlowDataProvider  (fetch + validate; throws, never mocks)
      │  buildCapitalFlowAggregates(points)  → byTheme / bySubTheme / byStock (deduped)
      ▼
HunterScene → CapitalMapScene (R3F Canvas), P1 / P2 / P3 render nodes
```

### Backend (`server/capital_flow/`)

A clean four-layer pipeline; the `CapitalFlowSource` Protocol decouples it from any vendor SDK (tests inject fakes).

- **source.py** — `CapitalFlowSource` Protocol (`latest_trade_date`, `is_trade_date`, `fetch_daily`, `close`) + `JqDataCapitalFlowSource` and the Tushare adapter. Adapters convert 万元 → CNY at the boundary so nothing downstream knows the source unit. Tushare auto-degrades from `moneyflow_dc` (needs 5000 points, direct main-force) to `moneyflow` (2000 points, computes `主力 = (buy_elg−sell_elg)+(buy_lg−sell_lg)`).
- **models.py** — frozen dataclasses (`SourcePoint`, `SnapshotDraft`, `SnapshotFailure`, `StockMapping`, `RegistryResult`, etc.).
- **registry.py** — loads the **shared** `src/data/*.json` registries and normalizes security codes.
- **repository.py** — atomic SQLite snapshot read/write. **All DB access is serialized with an `RLock`** (`check_same_thread=False` + lock) — this is load-bearing: concurrent cross-thread SQLite access previously caused a Flask SIGSEGV.
- **service.py** — `CapitalFlowSyncService` orchestrates registry + source + repository. Coverage rule: `succeeded/requested ≥ 0.9` → `ready`; any positive below → `partial`; **0 usable points → raise, never write** (a bad day can't overwrite a good snapshot). `latest` walks back up to `LATEST_FALLBACK_DAYS=5` when today's EOD data isn't published yet.
- **sync.py** — CLI entry + source-selection factory (reads `CAPITAL_FLOW_SOURCE`).
- **api.py** — `create_capital_flow_blueprint(repo)`: 3 **read-only** routes (`/snapshot/latest`, `/snapshot?trade_date=`, `/status`). Uniform error shape `{"error": {"code", "message"}}`; 404 = no snapshot, 503 = DB unreadable. Repo is injected so tests pass a temp DB.
- **app.py** — Flask app. Registers the snapshot Blueprint *and* contains **legacy AkShare diagnostic routes** (`/api/capital-flow/rank|history`, `/api/health`) that scrape Eastmoney — these are NOT the product path, the frontend ignores them.

### Frontend data layer (`src/data/`)

- **capitalFlowSnapshot.ts** — the API wire contract (`CapitalFlowSnapshot`, `StockCapitalFlowPoint`, `CapitalFlowStatus`) + strict runtime validators (`parseSnapshot`/`parseStatus`). Rejects missing metadata, non-finite money values, wrong `metric`/`unit`/`status` literals — anything that could let a malformed payload masquerade as real data. Throws `InvalidSnapshotError`.
- **capitalFlowDataProvider.ts** — `CapitalFlowDataProvider` interface (`fetchLatest`/`fetchDate`/`fetchStatus`) — the **only** module that talks to the Flask API. 10s fetch timeout; validates every response; throws structured error codes; **never falls back to mock data**.
- **stockRegistry.json** (184 stocks) / **subThemeRegistry.json** (45 sub-themes) — the **single source of truth shared by TS and Python**. Editing a mapping here changes both the backend sync and the frontend.

### Domain layer (`src/domain/`)

Pure functions / frozen immutable data, **zero React imports**, fully unit-testable.

- **types.ts** — shared `readonly` interfaces (`Theme`, `Sector`, `RelationshipEdge`, `LayoutStage`, `RenderNode`, `MarketScenario`, etc.).
- **themeRegistry.ts** — frozen `themes` (11) + `sectors`, built from config arrays.
- **stockRegistry.ts** / **subThemeRegistry.ts** — typed loaders over the shared JSON registries.
- **relationshipRegistry.ts** — weighted typed edges (`industrial-chain` | `market-comovement` | `heat-correction`) with `validateRelationshipEdges()`.
- **layoutStages.ts** — 5 `LayoutStage` rotation phases (linked via `previousStageId`). NOTE: the app currently pins `layoutStages[0]` — layout is static relative to data; stages are legacy scaffolding.
- **Layout engines (current, Voronoi-based):**
  - **themeVoronoiLayoutEngine.ts** / **themeVoronoiLayoutProvider.ts** — P1 theme cells.
  - **voronoiLayoutEngine.ts** / **voronoiLayoutProvider.ts** — P2 sub-theme cells, nested inside theme cells.
  - **stockLayoutEngine.ts** — P3 stock placement within sub-theme cells.
  - **circleClip.ts** / **polygonClip.ts** — geometry helpers that clip Voronoi cells to the circular map / parent polygons.
- **Layout engines (legacy, superseded by Voronoi):** `algorithmicLayoutEngine.ts`, `layoutProvider.ts` (manual + algorithmic providers). Still present and tested; not on the live render path.
- **capitalFlowAggregation.ts** — `buildCapitalFlowAggregates(points)` → `{ byTheme, bySubTheme, byStock }`. De-dupes via `aggregationRole` (`primary` vs `related`) so a stock counted in one place isn't double-counted. **Aggregation invariant: P1 total == P2 total == unique-P3 total within 0.01 CNY**, enforced both here and in the Python service.
- **renderNodes / themeRenderNodes / subThemeRenderNodes / stockRenderNodes.ts** — `build*RenderNodes(...)` join layout cells + aggregates (or a demo scenario) + filters into `RenderNode[]`.
- **metricNormalizer.ts** — raw CNY → 3D height, color (red=inflow, green=outflow, gray=flat), intensity.
- **scenarioDataProvider.ts** — simulated `MarketScenario` generator, used **only** for the opt-in demo mode fallback.

### State & app shell

- **state/useHunterState.ts** — single hook: theme/capital-state filters, camera preset, selected sector.
- **App.tsx** — owns the **snapshot load state machine** (`SnapshotViewState`: `loading | ready | partial | error | demo`) and `viewMode` (P1/P2/P3). `loadInitial` fetches status (best-effort) then the latest snapshot; date changes keep the prior scene visible while the new one loads. This state machine is the prime suspect for the current frontend blocker (see `STATUS.md`).
- **components/** — `HunterScene` (R3F Canvas + lighting + OrbitControls), `CapitalMapScene` (grid, clickable cells, columns, drei `Text` labels, camera transitions), `ControlsPanel` (date picker, view-mode/filter/camera controls), `InspectorPanel` (selected-sector detail), `DataStatus` (loading/error/retry/load-demo banner), `SceneLegend`.

## Key invariants & design principles

- **Honesty (load-bearing):** real data or an explicit error — never silent mock data. Validators throw; demo mode is opt-in and labeled.
- **Shared registries** (`src/data/*.json`) are the single source of truth for stock/sub-theme mappings consumed by **both** TypeScript and Python. Keep them in sync.
- **Aggregation invariant:** P1 == P2 == unique-P3 totals within 0.01 CNY, enforced on both sides.
- **Protocol/interface seams:** `CapitalFlowSource` (Python) and `CapitalFlowDataProvider`/`LayoutProvider` (TS) let you swap source/transport/layout without touching consumers.
- **Domain layer has zero React imports**; registries are `Object.freeze`-deep and consumed immutably.
- Tests are co-located (`Foo.ts` → `Foo.test.ts`).

## Operational notes (hard-won; don't regress)

- **Launch Flask from the project root** as `python3 -m server.app`. The legacy `cd server && python3 app.py` skips the snapshot Blueprint (only serves AkShare diagnostics) because the `server.*` package import fails.
- **Proxy env vars are cleared on startup by default** (`app.py`). The upstream Chinese endpoints break behind a VPN/proxy. Opt out with `KEEP_PROXY_ON_STARTUP=true`. (An earlier `env -u` proxy wrapper caused a macOS segfault — don't reintroduce it.)
- Flask runs `debug=False, use_reloader=False, threaded=True`. The reloader fork re-creates the module-level SQLite repo and has crashed the app on macOS — leave it off.
- **Long-running servers must be run from the user's own terminal.** Background processes started by an agent tool get reaped by the harness between turns; agent-launched servers are only for short verification.
- Tushare entitlements: `moneyflow_dc` needs 5000 points; the adapter auto-degrades to `moneyflow` (2000 points). New accounts start ~120 and grind up.

## Test conventions

- Frontend: Vitest globals (`describe`/`it`/`expect`, no imports); component tests use Testing Library + jsdom; `vitest.config` excludes `node_modules`, `dist`, `.worktrees/**`, `tests/e2e/**`. ~156 tests.
- Backend: pytest in `server/tests/` (one file per module + `test_tushare_source.py`); inject fake sources / temp repositories. ~53 tests.
- E2E: Playwright in `tests/e2e/`, expects the dev server on `http://127.0.0.1:5173`; uses a fixture mock (does **not** exercise the real network — which is why it can't catch the current browser blocker).

## Related docs

- **STATUS.md** — current progress, the unresolved frontend-rendering blocker, root-cause notes, and next steps (read this first when picking up the project).
- **README.md** — setup, the data pipeline, and the Tushare-vs-JQData source comparison.
- **CLAUDE.md** — Claude Code's guidance file; this AGENTS.md mirrors it.
- **docs/superpowers/{plans,specs}/** — generation-by-generation design history (gen2 layout engine → gen10 real data source → JQData/Tushare capital flow).
