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
from server.capital_flow.registry import normalize_a_share_code
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
        members = [basics[c] for c in codes
                   if c in basics and normalize_a_share_code(c.split(".")[0]) is not None]
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
