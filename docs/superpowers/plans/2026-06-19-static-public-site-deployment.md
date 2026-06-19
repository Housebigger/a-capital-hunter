# Static Public Site Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish A主猎人 as a fully static GitHub Pages site, refreshed daily by GitHub Actions, exporting the daily snapshot to static JSON the browser fetches and validates with the existing `parseSnapshot`.

**Architecture:** Production becomes static: a Python exporter turns the SQLite snapshot into `public/data/snapshot-{1d,5d,10d,20d}.json`; a new static `CapitalFlowDataProvider` fetches those files (same validation as today); a GitHub Action syncs → exports → builds (`--base=/a-capital-hunter/`) → deploys to Pages. The Flask backend and SQLite stay for local dev only.

**Tech Stack:** Python 3 (exporter, reuses `SnapshotRepository`), React 19 + Vite 6 + TypeScript (static provider, disclaimer), Vitest + pytest (tests), GitHub Actions + GitHub Pages (deploy).

**Spec:** `docs/superpowers/specs/2026-06-19-static-public-site-deployment-design.md`

**Branch:** Implement on a feature branch `feat/static-public-site` (NOT `main`). See Task 0.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/export_static_data.py` (new) | Export each window snapshot to `public/data/snapshot-<key>.json`; fail loudly if the store is empty. |
| `server/tests/test_export_static_data.py` (new) | Unit-test the exporter against a temp repo. |
| `src/data/capitalFlowDataProvider.ts` (modify) | Add `createStaticCapitalFlowDataProvider()` (fetches static JSON, reuses `request`/`parseSnapshot`). |
| `src/data/capitalFlowDataProvider.test.ts` (modify) | Add tests for the static provider. |
| `src/App.tsx` (modify) | Pick static provider in `import.meta.env.PROD`; render the disclaimer. |
| `src/components/SiteDisclaimer.tsx` (new) | Discreet data-source/disclaimer footer. |
| `src/components/SiteDisclaimer.test.tsx` (new) | Test the disclaimer renders. |
| `package.json` (modify) | `export:data` and `build:pages` scripts. |
| `.gitignore` (modify) | Ignore generated `public/data/*.json`. |
| `.github/workflows/deploy.yml` (new) | Daily/manual/push CI: sync → export → build → deploy Pages. |
| `README.md` / `README.zh-CN.md` (modify) | Deployment section + manual steps. |

> **Note on Vite base:** no `vite.config.ts` edit is needed — the base path is supplied purely via the `--base=/a-capital-hunter/` CLI flag in the `build:pages` script, which Vite reflects through `import.meta.env.BASE_URL`. Dev/test stay at base `/`.

---

### Task 0: Create the feature branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to the branch**

```bash
cd /Users/housebigger/Documents/01_work/playground_claude_code/ws_a_capital_hunter
git checkout -b feat/static-public-site
git status -sb   # expect: ## feat/static-public-site
```

---

### Task 1: Static data exporter (Python)

**Files:**
- Create: `scripts/export_static_data.py`
- Test: `server/tests/test_export_static_data.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_export_static_data.py`:

```python
import json
import sys
from datetime import date
from pathlib import Path

import pytest

# Repo root on sys.path so `scripts` (no __init__.py) imports as a namespace pkg.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.export_static_data import export_static_data
from server.capital_flow.models import SnapshotDraft, SourcePoint, StockMapping
from server.capital_flow.repository import SnapshotRepository


def _draft(trade_date, net=1_000_000.0) -> SnapshotDraft:
    point = SourcePoint("300308.XSHE", trade_date, net)
    mapping = StockMapping(
        stock_id="aci-zjxc",
        stock_name="中际旭创",
        short_name="中际旭创",
        raw_code="300308",
        security_code="300308.XSHE",
        sub_theme_id="optical-interconnect",
        theme_id="ai-computing",
        aggregation_role="primary",
    )
    return SnapshotDraft(
        trade_date=trade_date,
        fetched_at="2026-06-17T16:00:00Z",
        source="tushare",
        metric="net_amount_main",
        unit="CNY",
        status="ready",
        requested=1,
        succeeded=1,
        failed=0,
        points=[point],
        mappings=[mapping],
        failures=[],
        theme_totals={"ai-computing": net},
        sub_theme_totals={"optical-interconnect": net},
    )


def test_export_writes_one_file_per_window(tmp_path):
    db = tmp_path / "cf.sqlite3"
    repo = SnapshotRepository(db)
    repo.save_snapshot(_draft(date(2026, 6, 17)))
    repo.close()

    out = tmp_path / "data"
    written = export_static_data(db, out)

    assert sorted(p.name for p in written) == [
        "snapshot-10d.json",
        "snapshot-1d.json",
        "snapshot-20d.json",
        "snapshot-5d.json",
    ]
    payload = json.loads((out / "snapshot-1d.json").read_text(encoding="utf-8"))
    assert payload["tradeDate"] == "2026-06-17"
    assert payload["window"]["label"] == "今日"
    # The per-point tradeDate contract (the bug that once broke the frontend).
    assert payload["points"][0]["tradeDate"] == "2026-06-17"


def test_export_empty_store_exits_nonzero(tmp_path):
    db = tmp_path / "empty.sqlite3"
    SnapshotRepository(db).close()  # creates schema, no rows
    with pytest.raises(SystemExit):
        export_static_data(db, tmp_path / "data")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python3 -m pytest server/tests/test_export_static_data.py -q`
Expected: FAIL at collection — `ModuleNotFoundError: No module named 'scripts.export_static_data'`.

- [ ] **Step 3: Write the exporter**

Create `scripts/export_static_data.py`:

```python
"""Export the local snapshot store to static JSON for the public (static) site.

Run from the project root AFTER syncing data:

    python3 scripts/export_static_data.py

For each window in WINDOW_SPECS it calls SnapshotRepository.get_window_snapshot
and writes public/data/snapshot-<key>.json — the exact payload the production
frontend fetches and validates with parseSnapshot. Exits non-zero if the store
holds no snapshots, so CI fails loudly instead of deploying an empty site.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List

# Allow `python3 scripts/export_static_data.py` from the project root: the
# script's own directory (scripts/) is on sys.path by default, not the root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.capital_flow.repository import SnapshotRepository
from server.capital_flow.window import WINDOW_SPECS

DEFAULT_DB = Path("server/data/capital_flow.sqlite3")
OUT_DIR = Path("public/data")


def export_static_data(db_path: Path, out_dir: Path) -> List[Path]:
    """Write one JSON file per window; return the paths written.

    Raises SystemExit if the store has no snapshots.
    """
    repo = SnapshotRepository(db_path)
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        written: List[Path] = []
        for key, (days, label) in WINDOW_SPECS.items():
            snapshot = repo.get_window_snapshot(days, label)
            if snapshot is None:
                raise SystemExit(
                    f"no snapshots in {db_path}; run the sync before exporting"
                )
            path = out_dir / f"snapshot-{key}.json"
            path.write_text(
                json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            written.append(path)
        return written
    finally:
        repo.close()


def main() -> None:
    for path in export_static_data(DEFAULT_DB, OUT_DIR):
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python3 -m pytest server/tests/test_export_static_data.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/export_static_data.py server/tests/test_export_static_data.py
git commit -m "feat: export window snapshots to static JSON"
```

---

### Task 2: Static data provider (TypeScript)

**Files:**
- Modify: `src/data/capitalFlowDataProvider.ts`
- Test: `src/data/capitalFlowDataProvider.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/data/capitalFlowDataProvider.test.ts`, change the import on line 2 from:

```typescript
import { createCapitalFlowDataProvider } from "./capitalFlowDataProvider";
```

to:

```typescript
import {
  createCapitalFlowDataProvider,
  createStaticCapitalFlowDataProvider,
} from "./capitalFlowDataProvider";
```

Then append this describe block at the end of the file (it reuses the existing
`mockFetch`, `okJson`, and `snapshotFixture` already defined above):

```typescript
describe("createStaticCapitalFlowDataProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).fetch = mockFetch;
  });

  it("fetches the per-window static JSON file (base-relative)", async () => {
    mockFetch.mockResolvedValueOnce(okJson(snapshotFixture));
    await createStaticCapitalFlowDataProvider().fetchLatest("10d");
    expect(mockFetch).toHaveBeenCalledWith(
      "/data/snapshot-10d.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("defaults to the 1d file", async () => {
    mockFetch.mockResolvedValueOnce(okJson(snapshotFixture));
    await createStaticCapitalFlowDataProvider().fetchLatest();
    expect(mockFetch).toHaveBeenCalledWith(
      "/data/snapshot-1d.json",
      expect.any(Object)
    );
  });

  it("validates and rejects malformed payloads (no silent mock data)", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ source: "tushare", points: [] }));
    await expect(
      createStaticCapitalFlowDataProvider().fetchLatest()
    ).rejects.toThrow("Invalid capital flow snapshot");
  });

  it("has no per-date or status endpoint in static mode", async () => {
    await expect(
      createStaticCapitalFlowDataProvider().fetchDate("2026-06-11")
    ).rejects.toThrow("snapshot_unavailable");
    await expect(
      createStaticCapitalFlowDataProvider().fetchStatus()
    ).rejects.toThrow("snapshot_unavailable");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/data/capitalFlowDataProvider.test.ts`
Expected: FAIL — `createStaticCapitalFlowDataProvider` is not exported (import error / undefined).

- [ ] **Step 3: Implement the static provider**

In `src/data/capitalFlowDataProvider.ts`, append after the existing
`createCapitalFlowDataProvider` function:

```typescript
// Production (static) provider: the daily snapshot is exported to static JSON
// under <base>/data/ by scripts/export_static_data.py and fetched same-origin.
// import.meta.env.BASE_URL ends with "/" and reflects the Vite --base flag,
// so this resolves to "/data/..." in dev/test and "/a-capital-hunter/data/..."
// in the GitHub Pages build. Validation is identical to the live provider.
const STATIC_DATA_DIR = `${import.meta.env.BASE_URL}data`;

export function createStaticCapitalFlowDataProvider(): CapitalFlowDataProvider {
  return {
    fetchLatest(
      window: CapitalFlowWindowKey = "1d"
    ): Promise<CapitalFlowSnapshot> {
      return request(`${STATIC_DATA_DIR}/snapshot-${window}.json`, parseSnapshot);
    },
    fetchDate(): Promise<CapitalFlowSnapshot> {
      // Per-date browsing is not exported for the static site.
      return Promise.reject(new Error("snapshot_unavailable"));
    },
    fetchStatus(): Promise<CapitalFlowStatus> {
      // Status is not exported; the header reads the date from window meta.
      return Promise.reject(new Error("snapshot_unavailable"));
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/data/capitalFlowDataProvider.test.ts`
Expected: PASS (all tests in the file, old + new).

- [ ] **Step 5: Commit**

```bash
git add src/data/capitalFlowDataProvider.ts src/data/capitalFlowDataProvider.test.ts
git commit -m "feat: add static capital-flow data provider"
```

---

### Task 3: Disclaimer footer component

**Files:**
- Create: `src/components/SiteDisclaimer.tsx`
- Test: `src/components/SiteDisclaimer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/SiteDisclaimer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { SiteDisclaimer } from "./SiteDisclaimer";

it("renders the Tushare data-source disclaimer", () => {
  render(<SiteDisclaimer />);
  expect(screen.getByText(/数据来源 Tushare/)).toBeInTheDocument();
  expect(screen.getByText(/非投资建议/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/SiteDisclaimer.test.tsx`
Expected: FAIL — cannot find module `./SiteDisclaimer`.

- [ ] **Step 3: Implement the component**

Create `src/components/SiteDisclaimer.tsx`:

```tsx
/**
 * Always-visible footer for the public site: names the data source and states
 * the non-advice disclaimer. Self-contained inline styling (no dependency on
 * app CSS); pointer-events disabled so it never blocks the 3D canvas.
 */
