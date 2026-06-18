from datetime import date

import pytest

from server.capital_flow.models import (
    SnapshotDraft,
    SnapshotFailure,
    SourcePoint,
    StockMapping,
)
from server.capital_flow.repository import SnapshotRepository


def _draft(
    trade_date=date(2026, 6, 12),
    status="ready",
    net=12_345_600.0,
    fetched_at="2026-06-12T16:00:00Z",
) -> SnapshotDraft:
    point = SourcePoint(
        security_code="300308.XSHE",
        trade_date=trade_date,
        net_amount_main=net,
    )
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
        fetched_at=fetched_at,
        source="tushare",
        metric="net_amount_main",
        unit="CNY",
        status=status,
        requested=10,
        succeeded=9,
        failed=1,
        points=[point],
        mappings=[mapping],
        failures=[SnapshotFailure(reason="missing_source_row", security_code="000001.XSHE")],
        theme_totals={"ai-computing": net},
        sub_theme_totals={"optical-interconnect": net},
    )


def test_save_and_expand_snapshot(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft())
    result = repo.get_snapshot("2026-06-12")
    assert result["tradeDate"] == "2026-06-12"
    assert result["unit"] == "CNY"
    assert result["source"] == "tushare"
    assert result["status"] == "ready"
    assert result["coverage"] == {"requested": 10, "succeeded": 9, "failed": 1}
    assert result["points"][0]["aggregationRole"] == "primary"
    assert result["points"][0]["netAmountMain"] == 12_345_600.0
    assert result["points"][0]["stockId"] == "aci-zjxc"
    assert result["failures"][0]["reason"] == "missing_source_row"


def test_latest_prefers_ready_over_partial(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 11), status="ready"))
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 12), status="partial"))
    latest = repo.get_latest_snapshot()
    # Even though 06-12 partial is newer, the ready 06-11 wins.
    assert latest["status"] == "ready"
    assert latest["tradeDate"] == "2026-06-11"


def test_latest_falls_back_to_partial_when_no_ready(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 12), status="partial"))
    latest = repo.get_latest_snapshot()
    assert latest["status"] == "partial"


def test_latest_returns_none_when_empty(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    assert repo.get_latest_snapshot() is None


def test_get_snapshot_returns_none_for_missing_date(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    assert repo.get_snapshot("2026-06-11") is None


def test_replacing_a_date_overwrites_atomically(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft(net=100.0))
    repo.save_snapshot(_draft(net=999.0))
    result = repo.get_snapshot("2026-06-12")
    assert result["points"][0]["netAmountMain"] == 999.0
    # Only one snapshot row for that date.
    assert repo.list_trade_dates() == ["2026-06-12"]


def test_status_lists_dates_descending(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 10)))
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 12)))
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 11)))
    status = repo.status()
    assert status["availableTradeDates"] == [
        "2026-06-12",
        "2026-06-11",
        "2026-06-10",
    ]
    assert status["latestTradeDate"] == "2026-06-12"
    assert status["latestStatus"] == "ready"
    assert status["source"] == "tushare"
    assert status["metric"] == "net_amount_main"
    assert status["databaseAvailable"] is True


def test_transaction_rolls_back_when_mapping_insert_fails(tmp_db_path):
    """A foreign-key failure on a child row must leave the DB empty."""
    repo = SnapshotRepository(tmp_db_path)
    draft = _draft()
    # Corrupt: mapping references a snapshot_id that cannot exist because we
    # force the points insert to reference a non-existent security by injecting
    # an invalid point set after construction. Easier: directly verify the
    # ``with connection:`` contract by inserting a duplicate primary key.
    draft.points.append(
        SourcePoint(
            security_code="300308.XSHE",  # duplicate PK (snapshot_id, security_code)
            trade_date=date(2026, 6, 12),
            net_amount_main=1.0,
        )
    )
    with pytest.raises(Exception):
        repo.save_snapshot(draft)
    # Nothing persisted.
    assert repo.list_trade_dates() == []


def test_get_window_snapshot_sums_across_days(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 17)))
    repo.save_snapshot(_draft(trade_date=date(2026, 6, 16)))
    snap = repo.get_window_snapshot(5, "近5日")
    assert snap["window"]["availableDays"] == 2
    assert snap["window"]["to"] == "2026-06-17"
    assert snap["window"]["from"] == "2026-06-16"
    assert snap["points"][0]["netAmountMain"] == 12_345_600.0 * 2
    repo.close()


def test_get_window_snapshot_none_when_empty(tmp_db_path):
    repo = SnapshotRepository(tmp_db_path)
    assert repo.get_window_snapshot(5, "近5日") is None
    repo.close()
