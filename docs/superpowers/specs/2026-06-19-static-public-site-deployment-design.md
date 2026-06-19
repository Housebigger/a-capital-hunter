# Static Public Site Deployment — Design

**Date:** 2026-06-19
**Status:** Approved (design); spec under review
**Topic:** Publish A主猎人 (A Capital Hunter) as a public website

## Goal

Make A主猎人 publicly accessible on the internet as a **fully static site** on
**GitHub Pages**, refreshed **daily by GitHub Actions**, served under a **free
platform subdomain**, **publicly open with a disclaimer** — without exposing the
Tushare token and without changing the local development workflow.

## Approved decisions

| Decision | Choice |
|---|---|
| Deployment architecture | Fully static site (export snapshot → static JSON; no live server in prod) |
| Data refresh | GitHub Actions scheduled job (daily, after A-share close) |
| Host | GitHub Pages (project site at `https://housebigger.github.io/a-capital-hunter/`) |
| Domain | Free platform subdomain (custom domain deferred) |
| Access / compliance | Fully public + on-page disclaimer |
| CI data strategy | `sync --backfill 20` each run (stateless runners; windows need ~20 days) |

## Why this fits

The browser already never triggers an upstream data call — a daily CLI sync
populates SQLite and the app only reads a read-only snapshot. Production
therefore does not need a running server: the daily snapshot is exported to
static JSON, served from the same origin as the SPA. The Tushare token is used
**only** in the offline sync step (a CI secret), never shipped to the browser.

## Architecture & data flow

### Production (GitHub Actions → Pages)
```
GitHub Action  (cron weekdays after close · manual · push to main)
  1. setup Python + Node
  2. python -m server.capital_flow.sync --backfill 20   (TUSHARE_TOKEN secret)
        → ephemeral SQLite  (server/data/capital_flow.sqlite3, runner-local)
  3. python scripts/export_static_data.py
        → public/data/snapshot-1d.json
          public/data/snapshot-5d.json
          public/data/snapshot-10d.json
          public/data/snapshot-20d.json
  4. vite build --base=/a-capital-hunter/     (public/ is copied into dist/)
  5. actions/deploy-pages  →  deploy dist/   (no data committed to the repo)

Browser
  → GET /a-capital-hunter/data/snapshot-5d.json   (static, same-origin)
  → parseSnapshot(json)   (identical validation to today — honesty preserved)
  → render
```

### Local development (unchanged)
```
npm run dev:full → Vite (:5173, proxy /api → :5001) + Flask (:5001) + SQLite
```
The Flask backend, the SQLite store, and `npm run sync:capital-flow` are kept
exactly as they are. Only the **production** data path becomes static.

## Components & files

### New: `scripts/export_static_data.py`
- **Responsibility:** turn the local SQLite snapshot into the static JSON files
  the production frontend fetches.
- **How:** opens `SnapshotRepository`, calls `get_window_snapshot(days, label)`
  for each entry in `WINDOW_SPECS` (the same call `dump_snapshot_fixture.py`
  already uses), and writes each to `public/data/snapshot-<key>.json`.
- **Output dir:** `public/data/` (Vite copies `public/` verbatim into `dist/`).
- **Failure mode:** if the repository has no snapshots, exit non-zero with a
  clear message (so CI fails loudly rather than deploying an empty site).

### New: `createStaticCapitalFlowDataProvider()` in `src/data/capitalFlowDataProvider.ts`
- **Responsibility:** the production implementation of `CapitalFlowDataProvider`.
- `fetchLatest(window)` → `fetch(`${import.meta.env.BASE_URL}data/snapshot-${window}.json`)`,
  validated with the **same `parseSnapshot`** used today.
