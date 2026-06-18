# UI Polish (P0–P4) + Capital-Flow Time Windows (P5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two correctness bugs (header source label, toolbar overlap), add today/5d/10d/20d capital-flow time windows (history backfill + backend windowed aggregation + bucket selector), and polish the UI (inspector overview, collapsible notes, label/colour/camera).

**Architecture:** Backend stays "offline-collect → online-read". A new batch backfill stores ~20 daily snapshots; a pure `aggregate_window` sums per-stock daily net inflow across the latest N trading days; the read API gains a `window` query param and every snapshot response carries a uniform `window` field. The frontend swaps the date dropdown for a 4-button window selector and renders a non-empty inspector overview.

**Tech Stack:** Python 3 / Flask / SQLite / pytest (backend); React 19 + TypeScript + Vitest + Three.js (frontend).

**Spec:** `docs/superpowers/specs/2026-06-18-ui-polish-and-time-windows-design.md`

**Conventions:** Run backend tests with `python3 -m pytest`. Run a single frontend test with `npx vitest run <path>`. Commit after each task. Each phase is independently shippable.

---

## File Structure

**New files**
- `src/data/sourceLabel.ts` — pure `sourceLabel(source)` presentation helper (P0).
- `server/capital_flow/window.py` — pure `aggregate_window(...)` + window label map (P5).
- `src/domain/capitalFlowOverview.ts` — pure `buildOverview(...)` for the inspector overview (P2b).

**Modified files**
- `src/components/DataStatus.tsx`, `src/App.tsx`, `src/App.css` — P0, P1, P5 header, P2b wiring.
- `server/capital_flow/repository.py`, `api.py`, `service.py`, `sync.py` — P5 backend.
- `src/data/capitalFlowSnapshot.ts`, `src/data/capitalFlowDataProvider.ts` — P5 contract + fetch.
- `src/components/ControlsPanel.tsx` — P5 window selector, P4 collapsible notes.
- `src/components/InspectorPanel.tsx` — P2b overview.
- `src/components/SceneLegend.tsx` — P4 legend note.
- `src/components/CapitalMapScene.tsx` — P2a camera, P3a colour, P3b labels.
- `scripts/dump_snapshot_fixture.py`, `src/test/fixtures/backendSnapshot.sample.json`, `src/data/capitalFlowSnapshot.test.ts` — P5 contract regen.

---

## Phase 1 — Correctness bugs (P0, P1)

### Task 1: `sourceLabel` helper (P0)

**Files:**
- Create: `src/data/sourceLabel.ts`
- Test: `src/data/sourceLabel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/sourceLabel.test.ts
import { sourceLabel } from "./sourceLabel";

describe("sourceLabel", () => {
  it("maps known sources to display names", () => {
    expect(sourceLabel("tushare")).toBe("Tushare");
    expect(sourceLabel("jqdata")).toBe("JQData");
  });
  it("echoes an unknown source unchanged", () => {
    expect(sourceLabel("eastmoney")).toBe("eastmoney");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/data/sourceLabel.test.ts`
Expected: FAIL — `Failed to resolve import "./sourceLabel"`.

- [ ] **Step 3: Implement**

```ts
// src/data/sourceLabel.ts
/** Display name for a capital-flow data source. Single source of truth shared
 *  by App header and DataStatus so the two never disagree. */
const LABELS: Record<string, string> = { tushare: "Tushare", jqdata: "JQData" };

export function sourceLabel(source: string): string {
  return LABELS[source] ?? source;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/data/sourceLabel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/sourceLabel.ts src/data/sourceLabel.test.ts
git commit -m "feat(p0): add shared sourceLabel helper"
```

### Task 2: Use `sourceLabel` in DataStatus + App header (P0)

**Files:**
- Modify: `src/components/DataStatus.tsx:57`
- Modify: `src/App.tsx:219-223`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test** — assert the header shows the real source, not a hardcoded "JQData".

