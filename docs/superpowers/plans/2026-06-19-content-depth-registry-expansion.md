# SP1 — Content Depth: Registry Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline tooling to regenerate the shared registries to ~80 concept-anchored sub-themes × ~8 representative stocks (~600), sourced from real Tushare concept-board membership, then populate them via a reviewed board mapping.

**Architecture:** Pure builder logic (eligibility → rank by free-float mkt cap → dedup to one sub-theme per stock → emit) in `server/capital_flow/registry_builder.py`; a `BoardMembershipSource` protocol + Tushare adapter in `board_source.py`; a thin CLI `scripts/generate_registries.py` (`--list-boards` preflight, `--build`). All logic is unit-tested with a **fake** source (no token). The real data pull is a token-gated collaborative step. Committed registries are guarded by integrity validators (TS + Python) asserting the aggregation invariant.

**Tech Stack:** Python 3 (builder, adapter, CLI, pytest), TypeScript/Vitest (registry validator), Tushare `ths_index`/`ths_member`/`daily_basic`/`daily`/`stock_basic`.

**Spec:** `docs/superpowers/specs/2026-06-19-content-depth-registry-expansion-design.md`

**Branch:** Implement on `feat/content-depth-registries` (Task 0).

**Key facts established during planning (do not re-derive):**
- A sub-theme JSON entry is `{id, name, shortName, themeId, displayOrder, primarySectorId, areaWeight}`; a stock is `{id, name, shortName, subThemeId, code}` (`code` = 6 digits). `aggregationRole` is NOT in the JSON — `server/capital_flow/registry.py` derives it (first sighting of a security → `primary`, repeats → `related`).
- All 11 theme ids are also valid sector ids, and `primarySectorId` is a soft lookup (not hard-validated). So `primarySectorId = themeId` is a safe default for new sub-themes.
- Relationship edges reference **sector** ids only (unchanged by SP1); `validateRelationshipEdges(edges, sectorList)` stays valid. No non-test code hardcodes sub-theme id strings.
- The current registry intentionally lists 9 stocks under 2 sub-themes (cross-listing). Therefore "each stock once" is a **generator guarantee** (tested on generator output), while the **committed-registry validator** asserts the aggregation invariant (which tolerates cross-listing and passes on current data).
- The existing Tushare client (`server/capital_flow/source.py`) builds `tushare.pro_api(token)` and reads `TUSHARE_TOKEN` via `from_environment`. Reuse that import/token pattern.

---

## File structure

| File | Responsibility |
|---|---|
| `server/capital_flow/registry_builder.py` (new) | Pure logic: eligibility, ranking, dedup/assignment, emit registry entries. Zero SDK/IO. |
| `server/capital_flow/board_source.py` (new) | `BoardMembershipSource` Protocol + `MemberBasic`/`BoardInfo` dataclasses + `TushareBoardSource` adapter. |
| `scripts/generate_registries.py` (new) | CLI: `--list-boards` (preflight + catalog), `--build` (regenerate registries). Thin IO around the builder. |
| `server/tests/test_registry_builder.py` (new) | Unit tests for the pure builder (fake data). |
| `server/tests/test_generate_registries.py` (new) | Tests `run_build` with a fake source + preflight error path. |
| `server/tests/test_registry_integrity.py` (new) | Committed-registry validator (Python): invariants + aggregation invariant. |
| `src/domain/registryIntegrity.test.ts` (new) | Committed-registry validator (TS): invariants + aggregation invariant. |
| `src/data/conceptBoardMapping.json` (new, data) | Curated sub-theme → real board mapping. Produced in Task 5 (collaborative). |
| `src/data/subThemeRegistry.json`, `stockRegistry.json` (regenerated in Task 5) | The expanded registries. |

---

### Task 0: Create the feature branch

**Files:** none

- [ ] **Step 1: Branch from main**

```bash
cd /Users/housebigger/Documents/01_work/playground_claude_code/ws_a_capital_hunter
git checkout main && git checkout -b feat/content-depth-registries
git status -sb   # expect: ## feat/content-depth-registries
```

---

### Task 1: Pure builder logic (`registry_builder.py`)

**Files:**
- Create: `server/capital_flow/registry_builder.py`
- Test: `server/tests/test_registry_builder.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_registry_builder.py`:

