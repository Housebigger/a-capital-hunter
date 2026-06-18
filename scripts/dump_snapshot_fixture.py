"""Generate a golden snapshot fixture from the REAL backend serializer.

Run from the project root:

    python3 scripts/dump_snapshot_fixture.py

It builds a small deterministic snapshot, persists it through the real
``SnapshotRepository`` (so the JSON is produced by the same ``_expand`` code the
Flask API uses), and writes it to::

    src/test/fixtures/backendSnapshot.sample.json

The frontend contract test (``src/data/capitalFlowSnapshot.test.ts``) parses this
file through ``parseSnapshot``. If a backend shape change ever breaks the
frontend contract again (e.g. dropping a per-point field), regenerating the
fixture makes that test fail — closing the gap that let the missing-``tradeDate``
bug ship while every hand-written mock stayed green.
"""

from __future__ import annotations

import json
import sys
import tempfile
from datetime import date
from pathlib import Path

# Allow `python3 scripts/dump_snapshot_fixture.py` from the project root: the
# script's own directory (scripts/) is on sys.path by default, not the root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.capital_flow.models import (
    SnapshotDraft,
    SnapshotFailure,
    SourcePoint,
    StockMapping,
)
from server.capital_flow.repository import SnapshotRepository

TRADE_DATE = date(2026, 6, 12)


def _build_draft() -> SnapshotDraft:
    return SnapshotDraft(
        trade_date=TRADE_DATE,
        fetched_at="2026-06-12T16:00:00Z",
        source="tushare",
        metric="net_amount_main",
        unit="CNY",
        status="ready",
        requested=10,
        succeeded=9,
        failed=1,
        points=[
            SourcePoint("300308.XSHE", TRADE_DATE, 12_345_600.0),
            SourcePoint("002475.XSHE", TRADE_DATE, -4_200_000.0),
        ],
        mappings=[
            StockMapping(
                stock_id="aci-zjxc",
                stock_name="中际旭创",
                short_name="中际旭创",
                raw_code="300308",
                security_code="300308.XSHE",
                sub_theme_id="optical-interconnect",
                theme_id="ai-computing",
                aggregation_role="primary",
            ),
            StockMapping(
                stock_id="ce-lxkj",
                stock_name="立讯精密",
                short_name="立讯精密",
                raw_code="002475",
                security_code="002475.XSHE",
                sub_theme_id="consumer-electronics-assembly",
                theme_id="consumer-electronics",
                aggregation_role="primary",
            ),
        ],
        failures=[
            SnapshotFailure(reason="missing_source_row", security_code="000001.XSHE")
        ],
        theme_totals={"ai-computing": 12_345_600.0, "consumer-electronics": -4_200_000.0},
        sub_theme_totals={
            "optical-interconnect": 12_345_600.0,
            "consumer-electronics-assembly": -4_200_000.0,
        },
    )


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        repo = SnapshotRepository(Path(tmp) / "fixture.sqlite3")
        repo.save_snapshot(_build_draft())
        snapshot = repo.get_window_snapshot(1, "今日")
        repo.close()

    out_path = (
        Path(__file__).resolve().parent.parent
        / "src"
        / "test"
        / "fixtures"
        / "backendSnapshot.sample.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {out_path} ({len(snapshot['points'])} points)")


if __name__ == "__main__":
    main()
