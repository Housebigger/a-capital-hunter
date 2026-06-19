# A Capital Hunter · A主猎人

**English** · [简体中文](./README.zh-CN.md)

A React + Three.js 3D visualization that maps A-share market sector capital
flows onto an interactive 3D surface. Sectors are positioned by
industrial-chain / market-comovement relationships; column height encodes net
capital inflow intensity. The UI is Chinese; code identifiers are English.

## Screenshots

![A Capital Hunter — P1 theme map](image_log/Screenshot%202026-06-19%20at%2007.56.35.png)

> **P1 (主线)** — the 11 themes as a Voronoi map; column height & color encode
> main-force net inflow (red = inflow, green = outflow), and the right rail
> ranks the top 净流入 / 净流出.

![Drill-down to sub-themes and stocks](image_log/Screenshot%202026-06-19%20at%2007.57.50.png)

> **P2 (子题材) / P3 (个股)** — sub-theme and individual-stock cells nested
> inside each theme cell.

The [`image_log/`](./image_log) folder is the project's **visual changelog**:
it archives full-resolution screenshots of the *actual rendered output* across
versions (the two above are the latest real effect shots). It is documentation
only — no application or build code reads from it.

## Quick Start

Prerequisites: **Node 18+** and **Python 3.9+**.

```bash
# 1. Clone
git clone https://github.com/Housebigger/a-capital-hunter.git
cd a-capital-hunter

# 2. Install dependencies (JS + Python)
npm install
python3 -m pip install -r server/requirements.txt

# 3. Configure the data source
cp .env.example .env
#   Fill in TUSHARE_TOKEN — register free at https://tushare.pro/register,
#   then copy the token from https://tushare.pro/user/token.

# 4. Collect snapshots into SQLite (the sync reads .env from the environment)
set -a; source .env; set +a
npm run sync:capital-flow                     # latest trading day only
npm run sync:capital-flow -- --backfill 20    # recommended: 20 trading days,
                                              # so 今日 / 近5日 / 近10日 / 近20日
                                              # windows each show a distinct map

# 5. Run the full stack (Vite :5173 + Flask :5001)
npm run dev:full
```

Then open **http://localhost:5173**.

> A fresh clone ships **no** snapshot data — `server/data/*.sqlite3` is local
> state (gitignored). Step 4 populates it; until then the UI shows an explicit
> "no snapshot" error (by design — it never fabricates data).

> **Backend launch note:** start the backend from the **project root** as
> `python3 -m server.app` so the read-only snapshot Blueprint registers. The
> legacy `cd server && python3 app.py` only serves the AkShare diagnostic routes
> (a warning is logged). Run long-lived servers from your own terminal.

## Data pipeline

The map consumes **real end-of-day snapshots** — never simulated numbers
presented as real. The pipeline is **offline-collect, online-read-snapshot**:

```
Tushare moneyflow_dc  (源单位: 万元)
        │  日终采集器 (认证 → 代码标准化 → 去重 → ≥90% 覆盖判 ready/partial)
        ▼
本地 SQLite 快照库  (入库单位: 人民币元 CNY)
        │  Flask 只读 API (browser never triggers an upstream call)
        ▼
React Async DataProvider
        │  buildCapitalFlowAggregates (去重 P3 个股 → P2 子题材 → P1 主线)
        ▼
HunterScene → CapitalMapScene (R3F Canvas)
```

- **Metric:** main-force net inflow (主力净流入 = 超大单净额 + 大单净额).
- **Unit:** Tushare/JQData report 万元; the adapter converts to CNY (yuan) at ingest.
- **Cadence:** end-of-day. Both providers update money flow after market close.
- **Honesty:** the frontend throws on any fetch failure — it never silently
  swaps in mock data. When no snapshot exists the UI shows an explicit error
  with a **Retry** button and an opt-in **Load demo data** button (graceful
  degradation; demo mode is always labeled).

### Data source: Tushare Pro (default) vs JQData

The `CapitalFlowSource` Protocol decouples the pipeline from any specific
vendor. Two implementations ship:

| Source | Region | Token | Main-force field | Cost |
|---|---|---|---|---|
| **Tushare Pro** (default) | ✅ None | free @ tushare.pro | `moneyflow_dc.net_amount` (direct) | 5000 pts (free, grindable) |
| Tushare (fallback) | ✅ None | free @ tushare.pro | computed from `moneyflow` buy/sell | **2000 pts** (free, grindable) |
| JQData | ❌ Mainland China only | joinquant.com | `net_amount_main` (direct) | **paid** money-flow module |