```python
from server.capital_flow.registry_builder import (
    MemberBasic,
    is_eligible,
    rank_members,
    assign_primary,
    build_registries,
    compute_order_index,
)

REF = "20260617"

def _m(code, name, circ_mv, amount, list_date="20180101"):
    return MemberBasic(ts_code=code, name=name, circ_mv=circ_mv, amount=amount, list_date=list_date)

def test_is_eligible_rejects_st_suspended_new_illiquid():
    assert is_eligible(_m("1.SZ", "中际旭创", 1e6, 9e5), REF, min_amount=5e5, min_listed_days=60)
    assert not is_eligible(_m("2.SZ", "ST中际", 1e6, 9e5), REF, 5e5, 60)        # ST
    assert not is_eligible(_m("3.SZ", "停牌股", 1e6, 0), REF, 5e5, 60)          # suspended (amount 0)
    assert not is_eligible(_m("4.SZ", "次新股", 1e6, 9e5, "20260601"), REF, 5e5, 60)  # listed <60d
    assert not is_eligible(_m("5.SZ", "小票", 1e6, 1e4), REF, 5e5, 60)          # below liquidity floor

def test_rank_members_sorts_by_circ_mv_desc_after_filter():
    members = [_m("a.SZ", "A", 3e6, 9e5), _m("b.SZ", "ST B", 9e9, 9e5), _m("c.SZ", "C", 5e6, 9e5)]
    ranked = rank_members(members, REF, min_amount=5e5, min_listed_days=60)
    assert [m.ts_code for m in ranked] == ["c.SZ", "a.SZ"]   # ST B filtered; C(5e6) > A(3e6)

def test_assign_primary_one_subtheme_per_stock_with_backfill():
    A = _m("x.SZ", "X", 9e6, 9e5); B = _m("y.SZ", "Y", 8e6, 9e5); C = _m("z.SZ", "Z", 7e6, 9e5)
    ranked = {"s1": [A, B], "s2": [A, C]}          # X is in both; ranks best (0) in both
    order = {"s1": 1, "s2": 2}
    out = assign_primary(ranked, order, target_n=2)
    # X -> s1 (lower displayOrder tie-break); s2 backfills with C
    assert [m.ts_code for m in out["s1"]] == ["x.SZ", "y.SZ"]
    assert [m.ts_code for m in out["s2"]] == ["z.SZ"]
    all_codes = [m.ts_code for ms in out.values() for m in ms]
    assert len(all_codes) == len(set(all_codes))    # each stock once

def test_build_registries_emits_expected_shapes():
    mapping = [{"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
                "themeId": "ai-computing", "boardTsCode": "885001.TI", "boardName": "CPO"}]
    assignments = {"opt": [_m("300308.SZ", "中际旭创", 9e6, 9e5)]}
    subs, stocks = build_registries(mapping, assignments)
    assert subs == [{"id": "opt", "name": "光通信", "shortName": "光通信",
                     "themeId": "ai-computing", "displayOrder": 1,
                     "primarySectorId": "ai-computing", "areaWeight": 0.8}]
    assert stocks == [{"id": "s-300308", "name": "中际旭创", "shortName": "中际旭创",
                       "subThemeId": "opt", "code": "300308"}]

def test_build_registries_honors_optional_primary_sector_id():
    mapping = [{"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
                "themeId": "ai-computing", "boardTsCode": "x", "boardName": "y",
                "primarySectorId": "optical-modules"}]
    subs, _ = build_registries(mapping, {"opt": []})
    assert subs[0]["primarySectorId"] == "optical-modules"

def test_compute_order_index_is_per_theme_sequential():
    mapping = [{"subThemeId": "a", "themeId": "t1"}, {"subThemeId": "b", "themeId": "t1"},
               {"subThemeId": "c", "themeId": "t2"}]
    assert compute_order_index(mapping) == {"a": 1, "b": 2, "c": 1}
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest server/tests/test_registry_builder.py -q`
Expected: FAIL at import — `ModuleNotFoundError: No module named 'server.capital_flow.registry_builder'`.

- [ ] **Step 3: Implement `registry_builder.py`**

Create `server/capital_flow/registry_builder.py`:

