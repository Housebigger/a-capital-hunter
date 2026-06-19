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