**Tushare is the default.** It has no region restriction, and its `moneyflow`
interface is reachable with a free 2000-point account (new accounts start at
~120 and grind up via community contributions). The adapter tries
`moneyflow_dc` (5000 points, direct main-force value) first; if the account
lacks that entitlement it **automatically degrades** to `moneyflow` (2000
points) and computes main-force net inflow as
`(buy_elg − sell_elg) + (buy_lg − sell_lg)`.

JQData is kept as an alternative for accounts that have **purchased** its
money-flow module — the base/free JQData account can authenticate but cannot
call `get_money_flow` (it's a paid module).

Switch sources via `CAPITAL_FLOW_SOURCE=tushare|jqdata` in `.env`.

### Coverage and status

A snapshot is `ready` when ≥ 90% of supported unique securities have a real
point; otherwise `partial` (still shown, with a warning). A `failed` snapshot
(0 usable points) is never written, so a bad day cannot overwrite a good one.

## Commands

```bash
npm run dev                # Vite dev server (localhost:5173)
npm run build              # tsc + Vite production build
npm test                   # Vitest unit suite (frontend)
npm run test:backend       # pytest (server/tests)
npm run e2e                # Playwright e2e (requires dev server running)
npm run sync:capital-flow  # Daily JQData → SQLite sync
npm run dev:full           # Vite + Flask concurrently
```

## Entitlement caveat

Tushare Pro's `moneyflow_dc` (direct main-force value) requires **5000 points**.
The adapter detects a permission denial and automatically falls back to
`moneyflow` (**2000 points**), computing main force from order-size components —
so the pipeline works even with a fresh account that only meets the lower tier.
New accounts start with ~120 points; reach 2000 by sharing articles or inviting
users on tushare.pro to unlock the fallback path, or 5000 for the direct path.

## Deployment (GitHub Pages)

The production site is **fully static**: a GitHub Action syncs the latest 20
trading days, exports them to static JSON, builds the SPA, and deploys to
GitHub Pages. The Tushare token is only used inside the Action (a repo secret)
and is never shipped to the browser. Local development is unchanged
(`npm run dev:full` still uses Flask + SQLite).

Pipeline (`.github/workflows/deploy.yml`, runs on a weekday cron, manual
dispatch, and pushes to `main`):

```
sync --backfill 20  →  export_static_data.py  →  build:pages  →  deploy-pages
```

One-time setup (you must do these):

1. **Add the token secret:** Settings → Secrets and variables → Actions → New
   repository secret → name `TUSHARE_TOKEN`, value = your tushare.pro token.
2. **Enable Pages:** Settings → Pages → Build and deployment → Source:
   **GitHub Actions**.
3. **First deploy:** Actions tab → *Deploy to GitHub Pages* → *Run workflow*
   (or wait for the cron). The site goes live at
   `https://housebigger.github.io/a-capital-hunter/`.

Build it yourself locally:

```bash
set -a; source .env; set +a
npm run sync:capital-flow -- --backfill 20
npm run export:data        # writes public/data/snapshot-*.json
npm run build:pages        # static bundle in dist/
```

**Disclaimer:** the public site shows "数据来源 Tushare · 仅供学习与展示，非投资
建议". Publicly redistributing Tushare-derived data may be subject to Tushare's
terms of service — review them before publishing.

## Architecture

See [`AGENTS.md`](./AGENTS.md) for the full domain/component map. Key points:

- **Domain layer (`src/domain/`)** is pure functions + frozen immutable data,
  zero React imports, fully unit-testable.
- **Shared registries (`src/data/*.json`)** are the single source of truth for
  stock / sub-theme mappings, consumed by both TypeScript and Python.
- **`CapitalFlowSource` Protocol** decouples the pipeline from JQData; a future
  Tushare adapter only needs to implement four methods.
- **Aggregation invariant:** P1 (theme) == P2 (sub-theme) == unique P3 totals,
  within 0.01 CNY, enforced both in the Python service and the TS aggregator.

## Legacy diagnostics

The Flask routes `/api/capital-flow/rank`, `/api/capital-flow/history`, and
`/api/health` wrap **AkShare** (Eastmoney scrape). They are retained for local
probing of that link but are **not** the product path — the frontend consumes
only the JQData snapshot endpoints (`/api/capital-flow/snapshot/*`, `/status`).