```python
"""Pure logic for regenerating the shared registries from concept-board members.

Zero SDK / IO: it consumes already-fetched ``MemberBasic`` rows and a board
mapping, and returns JSON-serializable registry entries. The Tushare access
lives in ``board_source.py``; this module is fully unit-testable with fakes.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional


@dataclass(frozen=True)
class MemberBasic:
    ts_code: str        # "300308.SZ"
    name: str           # "中际旭创"
    circ_mv: float      # free-float market cap, 万元 (ranking key)
    amount: float       # daily turnover, 千元 (liquidity floor; 0/None => suspended)
    list_date: str      # "YYYYMMDD"


def is_eligible(m: MemberBasic, ref_date: str, min_amount: float, min_listed_days: int) -> bool:
    """A member is representative-eligible if it is not ST, not suspended, not
    too newly listed, and meets the liquidity floor."""
    if "ST" in (m.name or "").upper():
        return False
    if not m.amount or m.amount <= 0:          # no turnover that day => suspended
        return False
    if not m.circ_mv or m.circ_mv <= 0:
        return False
    if m.amount < min_amount:
        return False
    try:
        listed = datetime.strptime(m.list_date, "%Y%m%d").date()
        ref = datetime.strptime(ref_date, "%Y%m%d").date()
    except (ValueError, TypeError):
        return False
    return (ref - listed).days >= min_listed_days


def rank_members(
    members: List[MemberBasic], ref_date: str, min_amount: float, min_listed_days: int
) -> List[MemberBasic]:
    """Eligible members, sorted by free-float market cap descending (ts_code tie-break)."""
    eligible = [m for m in members if is_eligible(m, ref_date, min_amount, min_listed_days)]
    return sorted(eligible, key=lambda m: (-m.circ_mv, m.ts_code))


def compute_order_index(mapping: List[dict]) -> Dict[str, int]:
    """Per-theme sequential displayOrder (1-based) keyed by subThemeId."""
    counts: Dict[str, int] = {}
    order: Dict[str, int] = {}
    for spec in mapping:
        theme = spec["themeId"]
        counts[theme] = counts.get(theme, 0) + 1
        order[spec["subThemeId"]] = counts[theme]
    return order


def assign_primary(
    ranked_by_sub: Dict[str, List[MemberBasic]],
    order_index: Dict[str, int],
    target_n: int,
) -> Dict[str, List[MemberBasic]]:
    """Assign each stock to exactly one sub-theme (its best-ranked board), filling
    each sub-theme up to ``target_n`` with the best available not-yet-taken stocks.

    Deterministic: candidates processed by (rank asc, displayOrder asc,
    subThemeId, ts_code). Guarantees no stock appears under two sub-themes.
    """
    candidates = []
    for sub_id, members in ranked_by_sub.items():
        do = order_index.get(sub_id, 0)
        for rank, m in enumerate(members):
            candidates.append((rank, do, sub_id, m))
    candidates.sort(key=lambda c: (c[0], c[1], c[2], c[3].ts_code))

    assigned: set = set()
    result: Dict[str, List[MemberBasic]] = {sub_id: [] for sub_id in ranked_by_sub}
    for rank, do, sub_id, m in candidates:
        if m.ts_code in assigned:
            continue
        if len(result[sub_id]) >= target_n:
            continue
        result[sub_id].append(m)
        assigned.add(m.ts_code)
    return result


def build_registries(mapping: List[dict], assignments: Dict[str, List[MemberBasic]]):
    """Return (sub_theme_entries, stock_entries) as JSON-serializable dicts."""
    order_index = compute_order_index(mapping)
    sub_entries: List[dict] = []
    stock_entries: List[dict] = []
    for spec in mapping:
        sub_id = spec["subThemeId"]
        sub_entries.append({
            "id": sub_id,
            "name": spec["name"],
            "shortName": spec["shortName"],
            "themeId": spec["themeId"],
            "displayOrder": order_index[sub_id],
            # themeId is a valid SectorId for all 11 themes; the mapping may
            # override with a finer sector during curation review.
            "primarySectorId": spec.get("primarySectorId", spec["themeId"]),
            "areaWeight": 0.8,   # SP2 will drive this from live market heat
        })
        for m in assignments.get(sub_id, []):
            code = m.ts_code.split(".")[0]
            stock_entries.append({
                "id": f"s-{code}",
                "name": m.name,
                "shortName": m.name,
                "subThemeId": sub_id,
                "code": code,
            })
    return sub_entries, stock_entries
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest server/tests/test_registry_builder.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/registry_builder.py server/tests/test_registry_builder.py
git commit -m "feat: pure registry-builder logic (rank, dedup, emit)"
```