export function SiteDisclaimer() {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "4px 8px",
        fontSize: "11px",
        lineHeight: 1.4,
        color: "rgba(255, 255, 255, 0.45)",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      数据来源 Tushare · 仅供学习与展示，非投资建议
    </footer>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/SiteDisclaimer.test.tsx`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add src/components/SiteDisclaimer.tsx src/components/SiteDisclaimer.test.tsx
git commit -m "feat: add site disclaimer footer"
```

---

### Task 4: Wire static provider + disclaimer into App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update the provider import**

In `src/App.tsx`, change the import (currently):

```typescript
import { createCapitalFlowDataProvider, type CapitalFlowDataProvider, type CapitalFlowWindowKey } from "./data/capitalFlowDataProvider";
```

to:

```typescript
import { createCapitalFlowDataProvider, createStaticCapitalFlowDataProvider, type CapitalFlowDataProvider, type CapitalFlowWindowKey } from "./data/capitalFlowDataProvider";
```

- [ ] **Step 2: Select the provider by build mode**

In `src/App.tsx`, change:

```typescript
const DEFAULT_DATA_PROVIDER = createCapitalFlowDataProvider();
```

to:

```typescript
// Production (static GitHub Pages build) reads exported JSON; local dev talks
// to the Flask proxy. Tests inject their own provider, so neither branch runs
// under test.
const DEFAULT_DATA_PROVIDER = import.meta.env.PROD
  ? createStaticCapitalFlowDataProvider()
  : createCapitalFlowDataProvider();
```

- [ ] **Step 3: Import and render the disclaimer**

In `src/App.tsx`, add to the imports:

```typescript
import { SiteDisclaimer } from "./components/SiteDisclaimer";
```

Then add `<SiteDisclaimer />` as the last child inside the top-level
`<main className="app-shell">`, immediately before its closing `</main>` tag.

- [ ] **Step 4: Verify types and existing tests pass**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (App tests inject a provider; unaffected by the new default).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: use static provider in production and show disclaimer"
```

---

### Task 5: npm scripts and gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add the scripts**

In `package.json`, add these two entries to the `"scripts"` object (after the
existing `"build"` line):

```json
    "export:data": "python3 scripts/export_static_data.py",
    "build:pages": "tsc && vite build --base=/a-capital-hunter/",
```

- [ ] **Step 2: Ignore generated data**

Append to `.gitignore`:

```
# Generated static snapshot data (produced by scripts/export_static_data.py)
public/data/*.json
```

- [ ] **Step 3: Verify export + build locally**

The working tree already has ~20 synced days in `server/data/capital_flow.sqlite3`.

Run: `npm run export:data`
Expected: prints `wrote public/data/snapshot-1d.json` … through `snapshot-20d.json`.

Run: `ls public/data` → expect the four `snapshot-*.json` files.
Run: `git status --short public/data` → expect **no output** (files are ignored).

Run: `npm run build:pages`
Expected: build succeeds; `ls dist/data` shows the four JSON files copied in.

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore
git commit -m "build: add export:data and build:pages scripts; ignore generated data"
```

---

### Task 6: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  schedule:
    # 12:00 UTC = 20:00 CST on weekdays, safely after A-share EOD data publishes.
    - cron: "0 12 * * 1-5"
  workflow_dispatch: {}
  push:
    branches: [main]
    paths-ignore:
      - "**.md"
      - "docs/**"
      - "image_log/**"

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: |
          python -m pip install -r server/requirements.txt
          npm ci

      - name: Sync capital-flow snapshots (last 20 trading days)
        env:
          TUSHARE_TOKEN: ${{ secrets.TUSHARE_TOKEN }}
          CAPITAL_FLOW_SOURCE: tushare
        run: python -m server.capital_flow.sync --backfill 20

      - name: Export static data
        run: python scripts/export_static_data.py

      - name: Build site
        run: npm run build:pages

      - uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - name: Deploy to GitHub Pages
        id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate the YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('valid yaml')"`
Expected: `valid yaml`.
(If it errors with `ModuleNotFoundError: No module named 'yaml'`, run
`python3 -m pip install pyyaml` first, then re-run.)

Review against this checklist:
- triggers: `schedule`, `workflow_dispatch`, `push` (with docs `paths-ignore`)
- permissions include `pages: write` and `id-token: write`
- sync step references `secrets.TUSHARE_TOKEN`
- order is sync → export → build → upload `dist` → deploy

> Full runtime validation happens on the first real run (Task 8 manual steps).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow with daily data refresh"
```

---

### Task 7: Deployment docs (English + Chinese READMEs)

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: Add a Deployment section to `README.md`**

Insert this section immediately before the `## Architecture` heading in
`README.md`:

```markdown
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
```

- [ ] **Step 2: Add the mirrored section to `README.zh-CN.md`**

Insert this section immediately before the `## 架构` heading in
`README.zh-CN.md`:

```markdown
## 部署（GitHub Pages）

线上站点是**全静态**的：一个 GitHub Action 回补最近 20 个交易日、导出为静态
JSON、构建 SPA 并部署到 GitHub Pages。Tushare token 只在 Action 内部使用（仓库
密钥），绝不下发到浏览器。本地开发不受影响（`npm run dev:full` 仍走 Flask +
SQLite）。

流水线（`.github/workflows/deploy.yml`，在工作日定时、手动触发、push 到 `main`
时运行）：

```
sync --backfill 20  →  export_static_data.py  →  build:pages  →  deploy-pages
```

一次性配置（需你自己完成）：

1. **添加 token 密钥：** Settings → Secrets and variables → Actions → New
   repository secret → 名称 `TUSHARE_TOKEN`，值为你的 tushare.pro token。
2. **启用 Pages：** Settings → Pages → Build and deployment → Source：
   **GitHub Actions**。
3. **首次部署：** Actions 页 →《Deploy to GitHub Pages》→《Run workflow》（或
   等待定时任务）。站点上线于
   `https://housebigger.github.io/a-capital-hunter/`。

本地自行构建：

```bash
set -a; source .env; set +a
npm run sync:capital-flow -- --backfill 20
npm run export:data        # 生成 public/data/snapshot-*.json
npm run build:pages        # 静态产物在 dist/
```

**免责声明：** 线上站点展示「数据来源 Tushare · 仅供学习与展示，非投资建议」。
公开转发 Tushare 衍生数据可能受其服务条款约束——发布前请先确认。
```

- [ ] **Step 3: Verify the docs render**

Run: `npx vitest run` is not needed here. Visually confirm both READMEs contain
the new section and the code fences are balanced (no stray ``` ```).

- [ ] **Step 4: Commit**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: document static GitHub Pages deployment"
```

---

### Task 8: Final integration gate

**Files:** none (verification + cleanup)

- [ ] **Step 1: Run the full backend suite**

Run: `python3 -m pytest server/tests -q`
Expected: all pass (74 = prior 72 + 2 new exporter tests).

- [ ] **Step 2: Run the full frontend suite**

Run: `npm test`
Expected: all pass (175 = prior 170 + 4 static-provider + 1 disclaimer).

- [ ] **Step 3: Type-check and production build**

Run: `npm run export:data && npm run build:pages`
Expected: exporter writes 4 files; `tsc` clean; Vite build succeeds; `ls dist/data`
shows the four `snapshot-*.json`.

- [ ] **Step 4: Confirm no generated data or secrets are staged**

Run: `git status --short`
Expected: clean (or only untracked `public/`, `dist/` which are gitignored).
Run: `git ls-files | grep -E 'public/data/.*json$|\.env$'` → expect **no output**.

- [ ] **Step 5: Finish the branch**

Use **superpowers:finishing-a-development-branch** to merge `feat/static-public-site`
into `main` and push. Then carry out the one-time manual steps from Task 7
(add `TUSHARE_TOKEN` secret, set Pages source, run the workflow).

---

## Self-review

**Spec coverage:**
- Static export → Task 1. Static provider → Task 2. Disclaimer → Task 3.
  App wiring + base path (via `--base`) → Task 4 + Task 5. CI workflow → Task 6.
  Docs + manual steps → Task 7. Honesty (same `parseSnapshot`) → Task 2 tests.
  Testing strategy → Tasks 1–3 + Task 8. ✅ all spec sections mapped.
- YAGNI trims (no `status.json`/`fetchStatus`/per-date) → Task 2 (`fetchDate`/
  `fetchStatus` reject). ✅
- The spec's "cross-language contract guard" is already satisfied by the existing
  `src/data/capitalFlowSnapshot.test.ts` parsing `backendSnapshot.sample.json`
  (produced by the same `get_window_snapshot` serializer the exporter uses); no
  new task required.

**Placeholder scan:** No TBD/TODO; every code/command step contains full content.

**Type consistency:** `createStaticCapitalFlowDataProvider` returns
`CapitalFlowDataProvider`; `fetchLatest(window?: CapitalFlowWindowKey)` matches
the interface; `request`/`parseSnapshot`/`parseStatus`/`CapitalFlowStatus` reuse
the existing module symbols. File path `public/data/snapshot-<key>.json` and the
provider URL `${BASE_URL}data/snapshot-${window}.json` agree. `WINDOW_SPECS`
keys (`1d/5d/10d/20d`) match the exporter filenames and the provider window keys.