- `fetchDate(tradeDate)` and `fetchStatus()` → throw
  `Error("snapshot_unavailable")`. The live app calls neither (the header reads
  the trade date from the snapshot's own `window` meta); per-date and status
  files are not exported (YAGNI).
- Reuses the existing `request()` helper, timeout, and structured error codes, so
  the load state machine and error/Retry UI behave identically.

### Modified: `src/App.tsx`
- Default provider selection becomes:
  `import.meta.env.PROD ? createStaticCapitalFlowDataProvider() : createCapitalFlowDataProvider()`.
- Injected providers (tests) are unaffected. Dev uses the Flask provider.

### Modified: `vite.config.ts`
- Production `base = '/a-capital-hunter/'`, supplied via the `--base` build flag
  in CI. Dev/test base stays `/`. The static provider reads
  `import.meta.env.BASE_URL`, so data URLs resolve correctly under the subpath.

### New: disclaimer footer (small component, e.g. `src/components/SiteDisclaimer.tsx`)
- A discreet always-visible line:
  **「数据来源 Tushare · 仅供学习与展示，非投资建议」**
- Rendered in `App.tsx`. Independent of load state. Demo mode remains opt-in and
  labeled (unchanged).

### New: `.github/workflows/deploy.yml`
- **Triggers:** `schedule` (cron `0 12 * * 1-5` UTC ≈ 20:00 CST, safely after EOD
  publish; adjustable), `workflow_dispatch` (manual), and `push` to `main` with
  `paths-ignore: ['**.md', 'docs/**', 'image_log/**']` (doc/image pushes do not
  burn quota or redeploy).
- **Permissions:** `pages: write`, `id-token: write`, `contents: read`.
- **Concurrency:** one Pages deploy at a time.
- **Steps:** checkout → setup-python → setup-node → `pip install -r
  server/requirements.txt` → `npm ci` → sync `--backfill 20` (env
  `TUSHARE_TOKEN: ${{ secrets.TUSHARE_TOKEN }}`) → `export_static_data.py` →
  `vite build --base=/a-capital-hunter/` → `upload-pages-artifact` (dist/) →
  `deploy-pages`.

### Modified: `package.json`
- `export:data` → `python3 scripts/export_static_data.py`.
- `build:pages` → `vite build --base=/a-capital-hunter/` (CI build).
- Existing scripts untouched.

### Modified: `.gitignore`
- Ignore `public/data/*.json` (generated; only ever produced by the exporter,
  never hand-committed).

## Honesty invariants (preserved)

- Production validates every static JSON with the **same** `parseSnapshot` /
  `parseStatus` — a malformed or empty payload surfaces the explicit error +
  **Retry**, never silent mock data.
- Demo mode stays opt-in and labeled "演示模式".
- The exporter fails the build if there is no snapshot, so the site never ships
  a silently-empty state.

## Testing strategy

- **Static provider (vitest):** `fetchLatest` builds the URL from `BASE_URL`,
  parses a good payload, and throws on a bad/empty payload (fetch mocked).
- **Exporter (pytest):** given a temp repo with seeded snapshots,
  `export_static_data.py` writes the 4 window files, and each re-parses to the
  expected shape; empty repo → non-zero exit.
- **Cross-language contract guard (vitest):** run an exported sample through
  `parseSnapshot` (extends the existing `backendSnapshot.sample.json` fixture
  test) so backend shape drift fails CI.
- **Build smoke (CI):** `vite build --base=/a-capital-hunter/` succeeds.
- Existing 170 vitest + 72 pytest suites remain green.

## Manual steps (owned by the user)

1. **Add the secret:** repo → Settings → Secrets and variables → Actions → New
   repository secret → `TUSHARE_TOKEN`.
2. **Enable Pages:** repo → Settings → Pages → Build and deployment → Source:
   **GitHub Actions**.
3. **First run:** trigger the workflow manually (Actions tab → Deploy → Run
   workflow), or wait for the cron. Confirm the site at
   `https://housebigger.github.io/a-capital-hunter/`.
4. (Optional) adjust the cron time if EOD data is not yet published at 20:00 CST.

## Risks & considerations

- **Tushare ToS:** publicly redistributing Tushare-derived data may conflict
  with their terms; the disclaimer mitigates but does not eliminate this. User
  to confirm.
- **Tushare quota/rate limits in CI:** 20 calls/run; already verified locally
  (the working tree had 20 contiguous days from a local backfill). If a future
  tier hits a per-minute cap, add a short sleep between days in the workflow.
- **Non-trading days:** the cron runs weekdays; `latest`/`--backfill` walk back
  when today's EOD is not yet published, so the site keeps the last good day.
- **Base path:** all production asset/data URLs must be base-relative; covered by
  `--base` + `import.meta.env.BASE_URL`.

## Out of scope (future)

- Caching the SQLite/JSON between runs (actions/cache) to avoid re-fetching on
  code-only deploys.
- Custom domain.
- Per-date snapshot browsing in production (`fetchDate`).
- Removing the legacy Flask AkShare diagnostic routes.