---

### Task 2: Board membership source (`board_source.py`)

**Files:**
- Create: `server/capital_flow/board_source.py`
- Test: `server/tests/test_board_source.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_board_source.py`:

```python
from server.capital_flow.board_source import (
    BoardInfo,
    BoardMembershipSource,
    FakeBoardSource,
)
from server.capital_flow.registry_builder import MemberBasic


def test_fake_board_source_satisfies_protocol_and_returns_data():
    src: BoardMembershipSource = FakeBoardSource(
        latest="20260617",
        boards=[BoardInfo(ts_code="885001.TI", name="CPO", member_count=2)],
        members={"885001.TI": ["300308.SZ", "300502.SZ"]},
        basics={
            "300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
            "300502.SZ": MemberBasic("300502.SZ", "新易盛", 5e6, 8e5, "20160101"),
        },
    )
    assert src.latest_trade_date() == "20260617"
    assert src.list_boards()[0].name == "CPO"
    assert src.board_members("885001.TI") == ["300308.SZ", "300502.SZ"]
    assert src.basics("20260617")["300308.SZ"].name == "中际旭创"
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest server/tests/test_board_source.py -q`
Expected: FAIL at import — `ModuleNotFoundError: No module named 'server.capital_flow.board_source'`.

- [ ] **Step 3: Implement `board_source.py`**

Create `server/capital_flow/board_source.py`:

```python
"""Concept-board membership source.

A Protocol decouples the registry generator from the Tushare SDK (tests inject
``FakeBoardSource``). ``TushareBoardSource`` is thin glue over ``tushare.pro_api``
calling ths_index / ths_member / daily_basic / daily / stock_basic; its real
behavior is validated at the user's preflight (``--list-boards``), while all
generator logic is tested against the fake.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Protocol

from .registry_builder import MemberBasic


@dataclass(frozen=True)
class BoardInfo:
    ts_code: str
    name: str
    member_count: int


class BoardMembershipSource(Protocol):
    def latest_trade_date(self) -> str: ...
    def list_boards(self) -> List[BoardInfo]: ...
    def board_members(self, board_ts_code: str) -> List[str]: ...
    def basics(self, trade_date: str) -> Dict[str, MemberBasic]: ...


class FakeBoardSource:
    """In-memory source for tests."""

    def __init__(self, latest, boards, members, basics):
        self._latest = latest
        self._boards = boards
        self._members = members
        self._basics = basics

    def latest_trade_date(self) -> str:
        return self._latest

    def list_boards(self) -> List[BoardInfo]:
        return list(self._boards)

    def board_members(self, board_ts_code: str) -> List[str]:
        return list(self._members.get(board_ts_code, []))

    def basics(self, trade_date: str) -> Dict[str, MemberBasic]:
        return dict(self._basics)


class TushareBoardSource:
    """Tushare adapter. Concept boards via ths_index(type='N'); members via
    ths_member; circ_mv via daily_basic; amount via daily; name/list_date via
    stock_basic (cached). Built the same way as TushareCapitalFlowSource."""

    def __init__(self, api):
        self._api = api
        self._stock_basic_cache: Dict[str, tuple] = {}

    @classmethod
    def from_environment(cls, env: dict) -> "TushareBoardSource":
        import tushare  # local import: SDK optional at test time
        token = (env.get("TUSHARE_TOKEN") or "").strip()
        if not token:
            raise RuntimeError("TUSHARE_TOKEN is required for board membership")
        return cls(tushare.pro_api(token))

    def latest_trade_date(self) -> str:
        df = self._api.trade_cal(
            exchange="SSE", is_open="1",
            end_date=__import__("datetime").date.today().strftime("%Y%m%d"),
        )
        return str(sorted(df["cal_date"].tolist())[-1])

    def list_boards(self) -> List[BoardInfo]:
        df = self._api.ths_index(exchange="A", type="N")  # N = 概念指数
        return [BoardInfo(ts_code=r["ts_code"], name=r["name"],
                          member_count=int(r.get("count") or 0))
                for _, r in df.iterrows()]

    def board_members(self, board_ts_code: str) -> List[str]:
        df = self._api.ths_member(ts_code=board_ts_code)
        return [r["con_code"] for _, r in df.iterrows()]

    def _load_stock_basic(self) -> None:
        if self._stock_basic_cache:
            return
        df = self._api.stock_basic(fields="ts_code,name,list_date")
        for _, r in df.iterrows():
            self._stock_basic_cache[r["ts_code"]] = (r["name"], str(r["list_date"]))

    def basics(self, trade_date: str) -> Dict[str, MemberBasic]:
        self._load_stock_basic()
        db = self._api.daily_basic(trade_date=trade_date, fields="ts_code,circ_mv")
        dy = self._api.daily(trade_date=trade_date, fields="ts_code,amount")
        amount_by = {r["ts_code"]: float(r["amount"] or 0) for _, r in dy.iterrows()}
        out: Dict[str, MemberBasic] = {}
        for _, r in db.iterrows():
            ts = r["ts_code"]
            name, list_date = self._stock_basic_cache.get(ts, ("", "19900101"))
            out[ts] = MemberBasic(
                ts_code=ts, name=name,
                circ_mv=float(r["circ_mv"] or 0),
                amount=amount_by.get(ts, 0.0),
                list_date=list_date,
            )
        return out
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest server/tests/test_board_source.py -q`
Expected: PASS (1 passed). (`TushareBoardSource` is glue, exercised at preflight; the fake covers the seam used by the generator.)

