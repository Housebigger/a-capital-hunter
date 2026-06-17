from datetime import date

import pytest

from server.capital_flow.models import SourcePoint
from server.capital_flow.source import (
    CapitalFlowSourceError,
    TushareCapitalFlowSource,
)


def test_fetch_daily_uses_moneyflow_dc_and_converts_wan_to_yuan(fake_tushare_api):
    # moneyflow_dc returns net_amount in 万元; 1234.56 万元 → 12_345_600 元
    fake_tushare_api.dc_rows = [
        {"ts_code": "300308.SZ", "trade_date": "20260612", "net_amount": 1234.56},
    ]
    source = TushareCapitalFlowSource(token="secret-token", api=fake_tushare_api)
    points = source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    assert points == [
        SourcePoint(
            security_code="300308.XSHE",
            trade_date=date(2026, 6, 12),
            net_amount_main=12_345_600.0,
        )
    ]
    # Requested code must be converted from our .XSHE format to Tushare .SZ
    call = fake_tushare_api.dc_calls[0]
    assert call["ts_code"] == "300308.SZ"
    assert call["trade_date"] == "20260612"


def test_fetch_daily_converts_shanghai_suffix(fake_tushare_api):
    fake_tushare_api.dc_rows = [
        {"ts_code": "688111.SH", "trade_date": "20260612", "net_amount": 1.0},
    ]
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    points = source.fetch_daily(date(2026, 6, 12), ["688111.XSHG"])
    assert points[0].security_code == "688111.XSHG"


def test_falls_back_to_moneyflow_when_dc_permission_denied(fake_tushare_api):
    # moneyflow_dc permission error → degrade to moneyflow
    fake_tushare_api.dc_error = Exception(
        "抱歉，您每天最多访问该接口2次，权限的具体详情访问:..."
    )
    # moneyflow gives buy/sell components in 万元; main force =
    # (buy_elg - sell_elg) + (buy_lg - sell_lg)
    fake_tushare_api.mf_rows = [
        {
            "ts_code": "300308.SZ", "trade_date": "20260612",
            "buy_elg_amount": 1000.0, "sell_elg_amount": 200.0,
            "buy_lg_amount": 500.0, "sell_lg_amount": 300.0,
        },
    ]
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    points = source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    # main = (1000-200) + (500-300) = 1000 万元 → 10_000_000 元
    assert points == [
        SourcePoint(
            security_code="300308.XSHE",
            trade_date=date(2026, 6, 12),
            net_amount_main=10_000_000.0,
        )
    ]
    assert len(fake_tushare_api.mf_calls) == 1


def test_falls_back_per_security_batch_not_whole_universe(fake_tushare_api):
    # If dc fails, the whole batch degrades to moneyflow (not one-by-one).
    fake_tushare_api.dc_error = Exception("权限不足")
    fake_tushare_api.mf_rows = [
        {"ts_code": "300308.SZ", "trade_date": "20260612",
         "buy_elg_amount": 100.0, "sell_elg_amount": 0.0,
         "buy_lg_amount": 0.0, "sell_lg_amount": 0.0},
        {"ts_code": "688111.SH", "trade_date": "20260612",
         "buy_elg_amount": 200.0, "sell_elg_amount": 0.0,
         "buy_lg_amount": 0.0, "sell_lg_amount": 0.0},
    ]
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    points = source.fetch_daily(date(2026, 6, 12), ["300308.XSHE", "688111.XSHG"])
    assert len(points) == 2


def test_omits_rows_with_missing_or_non_finite_values(fake_tushare_api):
    fake_tushare_api.dc_rows = [
        {"ts_code": "300308.SZ", "trade_date": "20260612", "net_amount": None},
        {"ts_code": "688111.SH", "trade_date": "20260612", "net_amount": float("nan")},
        {"ts_code": "000001.SZ", "trade_date": "20260612", "net_amount": 500.0},
    ]
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    points = source.fetch_daily(
        date(2026, 6, 12), ["300308.XSHE", "688111.XSHG", "000001.XSHE"]
    )
    assert len(points) == 1
    assert points[0].security_code == "000001.XSHE"


def test_latest_trade_date_uses_trade_cal(fake_tushare_api):
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    assert source.latest_trade_date() == date(2026, 6, 12)


def test_is_trade_date_delegates_to_trade_cal(fake_tushare_api):
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    assert source.is_trade_date(date(2026, 6, 12)) is True
    assert source.is_trade_date(date(2026, 6, 11)) is False


def test_token_is_required():
    with pytest.raises(CapitalFlowSourceError, match="TUSHARE_TOKEN"):
        TushareCapitalFlowSource.from_environment({})


def test_token_not_included_in_errors(fake_tushare_api):
    fake_tushare_api.dc_error = Exception("boom")
    fake_tushare_api.mf_error = Exception("boom2")
    source = TushareCapitalFlowSource(token="secret-token-xyz", api=fake_tushare_api)
    # Make moneyflow also fail so the error surfaces
    fake_tushare_api.mf_rows = None
    class _Boom:
        def __call__(self, **kw):
            raise Exception("mf boom")
    fake_tushare_api.moneyflow = _Boom()
    with pytest.raises(CapitalFlowSourceError) as exc:
        source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    assert "secret-token-xyz" not in str(exc.value)


def test_close_is_safe_noop(fake_tushare_api):
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    source.close()  # should not raise


def test_handles_empty_dataframe(fake_tushare_api):
    fake_tushare_api.dc_rows = []
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api)
    points = source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    assert points == []


def test_batches_large_security_lists(fake_tushare_api):
    # Tushare limits ~100 codes per call; verify the source chunks.
    many_codes = [f"600{i:03d}.XSHG" for i in range(250)]
    fake_tushare_api.dc_rows = []
    source = TushareCapitalFlowSource(token="tok", api=fake_tushare_api, batch_size=100)
    source.fetch_daily(date(2026, 6, 12), many_codes)
    # 250 codes / 100 per batch = 3 calls
    assert len(fake_tushare_api.dc_calls) == 3
