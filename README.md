# A Capital Hunter · A股主力资金动向捕捉神器

A React + Three.js 3D visualization that maps A-share market sector capital
flows onto an interactive 3D surface. Sectors are positioned by
industrial-chain / market-comovement relationships; column height encodes net
capital inflow intensity. The UI is Chinese; code identifiers are English.

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

## Setup

```bash
# 1. Install Python + JS dependencies
python3 -m pip install -r server/requirements.txt
npm install

# 2. Configure data source credentials
cp .env.example .env
#   … fill in TUSHARE_TOKEN (register free at https://tushare.pro/register,
#     then copy your token from https://tushare.pro/user/token) …

# 3. Sync the latest trading day into SQLite
set -a; source .env; set +a
npm run sync:capital-flow

# 4. Run the full stack (Vite + Flask on port 5001)
npm run dev:full
```

> **Backend launch note:** run Flask from the **project root** so the JQData
> Blueprint registers:
>
> ```bash
> python3 -m server.app
> ```
>
> The legacy `cd server && python3 app.py` launch still serves the AkShare
> diagnostic routes but skips the JQData Blueprint (a warning is logged).

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