- [ ] **Step 5: Commit**

```bash
git add server/capital_flow/board_source.py server/tests/test_board_source.py
git commit -m "feat: BoardMembershipSource protocol + Tushare adapter + fake"
```

---

### Task 3: Generator CLI (`scripts/generate_registries.py`)

**Files:**
- Create: `scripts/generate_registries.py`
- Test: `server/tests/test_generate_registries.py`

- [ ] **Step 1: Write the failing test**

Create `server/tests/test_generate_registries.py`:

```python
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.generate_registries import run_build
from server.capital_flow.board_source import BoardInfo, FakeBoardSource
from server.capital_flow.registry_builder import MemberBasic


def _source():
    return FakeBoardSource(
        latest="20260617",
        boards=[BoardInfo("885001.TI", "CPO", 2), BoardInfo("885002.TI", "AI算力", 2)],
        members={"885001.TI": ["300308.SZ", "300502.SZ"],
                 "885002.TI": ["300308.SZ", "688041.SH"]},  # 300308 in both
        basics={
            "300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
            "300502.SZ": MemberBasic("300502.SZ", "新易盛", 5e6, 8e5, "20160101"),
            "688041.SH": MemberBasic("688041.SH", "海光信息", 8e6, 9e5, "20220101"),
        },
    )


def test_run_build_produces_deduped_registries():
    mapping = [
        {"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
         "themeId": "ai-computing", "boardTsCode": "885001.TI", "boardName": "CPO"},
        {"subThemeId": "compute", "name": "AI算力", "shortName": "算力",
         "themeId": "ai-computing", "boardTsCode": "885002.TI", "boardName": "AI算力"},
    ]
    subs, stocks, summary = run_build(_source(), mapping, target_n=8,
                                      min_amount=5e5, min_listed_days=60)
    assert {s["id"] for s in subs} == {"opt", "compute"}
    codes = [s["code"] for s in stocks]
    assert len(codes) == len(set(codes))                 # each stock once
    assert "300308" in codes                              # 中际旭创 assigned once
    assert summary["totalStocks"] == len(stocks)


def test_preflight_permission_error_is_reported(capsys):
    from scripts.generate_registries import preflight

    class Denied:
        def list_boards(self): raise PermissionError("ths_member not authorized")
        def latest_trade_date(self): return "20260617"
        def board_members(self, b): return []
        def basics(self, d): return {}

    with pytest.raises(SystemExit):
        preflight(Denied())
    assert "not authorized" in capsys.readouterr().out
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m pytest server/tests/test_generate_registries.py -q`
Expected: FAIL at import — `ModuleNotFoundError: No module named 'scripts.generate_registries'`.

- [ ] **Step 3: Implement `scripts/generate_registries.py`**

Create `scripts/generate_registries.py`:

