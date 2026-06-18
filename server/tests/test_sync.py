from datetime import date

import pytest

from server.capital_flow.source import CapitalFlowSourceError
from server.capital_flow.sync import build_summary, run_sync


def test_build_summary_excludes_credentials_and_includes_status():
    summary = build_summary(
        trade_date=date(2026, 6, 12),
        status="ready",
        requested=168,
        succeeded=160,
        failed=8,
        error=None,
    )
    assert summary["tradeDate"] == "2026-06-12"
    assert summary["status"] == "ready"
    assert summary["coverage"]["requested"] == 168
    assert summary["coverage"]["succeeded"] == 160
    assert summary["coverage"]["failed"] == 8
    assert "username" not in summary
    assert "password" not in summary


def test_build_summary_includes_error_without_credentials():
    summary = build_summary(
        trade_date=None,
        status=None,
        requested=0,
        succeeded=0,
        failed=0,
        error="CapitalFlowSourceError: JQData authentication failed",
    )
    assert summary["error"] == "CapitalFlowSourceError: JQData authentication failed"
    assert summary["status"] is None


def test_run_sync_returns_nonzero_when_credentials_missing(monkeypatch, tmp_path, capsys):
    # Empty environment → source factory raises → exit 1
    monkeypatch.delenv("TUSHARE_TOKEN", raising=False)
    monkeypatch.delenv("JQDATA_USERNAME", raising=False)
    monkeypatch.delenv("JQDATA_PASSWORD", raising=False)
    monkeypatch.setenv("CAPITAL_FLOW_DB", str(tmp_path / "cf.sqlite3"))
    code = run_sync(
        ["--trade-date", "latest", "--database", str(tmp_path / "cf.sqlite3")],
        env={},
    )
    assert code == 1


def test_build_source_defaults_to_tushare():
    """Without CAPITAL_FLOW_SOURCE, Tushare is selected (no region restriction,
    free 2000-point moneyflow path)."""
    from server.capital_flow.sync import build_source_from_environment
    with pytest.raises(CapitalFlowSourceError, match="TUSHARE_TOKEN"):
        build_source_from_environment({})


def test_build_source_selects_jqdata_when_configured():
    from server.capital_flow.sync import build_source_from_environment
    with pytest.raises(CapitalFlowSourceError, match="JQDATA_USERNAME"):
        build_source_from_environment(
            {"CAPITAL_FLOW_SOURCE": "jqdata"}
        )


def test_build_source_rejects_unknown_kind():
    from server.capital_flow.sync import build_source_from_environment
    with pytest.raises(CapitalFlowSourceError, match="Unknown CAPITAL_FLOW_SOURCE"):
        build_source_from_environment({"CAPITAL_FLOW_SOURCE": "bloomberg"})


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