Add to `src/App.test.tsx` (uses the existing mock provider; check its snapshot `source` value — it is `"jqdata"` in the existing fixture, so to make the test meaningful, the fixture's source drives the label). Add:

```tsx
it("header shows the snapshot's real data source label", async () => {
  // The existing mock provider returns source "jqdata"; header must reflect it
  // dynamically (not a hardcoded string). Switch the provider fixture to tushare
  // for this assertion via a local provider.
  const tushareProvider = {
    fetchStatus: async () => ({ databaseAvailable: true, source: "tushare", metric: "net_amount_main", availableTradeDates: ["2026-06-12"], latestTradeDate: "2026-06-12", latestStatus: "ready" }),
    fetchLatest: async () => SAMPLE_TUSHARE_SNAPSHOT,
    fetchDate: async () => SAMPLE_TUSHARE_SNAPSHOT,
  };
  render(<App provider={tushareProvider as any} />);
  expect(await screen.findByText(/Tushare/)).toBeInTheDocument();
});
```

Define `SAMPLE_TUSHARE_SNAPSHOT` at the top of the test file by cloning the existing sample with `source: "tushare"` and a `window` field (see Task 11 — if Phase 1 is done before Phase 2, omit `window` and revisit). For Phase 1 standalone, reuse the existing sample shape with `source: "tushare"`.

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/App.test.tsx -t "real data source"`
Expected: FAIL — header renders "JQData" (hardcoded at `App.tsx:222`), so `/Tushare/` is not found.

- [ ] **Step 3: Implement**

In `src/components/DataStatus.tsx`, replace line 57:

```tsx
// before: const sourceLabel = snapshot.source === "tushare" ? "Tushare" : "JQData";
import { sourceLabel } from "../data/sourceLabel";
// ...inside component, replace the local const usage with sourceLabel(snapshot.source)
const sourceText = sourceLabel(snapshot.source);
// ...and use {sourceText} where {sourceLabel} was used in JSX (line ~63)
```

In `src/App.tsx`, replace the hardcoded header (lines 219-223):

```tsx
import { sourceLabel } from "./data/sourceLabel";
// ...
{activeSnapshot ? (
  <>
    <span>真实资金流快照</span>
    <p>{sourceLabel(activeSnapshot.source)} 主力净流入 · {activeSnapshot.tradeDate}</p>
  </>
) : isDemo ? (
```

(Phase 2 Task 12 extends this line with the window label.)

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/App.test.tsx src/components/DataStatus.test.tsx`
Expected: PASS (including the new assertion; existing DataStatus tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/components/DataStatus.tsx src/App.tsx src/App.test.tsx
git commit -m "fix(p0): header shows real data source via sourceLabel"
```

### Task 3: Stop toolbar/status overlap (P1)

**Files:**
- Modify: `src/App.css:403` (`.data-status`)

This is a CSS layout fix (no logic to unit-test); verify in the browser.

- [ ] **Step 1: Make ready/partial/demo status an overlay**

Edit `.data-status` in `src/App.css` (line 403) to float top-right of the relative `.scene-panel`, clear of the top-left `.scene-toolbar`:

```css
.data-status {
  position: absolute;
  z-index: 2;
  top: 14px;
  right: 14px;
  max-width: 46%;
  justify-content: flex-end;
  /* keep existing display:flex; flex-wrap:wrap; gap; padding; background; border; radius; font; color */
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
  padding: 8px 14px;
  background: rgba(26, 32, 44, 0.72);
  border: 1px solid rgba(120, 144, 200, 0.25);
  border-radius: 6px;
  font-size: 12px;
  color: #c5cee0;
}
```

(`.data-error` is unchanged — the error state renders no scene, so there is no overlap.)

- [ ] **Step 2: Verify in browser**

Run the app (`npm run dev:full`), open `http://localhost:5173`.
Expected: the three toolbar chips (top-left) and the coverage status (top-right) no longer overlap; the garbled middle row is gone; the 3D canvas fills the panel height.

- [ ] **Step 3: Run the suite to confirm no regressions**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/App.css
git commit -m "fix(p1): float data-status top-right to stop toolbar overlap"
```

---

## Phase 2 — Time windows (P5)

### Task 4: `aggregate_window` pure function (backend)

**Files:**
- Create: `server/capital_flow/window.py`
- Test: `server/tests/test_window.py`

- [ ] **Step 1: Write the failing test**

```python
# server/tests/test_window.py
from server.capital_flow.window import aggregate_window, WINDOW_SPECS

def _snap(trade_date, points, status="ready", coverage=None):
    return {
        "tradeDate": trade_date, "fetchedAt": f"{trade_date}T16:00:00Z",
        "source": "tushare", "metric": "net_amount_main", "unit": "CNY",
        "status": status, "coverage": coverage or {"requested": 2, "succeeded": 2, "failed": 0},
        "points": points, "failures": [],
    }

def _pt(stock_id, amount, theme="t1", sub="s1"):
    return {"securityCode": f"{stock_id}.X", "stockName": stock_id, "netAmountMain": amount,
            "stockId": stock_id, "subThemeId": sub, "themeId": theme, "aggregationRole": "primary"}

def test_sums_net_amount_per_stock_across_days():
    snaps = [_snap("2026-06-17", [_pt("a", 100), _pt("b", -50)]),
             _snap("2026-06-16", [_pt("a", 10), _pt("b", -5)])]
    out = aggregate_window(snaps, requested_days=5, label="近5日")
    by = {p["stockId"]: p["netAmountMain"] for p in out["points"]}
    assert by == {"a": 110, "b": -55}
    assert out["window"] == {"days": 5, "label": "近5日", "from": "2026-06-16", "to": "2026-06-17", "availableDays": 2}
    assert out["tradeDate"] == "2026-06-17"
    for p in out["points"]:
        assert p["tradeDate"] == "2026-06-17"  # anchor date stamped on every point

def test_partial_window_reports_available_days():
    out = aggregate_window([_snap("2026-06-17", [_pt("a", 100)])], requested_days=20, label="近20日")
    assert out["window"]["availableDays"] == 1
    assert out["window"]["from"] == "2026-06-17"
    assert out["points"][0]["netAmountMain"] == 100

def test_stock_present_in_only_some_days():
    snaps = [_snap("2026-06-17", [_pt("a", 100)]),
             _snap("2026-06-16", [_pt("a", 10), _pt("b", -7)])]
    out = aggregate_window(snaps, 5, "近5日")
    by = {p["stockId"]: p["netAmountMain"] for p in out["points"]}
    assert by == {"a": 110, "b": -7}

def test_window_specs_map_keys_to_days_and_labels():
    assert WINDOW_SPECS["1d"] == (1, "今日")
    assert WINDOW_SPECS["20d"] == (20, "近20日")
```

- [ ] **Step 2: Run it, verify it fails**

Run: `python3 -m pytest server/tests/test_window.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'server.capital_flow.window'`.

- [ ] **Step 3: Implement**

```python
# server/capital_flow/window.py
"""Pure rolling-window aggregation over daily capital-flow snapshots.

Each window snapshot sums per-stock daily net_amount_main across the latest N
trading days, anchored at the newest day. Output mirrors the repository's
``_expand`` dict shape plus a ``window`` metadata block.
"""

from __future__ import annotations

from typing import List

#: window query key -> (trading-day count, Chinese label)
WINDOW_SPECS = {
    "1d": (1, "今日"),
    "5d": (5, "近5日"),
    "10d": (10, "近10日"),
    "20d": (20, "近20日"),
}


def aggregate_window(snapshots: List[dict], requested_days: int, label: str) -> dict:
    """Sum points across ``snapshots`` (DESC by tradeDate, index 0 = anchor).

    ``snapshots`` must be non-empty. Each point is keyed by ``stockId``; the
    first (newest) occurrence supplies display metadata, later days add to its
    ``netAmountMain``. Every output point is stamped with the anchor tradeDate.
    """
    anchor = snapshots[0]
    to = anchor["tradeDate"]
    frm = snapshots[-1]["tradeDate"]

    merged: dict = {}
    order: list = []
    for snap in snapshots:  # anchor first → first-seen keeps newest metadata
        for p in snap["points"]:
            sid = p["stockId"]
            if sid in merged:
                merged[sid]["netAmountMain"] += p["netAmountMain"]
            else:
                merged[sid] = {**p, "tradeDate": to}
                order.append(sid)

    return {
        "tradeDate": to,
        "fetchedAt": anchor["fetchedAt"],
        "source": anchor["source"],
        "metric": anchor["metric"],
        "unit": anchor["unit"],
        "status": anchor["status"],
        "coverage": anchor["coverage"],
        "points": [merged[sid] for sid in order],
        "failures": anchor["failures"],
        "window": {
            "days": requested_days,
            "label": label,
            "from": frm,
            "to": to,
            "availableDays": len(snapshots),
        },
    }
```

- [ ] **Step 4: Run it, verify it passes**

Run: `python3 -m pytest server/tests/test_window.py -q`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/window.py server/tests/test_window.py
git commit -m "feat(p5): aggregate_window pure rolling-window summation"
```

### Task 5: `repository.get_window_snapshot` (backend)

**Files:**
- Modify: `server/capital_flow/repository.py` (add method after `get_latest_snapshot`, ~line 335)
- Test: `server/tests/test_repository.py`

- [ ] **Step 1: Write the failing test**

Add to `server/tests/test_repository.py` (reuse the file's `_draft`/`tmp_db_path` fixtures; note `_draft` accepts `trade_date`/`status`):

```python
def test_get_window_snapshot_sums_across_days(tmp_db_path):
    from datetime import date
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 17)))
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 16)))
    snap = repo.get_window_snapshot(5, "近5日")
    assert snap["window"]["availableDays"] == 2
    assert snap["window"]["to"] == "2026-06-17"
    assert snap["window"]["from"] == "2026-06-16"
    # _draft has one primary point (net 12_345_600) → summed across 2 days
    assert snap["points"][0]["netAmountMain"] == 12_345_600.0 * 2
    repo.close()

def test_get_window_snapshot_none_when_empty(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    assert repo.get_window_snapshot(5, "近5日") is None
    repo.close()
```

(If `_draft`'s point net differs, match it; read `server/tests/test_repository.py` `_draft` first.)

- [ ] **Step 2: Run it, verify it fails**

Run: `python3 -m pytest server/tests/test_repository.py -k window -q`
Expected: FAIL — `AttributeError: 'SnapshotRepository' object has no attribute 'get_window_snapshot'`.

- [ ] **Step 3: Implement**

Add to `server/capital_flow/repository.py` (import at top: `from .window import aggregate_window`), after `get_latest_snapshot`:

```python
    def get_window_snapshot(self, requested_days: int, label: str):
        """Window snapshot over the newest ``requested_days`` trading days.

        Anchored at the newest stored trade date (ready or partial). Returns
        ``None`` when the database holds no snapshots.
        """
        with self._lock:
            dates = self.list_trade_dates()  # DESC
            if not dates:
                return None
            chosen = dates[:requested_days]
            expanded = []
            for d in chosen:
                row = self._snapshot_row(d)
                if row is not None:
                    expanded.append(self._expand(row))
        if not expanded:
            return None
        return aggregate_window(expanded, requested_days, label)
```

- [ ] **Step 4: Run it, verify it passes**

Run: `python3 -m pytest server/tests/test_repository.py -k window -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/repository.py server/tests/test_repository.py
git commit -m "feat(p5): repository.get_window_snapshot"
```

### Task 6: `window` query param on the read API (backend)

**Files:**
- Modify: `server/capital_flow/api.py` (latest route + by-date route)
- Test: `server/tests/test_api.py`

- [ ] **Step 1: Write the failing test**

Add to `server/tests/test_api.py` (the `client` fixture saves one `ready` snapshot for 2026-06-12):

```python
def test_latest_defaults_to_1d_window(client):
    data = client.get("/api/capital-flow/snapshot/latest").get_json()
    assert data["window"] == {"days": 1, "label": "今日",
                              "from": "2026-06-12", "to": "2026-06-12", "availableDays": 1}

def test_latest_accepts_window_param(client):
    data = client.get("/api/capital-flow/snapshot/latest?window=5d").get_json()
    assert data["window"]["days"] == 5
    assert data["window"]["label"] == "近5日"
    assert data["window"]["availableDays"] == 1  # only one day stored in fixture

def test_latest_rejects_unknown_window(client):
    resp = client.get("/api/capital-flow/snapshot/latest?window=7d")
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "invalid_window"

def test_by_date_carries_1d_window(client):
    data = client.get("/api/capital-flow/snapshot?trade_date=2026-06-12").get_json()
    assert data["window"]["days"] == 1
    assert data["window"]["to"] == "2026-06-12"
```

- [ ] **Step 2: Run it, verify it fails**

Run: `python3 -m pytest server/tests/test_api.py -k window -q`
Expected: FAIL — `KeyError: 'window'` / 400 not returned (param ignored).

- [ ] **Step 3: Implement**

In `server/capital_flow/api.py`, add the import and rewrite the two GET routes:

```python
from .window import WINDOW_SPECS, aggregate_window
# ...
    @bp.get("/api/capital-flow/snapshot/latest")
    def latest_snapshot():
        window = request.args.get("window", "1d")
        spec = WINDOW_SPECS.get(window)
        if spec is None:
            return _error("invalid_window",
                          f"Unknown window '{window}' (expected one of {sorted(WINDOW_SPECS)})", 400)
        days, label = spec
        try:
            snapshot = repository.get_window_snapshot(days, label)
        except sqlite3.Error as exc:
            return _error("snapshot_unavailable", f"Cannot read capital flow database: {exc}", 503)
        if snapshot is None:
            return _error("snapshot_not_found", "No usable capital flow snapshot has been synced yet", 404)
        return jsonify(snapshot)

    @bp.get("/api/capital-flow/snapshot")
    def snapshot_by_date():
        trade_date = request.args.get("trade_date")
        if not trade_date:
            return _error("missing_trade_date", "Query parameter 'trade_date' is required (YYYY-MM-DD)", 400)
        try:
            snapshot = repository.get_snapshot(trade_date)
        except sqlite3.Error as exc:
            return _error("snapshot_unavailable", f"Cannot read capital flow database: {exc}", 503)
        if snapshot is None:
            return _error("snapshot_not_found", f"No snapshot for {trade_date}", 404)
        # Uniform contract: every snapshot response carries a window (single day = 1d).
        return jsonify(aggregate_window([snapshot], 1, "今日"))
```

- [ ] **Step 4: Run tests, verify pass**

Run: `python3 -m pytest server/tests/test_api.py -q`
Expected: PASS — new window tests pass; existing `test_latest_snapshot_endpoint` / `test_snapshot_by_date_returns_existing` still pass (tradeDate/source/aggregationRole unchanged; window added).

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/api.py server/tests/test_api.py
git commit -m "feat(p5): window query param + uniform window field on read API"
```

### Task 7: `service.sync_backfill` (backend)

**Files:**
- Modify: `server/capital_flow/service.py` (add method after `sync`)
- Test: `server/tests/test_service.py`

- [ ] **Step 1a: Extend `_ScriptedSource` to span multiple trading days**

The existing `_ScriptedSource` (`server/tests/test_service.py:15`) is single-day (always `date(2026, 6, 12)`). Add an optional `trade_dates` list (backward-compatible default) so backfill can walk N consecutive trading days. Replace its `__init__` / `latest_trade_date` / `is_trade_date`:

```python
class _ScriptedSource:
    def __init__(self, succeeding_codes, trade_dates=None):
        self._succeeding = list(succeeding_codes)
        self._trade_dates = list(trade_dates) if trade_dates else [date(2026, 6, 12)]
        self.requested: list = []

    def latest_trade_date(self) -> date:
        return max(self._trade_dates)

    def is_trade_date(self, trade_date: date) -> bool:
        return trade_date in self._trade_dates

    # fetch_daily and close stay exactly as they are
```

- [ ] **Step 1b: Write the failing backfill test**

```python
def test_sync_backfill_saves_n_trading_days(service_fixture):
    from datetime import date
    days = [date(2026, 6, 17), date(2026, 6, 16), date(2026, 6, 15)]  # consecutive
    source = _ScriptedSource(service_fixture.all_codes, trade_dates=days)
    service = CapitalFlowSyncService(
        source=source,
        repository=service_fixture.repository,
        registry_root=service_fixture.tmp_path,
    )
    results = service.sync_backfill(3)
    assert [r["status"] for r in results] == ["ready", "ready", "ready"]
    assert sorted(service_fixture.repository.list_trade_dates(), reverse=True) == [
        "2026-06-17", "2026-06-16", "2026-06-15",
    ]
```

(`_ScriptedSource` returns a point for every succeeding code on any date, and `service_fixture.all_codes` is the full 10-security set, so every day is `ready`. `service._previous_trade_date` walks consecutive calendar days back from 06-17, matching the scripted list.)

- [ ] **Step 2: Run it, verify it fails**

Run: `python3 -m pytest server/tests/test_service.py -k backfill -q`
Expected: FAIL — `AttributeError: ... has no attribute 'sync_backfill'`.

- [ ] **Step 3: Implement**

Add to `server/capital_flow/service.py` (after `sync`):

```python
    def sync_backfill(self, count: int) -> list:
        """Attempt the latest ``count`` trading days; persist each that has data.

        Keeps the source open across all days (unlike :meth:`sync`, which closes
        per call) and never aborts the run on a single empty day — it records the
        skip and continues, so one missing day cannot block the backfill.
        """
        registry = load_registry(self._registry_root)
        results: list = []
        try:
            trade_date = self._source.latest_trade_date()
            for _ in range(count):
                if trade_date is None:
                    break
                try:
                    draft = self._build_draft(trade_date, registry)
                    self._repository.save_snapshot(draft)
                    results.append({"tradeDate": trade_date.isoformat(),
                                    "status": draft.status, "error": None})
                except SnapshotSyncError as exc:
                    results.append({"tradeDate": trade_date.isoformat(),
                                    "status": None, "error": str(exc)})
                trade_date = self._previous_trade_date(trade_date)
        finally:
            self._source.close()
        return results
```

- [ ] **Step 4: Run it, verify it passes**

Run: `python3 -m pytest server/tests/test_service.py -k backfill -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/service.py server/tests/test_service.py
git commit -m "feat(p5): service.sync_backfill for N trading days"
```

### Task 8: `--backfill N` CLI flag (backend)

**Files:**
- Modify: `server/capital_flow/sync.py:90-151` (`run_sync`)
- Test: `server/tests/test_sync.py`

- [ ] **Step 1: Write the failing test**

`run_sync` builds the source via `build_source_from_environment(env)` and uses the real project registry (`_project_root()`). Monkeypatch the source factory to a multi-day fake that succeeds for every requested security (→ 100% coverage → `ready`). Add to `server/tests/test_sync.py`:

```python
def test_backfill_flag_syncs_multiple_days(monkeypatch, tmp_path):
    from datetime import date
    from server.capital_flow import sync as sync_mod
    from server.capital_flow.models import SourcePoint
    from server.capital_flow.repository import SnapshotRepository

    class _AllSucceed:
        def __init__(self, dates):
            self._dates = dates
        def latest_trade_date(self):
            return max(self._dates)
        def is_trade_date(self, d):
            return d in self._dates
        def fetch_daily(self, trade_date, securities):
            return [SourcePoint(security_code=c, trade_date=trade_date,
                                net_amount_main=1_000_000.0) for c in securities]
        def close(self):
            pass

    days = [date(2026, 6, 17), date(2026, 6, 16)]  # consecutive trading days
    monkeypatch.setattr(sync_mod, "build_source_from_environment", lambda env: _AllSucceed(days))
    db = tmp_path / "cf.sqlite3"

    code = sync_mod.run_sync(["--backfill", "2", "--database", str(db)], env={})
    assert code == 0

    repo = SnapshotRepository(db)
    assert sorted(repo.list_trade_dates(), reverse=True) == ["2026-06-17", "2026-06-16"]
    repo.close()
```

(The fake returns a point for every security in the real registry, so both days persist as `ready`; the temp `--database` keeps the real DB untouched.)

- [ ] **Step 2: Run it, verify it fails**

Run: `python3 -m pytest server/tests/test_sync.py -k backfill -q`
Expected: FAIL — `--backfill` unrecognized / not wired.

- [ ] **Step 3: Implement**

In `server/capital_flow/sync.py` add the argument and branch. After the existing `--source` arg (line 109):

```python
    parser.add_argument(
        "--backfill",
        type=int,
        default=None,
        help="Backfill the latest N trading days instead of a single date",
    )
```

Replace the single-sync block (lines 132-151) with:

```python
    try:
        if args.backfill is not None:
            results = service.sync_backfill(args.backfill)
            print(json.dumps({"backfill": results}, ensure_ascii=False))
            return 0 if any(r.get("status") for r in results) else 1
        draft = service.sync(args.trade_date)
    except (CapitalFlowSourceError, SnapshotSyncError) as exc:
        print(json.dumps(build_summary(
            trade_date=None, status=None, requested=0, succeeded=0, failed=0,
            error=f"{type(exc).__name__}: {exc}",
        ), ensure_ascii=False))
        return 1
    finally:
        repository.close()

    print(json.dumps(build_summary(
        trade_date=draft.trade_date, status=draft.status,
        requested=draft.requested, succeeded=draft.succeeded,
        failed=draft.failed, error=None,
    ), ensure_ascii=False))
    return 0
```

- [ ] **Step 4: Run it, verify it passes**

Run: `python3 -m pytest server/tests/test_sync.py -q`
Expected: PASS (new + existing).

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/sync.py server/tests/test_sync.py
git commit -m "feat(p5): --backfill N CLI flag"
```

### Task 9: Frontend `window` contract (parse + validate)

**Files:**
- Modify: `src/data/capitalFlowSnapshot.ts`
- Test: `src/data/capitalFlowSnapshot.test.ts` (extend the existing contract test)

- [ ] **Step 1: Write the failing test**

Add to `src/data/capitalFlowSnapshot.test.ts`:

```ts
import { parseSnapshot, InvalidSnapshotError } from "./capitalFlowSnapshot";

describe("window field contract", () => {
  const base = backendSnapshot as Record<string, unknown>; // fixture (regenerated in Task 14)
  it("parses the window field", () => {
    const snap = parseSnapshot(base);
    expect(snap.window.days).toBeGreaterThanOrEqual(1);
    expect(snap.window.label.length).toBeGreaterThan(0);
    expect(snap.window.to).toBe(snap.tradeDate);
  });
  it("rejects a snapshot missing window", () => {
    const { window: _omit, ...broken } = base;
    expect(() => parseSnapshot(broken)).toThrow(InvalidSnapshotError);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/data/capitalFlowSnapshot.test.ts`
Expected: FAIL — `snap.window` is undefined (parser ignores it) / the "rejects" case does not throw.

- [ ] **Step 3: Implement**

In `src/data/capitalFlowSnapshot.ts`:

```ts
export interface CapitalFlowWindowMeta {
  readonly days: number;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly availableDays: number;
}
```

Add `readonly window: CapitalFlowWindowMeta;` to `CapitalFlowSnapshot`. Add a parser:

```ts
function parseWindow(raw: unknown): CapitalFlowWindowMeta {
  if (!isObject(raw)) throw new InvalidSnapshotError("Invalid capital flow snapshot: window missing");
  const { days, label, from, to, availableDays } = raw;
  if (!isFiniteNumber(days) || !isFiniteNumber(availableDays)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: window days must be finite");
  }
  if (!isString(label) || !isString(from) || !isString(to)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: window label/from/to must be non-empty strings");
  }
  return { days, label, from, to, availableDays };
}
```

In `parseSnapshot`, destructure `window` from `raw` and add `window: parseWindow(window)` to the returned object.

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/data/capitalFlowSnapshot.test.ts`
Expected: PASS (after Task 14 regenerates the fixture; if running before Task 14, temporarily inject a `window` into `base`).

- [ ] **Step 5: Commit**

```bash
git add src/data/capitalFlowSnapshot.ts src/data/capitalFlowSnapshot.test.ts
git commit -m "feat(p5): window field in snapshot contract + validation"
```

### Task 10: Provider `fetchLatest(window)`

**Files:**
- Modify: `src/data/capitalFlowDataProvider.ts`
- Test: `src/data/capitalFlowDataProvider.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/data/capitalFlowDataProvider.test.ts` (it already stubs `fetch`):

```ts
it("fetchLatest sends the window query param", async () => {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    calls.push(url);
    return { ok: true, json: async () => SAMPLE_WINDOW_SNAPSHOT } as Response;
  }));
  const provider = createCapitalFlowDataProvider();
  await provider.fetchLatest("5d");
  expect(calls[0]).toContain("window=5d");
});
```

(Define `SAMPLE_WINDOW_SNAPSHOT` = the file's existing sample plus a valid `window`. Match the file's existing fetch-stub style.)

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/data/capitalFlowDataProvider.test.ts -t "window query"`
Expected: FAIL — `fetchLatest` takes no arg / URL has no `window=`.

- [ ] **Step 3: Implement**

In `src/data/capitalFlowDataProvider.ts`:

```ts
export type CapitalFlowWindowKey = "1d" | "5d" | "10d" | "20d";

export interface CapitalFlowDataProvider {
  fetchLatest(window?: CapitalFlowWindowKey): Promise<CapitalFlowSnapshot>;
  fetchDate(tradeDate: string): Promise<CapitalFlowSnapshot>;
  fetchStatus(): Promise<CapitalFlowStatus>;
}

// in createCapitalFlowDataProvider():
fetchLatest(window: CapitalFlowWindowKey = "1d"): Promise<CapitalFlowSnapshot> {
  return request(`${LATEST_URL}?window=${window}`, parseSnapshot);
},
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/data/capitalFlowDataProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/capitalFlowDataProvider.ts src/data/capitalFlowDataProvider.test.ts
git commit -m "feat(p5): provider.fetchLatest accepts a window key"
```

### Task 11: Window selector in ControlsPanel

**Files:**
- Modify: `src/components/ControlsPanel.tsx:9-24` (props), `:40-58` (replace date section)
- Test: `src/components/ControlsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/ControlsPanel.test.tsx` (match the file's existing render helper / required props):

```tsx
it("renders four window buttons and reports clicks", async () => {
  const onWindowChange = vi.fn();
  render(<ControlsPanel {...baseProps} activeWindow="1d" onWindowChange={onWindowChange} />);
  expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "近20日" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "近5日" }));
  expect(onWindowChange).toHaveBeenCalledWith("5d");
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/components/ControlsPanel.test.tsx -t "window buttons"`
Expected: FAIL — buttons not present / props unknown.

- [ ] **Step 3: Implement**

In `src/components/ControlsPanel.tsx`, import the key type and update props — remove `activeTradeDate` / `availableTradeDates` / `onTradeDateChange`, add:

```tsx
import type { CapitalFlowWindowKey } from "../data/capitalFlowDataProvider";
// in ControlsPanelProps:
  activeWindow: CapitalFlowWindowKey;
  onWindowChange: (window: CapitalFlowWindowKey) => void;
```

Add the options constant near `CAMERA_PRESET_OPTIONS`:

```tsx
const WINDOW_OPTIONS: readonly { value: CapitalFlowWindowKey; label: string }[] = [
  { value: "1d", label: "今日" },
  { value: "5d", label: "近5日" },
  { value: "10d", label: "近10日" },
  { value: "20d", label: "近20日" },
];
```

Replace the date `<label>/<select>` block (lines 40-57) with a segmented control:

```tsx
        <div className="segmented" role="group" aria-label="时间档位">
          {WINDOW_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={props.activeWindow === value ? "active" : ""}
              aria-pressed={props.activeWindow === value}
              onClick={() => props.onWindowChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/components/ControlsPanel.test.tsx`
Expected: PASS (update any existing test that passed the removed date props).

- [ ] **Step 5: Commit**

```bash
git add src/components/ControlsPanel.tsx src/components/ControlsPanel.test.tsx
git commit -m "feat(p5): window bucket selector replaces date dropdown"
```

### Task 12: Wire window state in App.tsx

**Files:**
- Modify: `src/App.tsx` (state, loadInitial, ControlsPanel props, header label)
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/App.test.tsx`:

```tsx
it("refetches with the chosen window and labels the header", async () => {
  const fetchLatest = vi.fn(async (w?: string) =>
    ({ ...SAMPLE_TUSHARE_SNAPSHOT, window: { days: w === "5d" ? 5 : 1, label: w === "5d" ? "近5日" : "今日", from: "2026-06-11", to: "2026-06-12", availableDays: w === "5d" ? 5 : 1 } }));
  const provider = { fetchStatus: async () => STATUS_STUB, fetchLatest, fetchDate: async () => SAMPLE_TUSHARE_SNAPSHOT };
  render(<App provider={provider as any} />);
  await screen.findByText(/今日/);
  await userEvent.click(screen.getByRole("button", { name: "近5日" }));
  expect(fetchLatest).toHaveBeenLastCalledWith("5d");
  expect(await screen.findByText(/近5日/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/App.test.tsx -t "chosen window"`
Expected: FAIL — no window buttons / `fetchLatest` called with no arg.

- [ ] **Step 3: Implement**

In `src/App.tsx`:
- Import the key type: `import { createCapitalFlowDataProvider, type CapitalFlowDataProvider, type CapitalFlowWindowKey } from "./data/capitalFlowDataProvider";`
- Add state: `const [activeWindow, setActiveWindow] = useState<CapitalFlowWindowKey>("1d");`
- In `loadInitial`, change `dataProvider.fetchLatest()` to `dataProvider.fetchLatest(activeWindow)` and add `activeWindow` to its `useCallback` deps.
- Replace the ControlsPanel date props with `activeWindow={activeWindow} onWindowChange={setActiveWindow}` and remove `activeTradeDate`/`availableTradeDates`/`onTradeDateChange` and the `handleTradeDateChange` callback.
- Header (Task 2 line): `<p>{sourceLabel(activeSnapshot.source)} {activeSnapshot.window.label}主力净流入 · {activeSnapshot.window.from}~{activeSnapshot.window.to}{activeSnapshot.window.availableDays < activeSnapshot.window.days ? `（仅${activeSnapshot.window.availableDays}日可用）` : ""}</p>`

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (update existing App tests that referenced trade-date props/handlers).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(p5): wire window selector + window-labelled header in App"
```

### Task 13: Regenerate golden fixture with window

**Files:**
- Modify: `scripts/dump_snapshot_fixture.py` (dump via window read)
- Regenerate: `src/test/fixtures/backendSnapshot.sample.json`

- [ ] **Step 1: Switch the dump to the windowed read**

In `scripts/dump_snapshot_fixture.py`, change `snapshot = repo.get_latest_snapshot()` to:

```python
    snapshot = repo.get_window_snapshot(1, "今日")
```

- [ ] **Step 2: Regenerate the fixture**

Run: `python3 scripts/dump_snapshot_fixture.py`
Expected: prints `wrote .../backendSnapshot.sample.json (2 points)`; the JSON now contains a `window` block with `days: 1`.

- [ ] **Step 3: Run the contract + provider + app suites**

Run: `npx vitest run src/data/capitalFlowSnapshot.test.ts src/data/capitalFlowDataProvider.test.ts src/App.test.tsx`
Expected: PASS — the window contract test (Task 9) now reads a real window from the fixture.

- [ ] **Step 4: Commit**

```bash
git add scripts/dump_snapshot_fixture.py src/test/fixtures/backendSnapshot.sample.json
git commit -m "test(p5): regenerate golden fixture with window field"
```

### Task 14: Backfill real history + full-suite gate

**Files:** none (operational + verification)

- [ ] **Step 1: Backfill 20 trading days into the real DB**

Run (from project root, with `.env` loaded):

```bash
set -a; source .env; set +a
npm run sync:capital-flow -- --backfill 20
```

Expected: JSON `{"backfill": [...]}` listing up to 20 days with `status: "ready"|"partial"` (some may be skipped if upstream lacks data — that is recorded, not fatal).

- [ ] **Step 2: Spot-check windowed reads against the real DB**

```bash
python3 -c "from server.capital_flow.repository import SnapshotRepository as R; r=R('server/data/capital_flow.sqlite3'); s=r.get_window_snapshot(5,'近5日'); r.close(); print(s['window'])"
```

Expected: `availableDays` ≈ 5 (or fewer if upstream gaps), `from`/`to` span real trading days.

- [ ] **Step 3: Full regression gate**

Run: `python3 -m pytest server/tests -q && npx vitest run && npx tsc --noEmit`
Expected: all green, tsc clean.

- [ ] **Step 4: Browser verification (P5)**

`npm run dev:full` → switch 今日/近5/近10/近20日; the peak surface and header update; partial windows show "仅 M 日可用".

- [ ] **Step 5: Commit (if any fixture/doc tweaks)**

```bash
git add -A && git commit -m "chore(p5): backfill history + verify time-window reads" || echo "nothing to commit"
```

---

## Phase 3 — UX / visual polish (P2b, P4, P3b, P3a, P2a)

### Task 15: `buildOverview` pure helper (P2b)

**Files:**
- Create: `src/domain/capitalFlowOverview.ts`
- Test: `src/domain/capitalFlowOverview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/capitalFlowOverview.test.ts
import { buildOverview } from "./capitalFlowOverview";

const nameOf = (id: string) => ({ a: "甲", b: "乙", c: "丙", d: "丁" }[id] ?? id);

describe("buildOverview", () => {
  it("ranks inflow desc and outflow most-negative-first, totals all", () => {
    const totals = new Map([["a", 100], ["b", -50], ["c", 30], ["d", -80]]);
    const o = buildOverview(totals, nameOf, 2);
    expect(o.topInflow.map(e => e.id)).toEqual(["a", "c"]);
    expect(o.topOutflow.map(e => e.id)).toEqual(["d", "b"]);
    expect(o.totalNetInflow).toBe(0);
    expect(o.topInflow[0].name).toBe("甲");
  });
  it("omits the wrong sign when few entries", () => {
    const o = buildOverview(new Map([["a", 100]]), nameOf, 5);
    expect(o.topOutflow).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/domain/capitalFlowOverview.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/domain/capitalFlowOverview.ts
export interface OverviewEntry { readonly id: string; readonly name: string; readonly value: number; }
export interface CapitalFlowOverview {
  readonly totalNetInflow: number;
  readonly topInflow: readonly OverviewEntry[];
  readonly topOutflow: readonly OverviewEntry[];
}

export function buildOverview(
  totals: ReadonlyMap<string, number>,
  nameOf: (id: string) => string,
  topN = 5
): CapitalFlowOverview {
  const entries: OverviewEntry[] = [...totals.entries()].map(([id, value]) => ({ id, name: nameOf(id), value }));
  const desc = [...entries].sort((a, b) => b.value - a.value);
  const topInflow = desc.filter((e) => e.value > 0).slice(0, topN);
  const topOutflow = desc.filter((e) => e.value < 0).slice(-topN).reverse();
  const totalNetInflow = entries.reduce((sum, e) => sum + e.value, 0);
  return { totalNetInflow, topInflow, topOutflow };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/domain/capitalFlowOverview.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/capitalFlowOverview.ts src/domain/capitalFlowOverview.test.ts
git commit -m "feat(p2b): buildOverview ranking helper"
```

### Task 16: Inspector overview when nothing selected (P2b)

**Files:**
- Modify: `src/components/InspectorPanel.tsx:51-58` (empty branch) + props
- Modify: `src/App.tsx` (compute overview, pass to InspectorPanel)
- Test: `src/components/InspectorPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/InspectorPanel.test.tsx`:

```tsx
import { InspectorPanel } from "./InspectorPanel";

it("shows the daily overview when no sector is selected", () => {
  const overview = {
    totalNetInflow: 5_0000_0000,
    topInflow: [{ id: "ai-computing", name: "AI算力", value: 3_0000_0000 }],
    topOutflow: [{ id: "fintech", name: "金融科技", value: -1_0000_0000 }],
  };
  render(<InspectorPanel overview={overview} overviewTitle="主线概览" />);
  expect(screen.getByText("主线概览")).toBeInTheDocument();
  expect(screen.getByText("AI算力")).toBeInTheDocument();
  expect(screen.getByText("金融科技")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/components/InspectorPanel.test.tsx -t "daily overview"`
Expected: FAIL — overview not rendered (static empty state).

- [ ] **Step 3: Implement**

In `src/components/InspectorPanel.tsx`, extend props and replace the `if (!node)` branch (lines 51-58):

```tsx
import type { CapitalFlowOverview } from "../domain/capitalFlowOverview";
// add to InspectorPanelProps:
  overview?: CapitalFlowOverview;
  overviewTitle?: string;

// replace the !node branch:
if (!node) {
  if (overview) {
    const fmt = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) / 1e8).toFixed(2)}亿`;
    return (
      <section className="inspector-panel" aria-label="当日概览">
        <h2>{overviewTitle ?? "当日概览"}</h2>
        <div className="metric-row"><span>主力净流入合计</span>
          <strong style={{ color: overview.totalNetInflow >= 0 ? "#e64646" : "#3fae6a" }}>{fmt(overview.totalNetInflow)}</strong></div>
        <h3>净流入 Top</h3>
        <ul>{overview.topInflow.map((e) => (
          <li key={e.id}>{e.name} <strong style={{ color: "#e64646" }}>{fmt(e.value)}</strong></li>))}</ul>
        <h3>净流出 Top</h3>
        <ul>{overview.topOutflow.map((e) => (
          <li key={e.id}>{e.name} <strong style={{ color: "#3fae6a" }}>{fmt(e.value)}</strong></li>))}</ul>
      </section>
    );
  }
  return (
    <section className="inspector-panel" aria-label="板块详情">
      <h2>点击板块查看资金状态</h2>
      <p>点击峰面区域查看分题材 / 个股的资金方向与净流入明细。</p>
    </section>
  );
}
```

In `src/App.tsx`, build the overview from the existing `aggregates` and pass it:

```tsx
import { buildOverview } from "./domain/capitalFlowOverview";
import { subThemes } from "./domain/subThemeRegistry";
// ...
const overview = useMemo(() => {
  if (!aggregates) return undefined;
  if (viewMode === "P1") {
    const nameOf = (id: string) => themes.find((t) => t.id === id)?.name ?? id;
    return buildOverview(aggregates.byTheme, nameOf);
  }
  const nameOf = (id: string) => subThemes.find((s) => s.id === id)?.name ?? id;
  return buildOverview(aggregates.bySubTheme, nameOf);
}, [aggregates, viewMode]);
// render:
<InspectorPanel overview={overview} overviewTitle={viewMode === "P1" ? "主线概览" : "子题材概览"} />
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/components/InspectorPanel.test.tsx src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/InspectorPanel.tsx src/App.tsx src/components/InspectorPanel.test.tsx
git commit -m "feat(p2b): inspector daily overview when nothing selected"
```

### Task 17: Collapsible left-panel notes + legend note (P4)

**Files:**
- Modify: `src/components/ControlsPanel.tsx:150-161`
- Modify: `src/components/SceneLegend.tsx`
- Test: `src/components/ControlsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/components/ControlsPanel.test.tsx`:

```tsx
it("collapses the read-guide notes by default and expands on click", async () => {
  render(<ControlsPanel {...baseProps} activeWindow="1d" onWindowChange={vi.fn()} />);
  expect(screen.queryByText(/二维位置表达关系/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /读图规则/ }));
  expect(screen.getByText(/二维位置表达关系/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/components/ControlsPanel.test.tsx -t "collapses"`
Expected: FAIL — notes always visible.

- [ ] **Step 3: Implement**

Use a native `<details>` element for the notes section (lines 150-161) — no extra state:

```tsx
      <details className="control-section compact-note">
        <summary className="section-title">
          <Layers3 size={16} aria-hidden="true" />
          <span>读图规则</span>
        </summary>
        <p>二维位置表达关系，柱高表达资金强度，红色为流入，绿色为流出。点击分题材区域展开详细标签。</p>
        <p>第三版：11个主题、~80个板块、5种关系类型、国家地图底座。</p>
      </details>
```

(The test clicks the `<summary>`, which `getByRole("button")` matches.) In `src/components/SceneLegend.tsx`, add a note span after the flat legend item:

```tsx
      <span className="legend-note">红=流入（A股习惯）</span>
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/components/ControlsPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ControlsPanel.tsx src/components/SceneLegend.tsx src/components/ControlsPanel.test.tsx
git commit -m "feat(p4): collapsible read-guide notes + legend convention note"
```

### Task 18: P3 stock label readability (P3b)

**Files:**
- Modify: `src/components/CapitalMapScene.tsx:1004-1017` (P3 stock label `<Text>`)

Visual tuning — verify in browser.

- [ ] **Step 1: Increase contrast and size of P3 stock labels**

Edit the P3 stock label `<Text>` (lines 1004-1017) to add an outline and a slightly larger font:

```tsx
          <Text
            key={`p3-label-${node.stock.id}`}
            position={[node.position.x, THEME_PLATE_THICKNESS + Math.abs(node.metric.height) + 0.08, node.position.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.12}
            color="#f3f6fa"
            outlineWidth={0.012}
            outlineColor="#0b0f14"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.9}
          >
            {node.stock.shortName}
          </Text>
```

(Top-3-per-subtheme gating at lines 991-1003 stays.)

- [ ] **Step 2: Verify in browser**

`npm run dev:full` → P3 view: top stock labels are legible against the plates at the default angle.

- [ ] **Step 3: Run the suite (no regressions)**

Run: `npx vitest run src/components/CapitalMapScene.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat(p3b): outline + larger P3 stock labels for readability"
```

### Task 19: Desaturate theme plate fills (P3a)

**Files:**
- Modify: `src/components/CapitalMapScene.tsx:1082-1087` (`ThemePlate` material)

Visual tuning — verify in browser.

- [ ] **Step 1: Lower plate fill opacity so red/green columns dominate**

In `ThemePlate`'s `meshStandardMaterial` (line ~1082), reduce `opacity` from `0.5` to `0.32`:

```tsx
      <meshStandardMaterial
        color={themeColor}
        opacity={0.32}
        transparent
        roughness={0.7}
      />
```

- [ ] **Step 2: Verify in browser**

`npm run dev:full` → P1/P2/P3: theme fills read as muted background; red/green columns are the dominant signal. Adjust 0.28–0.40 to taste.

- [ ] **Step 3: Run the suite**

Run: `npx vitest run src/components/CapitalMapScene.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat(p3a): desaturate theme plate fills so columns dominate"
```

### Task 20: Camera default framing (P2a)

**Files:**
- Modify: `src/components/CapitalMapScene.tsx:45-49` (`cameraPositions`) and/or `applyCameraPreset:78-89`

Visual tuning — verify in browser. The peak surface currently sits low with ~40% top whitespace.

- [ ] **Step 1: Raise/pull the angled preset and lift the look-at target**

Adjust `cameraPositions.angled` to frame the surface higher and add a small look-at lift. Starting values:

```tsx
export const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [15, 15, 19],
  top: [0, 26, 0.1],
  side: [22, 9, 0]
};
```

If still low, lift the look-at target in `applyCameraPreset` (line 85) from `camera.lookAt(0, 0, 0)` / `controls?.target.set(0, 0, 0)` to a small positive Y, e.g. `0.6`:

```tsx
  camera.lookAt(0, 0.6, 0);
  // ...
  controls?.target.set(0, 0.6, 0);
```

- [ ] **Step 2: Verify in browser**

`npm run dev:full` → all three presets center the surface with even top/bottom margins; bottom cells no longer clip the panel edge.

- [ ] **Step 3: Run the suite**

Run: `npx vitest run src/components/CapitalMapScene.test.tsx`
Expected: PASS. (If a test asserts exact legacy `cameraPositions`, it uses `legacyCameraPositions` — confirm; if it asserts the live `angled` tuple, update that test to the new values.)

- [ ] **Step 4: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat(p2a): re-frame default camera so the surface is centered"
```

---

## Final gate

- [ ] **Run everything:** `python3 -m pytest server/tests -q && npx vitest run && npx tsc --noEmit` — all green, tsc clean.
- [ ] **Browser pass:** `npm run dev:full` — header shows real source + window range; toolbar/status not overlapping; window buttons switch data; inspector shows overview; labels legible; columns dominate; surface centered.

---

## Notes for the implementer

- **Read before editing tests:** Tasks 5/7/8/10/11 reference existing fixtures (`_draft`, `service_fixture`, the fetch stub, `baseProps`). Read each test file's helpers first and match their exact names/shapes — do not invent new ones.
- **Phase ordering:** Phase 2 makes `window` a required contract field, so Task 9's test only goes fully green after Task 13 regenerates the fixture; if you implement Task 9 before 13, inject a `window` into the test's `base` object temporarily, then remove it once the fixture is regenerated.
- **Required `window` propagates to `tsc` (Task 9):** once `CapitalFlowSnapshot` requires `window`, every TypeScript literal typed as `CapitalFlowSnapshot` must include it or `npx tsc --noEmit` (and `npm run build`) fail. Audit and update each snapshot mock: `src/App.test.tsx`, `src/data/capitalFlowDataProvider.test.ts`, `src/components/DataStatus.test.tsx`. Add `window: { days: 1, label: "今日", from: "<date>", to: "<date>", availableDays: 1 }` to each. Run `npx tsc --noEmit` after Task 9 to catch every site.
- **Visual tasks (18/19/20):** unit tests only guard against regressions; the real acceptance is the browser check. Tune the starting values to taste.
- **No remote:** commits land on local `main`.