```python
"""Regenerate the shared registries from real Tushare concept-board membership.

Run from the project root (needs TUSHARE_TOKEN in the environment):

    python3 scripts/generate_registries.py --list-boards   # preflight + catalog
    python3 scripts/generate_registries.py --build         # regenerate registries

`--list-boards` writes data/boardCatalog.json and verifies entitlement.
`--build` reads src/data/conceptBoardMapping.json and rewrites the registries.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.capital_flow.board_source import TushareBoardSource
from server.capital_flow.registry_builder import (
    MemberBasic, build_registries, compute_order_index, assign_primary, rank_members,
)

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "boardCatalog.json"
MAPPING = ROOT / "src" / "data" / "conceptBoardMapping.json"
SUB_OUT = ROOT / "src" / "data" / "subThemeRegistry.json"
STOCK_OUT = ROOT / "src" / "data" / "stockRegistry.json"


def run_build(source, mapping, *, target_n=8, min_amount=5e5, min_listed_days=60):
    ref = source.latest_trade_date()
    basics = source.basics(ref)
    order_index = compute_order_index(mapping)
    ranked_by_sub: Dict[str, List[MemberBasic]] = {}
    for spec in mapping:
        codes = source.board_members(spec["boardTsCode"])
        members = [basics[c] for c in codes if c in basics]
        ranked_by_sub[spec["subThemeId"]] = rank_members(
            members, ref, min_amount, min_listed_days)
    assignments = assign_primary(ranked_by_sub, order_index, target_n)
    subs, stocks = build_registries(mapping, assignments)
    summary = {
        "refDate": ref,
        "subThemes": len(subs),
        "totalStocks": len(stocks),
        "underTarget": [s["subThemeId"] for s in mapping
                        if len(assignments.get(s["subThemeId"], [])) < min(3, target_n)],
    }
    return subs, stocks, summary


def preflight(source) -> None:
    try:
        boards = source.list_boards()
    except Exception as exc:  # noqa: BLE001 - report any entitlement/SDK failure
        print(f"PREFLIGHT FAILED: cannot list concept boards: {exc}")
        raise SystemExit(2)
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps(
        [{"ts_code": b.ts_code, "name": b.name, "member_count": b.member_count}
         for b in boards], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {len(boards)} concept boards -> {CATALOG}")


def _write(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list-boards", action="store_true")
    ap.add_argument("--build", action="store_true")
    args = ap.parse_args()
    source = TushareBoardSource.from_environment(os.environ)
    if args.list_boards:
        preflight(source)
        return
    if args.build:
        mapping = json.loads(MAPPING.read_text(encoding="utf-8"))
        subs, stocks, summary = run_build(source, mapping)
        _write(SUB_OUT, subs)
        _write(STOCK_OUT, stocks)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    ap.error("choose --list-boards or --build")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run to verify it passes**

Run: `python3 -m pytest server/tests/test_generate_registries.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_registries.py server/tests/test_generate_registries.py
git commit -m "feat: generate_registries CLI (preflight + build) over fake/real source"
```

---

### Task 4: Committed-registry integrity validators (Python + TS)

**Files:**
- Create: `server/tests/test_registry_integrity.py`
- Create: `src/domain/registryIntegrity.test.ts`

These assert UNIVERSAL invariants that hold for the current registry too (so they
guard now and after expansion). They do NOT assert "each stock once" (the current
registry intentionally cross-lists 9 stocks); the aggregation invariant covers safety.

- [ ] **Step 1: Write the Python validator (run against the current registry; it must PASS)**

Create `server/tests/test_registry_integrity.py`:

```python
import json
from pathlib import Path

from server.capital_flow.registry import normalize_a_share_code

ROOT = Path(__file__).resolve().parents[2]
SUBS = json.loads((ROOT / "src/data/subThemeRegistry.json").read_text(encoding="utf-8"))
STOCKS = json.loads((ROOT / "src/data/stockRegistry.json").read_text(encoding="utf-8"))

THEME_IDS = {
    "ai-computing", "robotics-physical-ai", "low-altitude-economy", "semiconductors",
    "new-energy", "defense-aerospace", "innovative-medicine", "new-energy-vehicles",
    "consumer-electronics", "digital-economy", "fintech",
}


def test_every_stock_code_normalizes():
    for s in STOCKS:
        assert normalize_a_share_code(s["code"]) is not None, s["code"]


def test_every_stock_subtheme_exists():
    sub_ids = {s["id"] for s in SUBS}
    for s in STOCKS:
        assert s["subThemeId"] in sub_ids, s["subThemeId"]


def test_every_subtheme_theme_is_valid():
    for s in SUBS:
        assert s["themeId"] in THEME_IDS, s["themeId"]


def test_ids_unique():
    assert len({s["id"] for s in SUBS}) == len(SUBS)
    assert len({s["id"] for s in STOCKS}) == len(STOCKS)
```

- [ ] **Step 2: Run to verify it PASSES on the current registry**

Run: `python3 -m pytest server/tests/test_registry_integrity.py -q`
Expected: PASS (4 passed). (If any fails, the current registry has a pre-existing issue — stop and report; do not "fix" by weakening the test.)

- [ ] **Step 3: Write the TS validator + aggregation invariant**

Create `src/domain/registryIntegrity.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import stocks from "../data/stockRegistry.json";
import subThemes from "../data/subThemeRegistry.json";
import { buildCapitalFlowAggregates } from "./capitalFlowAggregation";

const subIds = new Set((subThemes as Array<{ id: string }>).map((s) => s.id));

describe("registry integrity", () => {
  it("every stock maps to a real sub-theme", () => {
    for (const s of stocks as Array<{ subThemeId: string }>) {
      expect(subIds.has(s.subThemeId)).toBe(true);
    }
  });

  it("every stock code is 6 digits", () => {
    for (const s of stocks as Array<{ code: string }>) {
      expect(/^\d{6}$/.test(s.code)).toBe(true);
    }
  });

  it("aggregation invariant: P1 == P2 == unique-P3 (within 0.01 CNY)", () => {
    // Synthetic uniform inflow per UNIQUE stock code so the invariant is purely
    // structural (dedup-aware via aggregationRole). Build points from the registry.
    const seen = new Set<string>();
    const points = (stocks as Array<{ code: string; subThemeId: string }>)
      .filter((s) => (seen.has(s.code) ? false : (seen.add(s.code), true)))
      .map((s) => ({
        stockId: `s-${s.code}`,
        securityCode: `${s.code}.X`,
        stockName: s.code,
        subThemeId: s.subThemeId,
        themeId: (subThemes as Array<{ id: string; themeId: string }>).find(
          (st) => st.id === s.subThemeId,
        )!.themeId,
        aggregationRole: "primary" as const,
        netAmountMain: 1_000_000,
        tradeDate: "2026-06-17",
      }));
    const agg = buildCapitalFlowAggregates(points);
    const p1 = agg.byTheme.reduce((a, t) => a + t.netAmountMain, 0);
    const p2 = agg.bySubTheme.reduce((a, t) => a + t.netAmountMain, 0);
    const p3 = agg.byStock.reduce((a, t) => a + t.netAmountMain, 0);
    expect(Math.abs(p1 - p2)).toBeLessThan(0.01);
    expect(Math.abs(p2 - p3)).toBeLessThan(0.01);
  });
});
```

> If `buildCapitalFlowAggregates` expects a different point shape, read
> `src/domain/capitalFlowAggregation.ts` and match its input type exactly — keep
> the three-way equality assertion.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/domain/registryIntegrity.test.ts`
Expected: PASS. (Adjust the point shape to the real aggregator input if needed; the assertion stays.)

- [ ] **Step 5: Commit**

```bash
git add server/tests/test_registry_integrity.py src/domain/registryIntegrity.test.ts
git commit -m "test: registry integrity validators (invariants + aggregation)"
```

---

### Task 5: Populate the registries (collaborative, token-gated)

**Files:**
- Create: `src/data/conceptBoardMapping.json`
- Regenerate: `src/data/subThemeRegistry.json`, `src/data/stockRegistry.json`

This task is NOT autonomous — it needs the user's Tushare token and the user's
review of the mapping. The controller coordinates; the implementer does not guess.

- [ ] **Step 1: User runs preflight (their terminal, their token)**

```bash
set -a; source .env; set +a
python3 scripts/generate_registries.py --list-boards
```
Expected: `OK: <N> concept boards -> data/boardCatalog.json`. If it prints `PREFLIGHT FAILED`, stop and switch to the fallback (申万 membership / narrower scope per the spec).

- [ ] **Step 2: Controller drafts the board mapping from the catalog**

Read `data/boardCatalog.json`; draft `src/data/conceptBoardMapping.json` — for each of the 11 themes, ~7 sub-themes, each `{subThemeId, name, shortName, themeId, boardTsCode, boardName}` (optional `primarySectorId` from the existing fine sectors). Match board names to the narrative themes. Example entry:

```json
[
  { "subThemeId": "ai-cpo", "name": "光模块/CPO", "shortName": "CPO",
    "themeId": "ai-computing", "boardTsCode": "885xxx.TI", "boardName": "CPO概念",
    "primarySectorId": "cpo" }
]
```

- [ ] **Step 3: User reviews the mapping** (the curation gate) — corrects board choices / sub-theme names. This is where domain expertise lands.

- [ ] **Step 4: User runs the build (their token)**

```bash
set -a; source .env; set +a
python3 scripts/generate_registries.py --build
```
Expected: a JSON summary (`subThemes`, `totalStocks ≈ 600`, `underTarget` list). Investigate any `underTarget` sub-themes (remap or accept).

- [ ] **Step 5: Run the full gate + commit**

```bash
python3 -m pytest server/tests -q          # includes integrity + aggregation
npm test                                   # includes TS integrity validator
npm run build                              # tsc + vite build still green
git add src/data/conceptBoardMapping.json src/data/subThemeRegistry.json src/data/stockRegistry.json
git commit -m "data: expand registries to concept-anchored sub-themes + representative stocks"
```
If any test fails (e.g., a dangling reference or an aggregation mismatch), fix the data/mapping — never weaken a validator.

---

### Task 6: (Conditional) quota-neutral daily sync

**Do this ONLY if Task 5's `--build` or the daily CI shows Tushare rate-limit strain** at ~600 stocks. Otherwise skip — the existing batched fetch is fine.

**Files:**
- Modify: `server/capital_flow/source.py` (add a full-day bulk path)
- Test: `server/tests/test_tushare_source.py`

- [ ] **Step 1: Write the failing test** — a `moneyflow_dc(trade_date=…)` call WITHOUT `ts_code` returns the whole day; the adapter filters to the requested securities locally, issuing one call regardless of universe size. (Model the test on the existing `test_tushare_source.py` fake-`_api` pattern; assert the fake records exactly one `moneyflow_dc` call for a 600-code request.)

- [ ] **Step 2-5:** Implement the bulk path behind a flag, verify one-call behavior, run `python3 -m pytest server/tests/test_tushare_source.py -q`, commit `perf: optional full-day bulk capital-flow fetch`.

> Full code deferred to implementation time because the exact trigger (measured call volume) and the existing test-fake shape must be read first; this task is conditional and may be dropped.

---

## Self-review

**Spec coverage:**
- Data-driven concept-board sourcing → Tasks 2 (source) + 3 (CLI) + 5 (populate). ✅
- Board mapping curation artifact → Task 5 Step 2-3. ✅
- Rank by free-float mkt cap + liquidity floor (ST/suspended/new excluded) → Task 1 `is_eligible`/`rank_members`. ✅
- Dedup to one sub-theme per stock → Task 1 `assign_primary` + Task 3 test. ✅
- Layout fields (displayOrder, primarySectorId=themeId default, areaWeight=0.8) → Task 1 `build_registries`. ✅
- Aggregation invariant preserved → Task 4 (TS + Python validators). ✅
- Entitlement preflight + fallback → Task 3 `preflight` + Task 5 Step 1. ✅
- Quota contingency → Task 6 (conditional). ✅
- Honesty (real membership, reviewed mapping) → Task 5 collaborative gate. ✅

**Placeholder scan:** Task 6 intentionally defers full code (conditional task, gated on measured strain + reading the existing fake shape) — flagged, not a silent gap. All non-conditional tasks have complete code.

**Type consistency:** `MemberBasic(ts_code,name,circ_mv,amount,list_date)`, `BoardInfo(ts_code,name,member_count)`, and the function signatures (`is_eligible`, `rank_members`, `assign_primary`, `build_registries`, `compute_order_index`, `run_build`, `preflight`) are used identically across Tasks 1-3 and their tests. Registry entry shapes match the established JSON schemas. `primarySectorId` defaults to `themeId` (a valid sector id).
