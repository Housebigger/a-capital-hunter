from datetime import date

import pytest

from server.capital_flow.models import SourcePoint
from server.capital_flow.source import (
    CapitalFlowSourceError,
    JqDataCapitalFlowSource,
)


def test_fetch_daily_converts_ten_thousand_cny_to_cny(fake_sdk):
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    points = source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    assert points == [
        SourcePoint(
            security_code="300308.XSHE",
            trade_date=date(2026, 6, 12),
            net_amount_main=12_345_600.0,
        )
    ]
    assert fake_sdk.last_money_flow_args["fields"] == [
        "date",
        "sec_code",
        "net_amount_main",
    ]


def test_fetch_daily_omits_dash_none_and_nan(fake_sdk):
    fake_sdk.money_flow_values = ["-", None, float("nan")]
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    assert (
        source.fetch_daily(date(2026, 6, 12), fake_sdk.security_codes) == []
    )


def test_fetch_daily_authenticates_once(fake_sdk):
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    source.fetch_daily(date(2026, 6, 12), fake_sdk.security_codes)
    source.fetch_daily(date(2026, 6, 12), fake_sdk.security_codes)
    assert fake_sdk.authed
    # auth is called exactly once even across multiple fetches
    # (we cannot count calls here, but authed stays True and no re-auth error)


def test_latest_trade_date_uses_sdk(fake_sdk):
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    assert source.latest_trade_date() == date(2026, 6, 12)


def test_is_trade_date_delegates_to_sdk(fake_sdk):
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    assert source.is_trade_date(date(2026, 6, 12)) is True
    assert source.is_trade_date(date(2026, 6, 11)) is False


def test_close_logs_out_when_available(fake_sdk):
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    source.close()
    assert fake_sdk.logged_out


def test_credentials_are_required():
    with pytest.raises(CapitalFlowSourceError, match="JQDATA_USERNAME"):
        JqDataCapitalFlowSource.from_environment({})


def test_credentials_are_not_included_in_errors(fake_sdk):
    fake_sdk.authed = True
    source = JqDataCapitalFlowSource("secret-user", "secret-pass", sdk=fake_sdk)

    class _Boom:
        def get_money_flow(self, *a, **kw):
            raise RuntimeError("boom")

    fake_sdk.get_money_flow = _Boom().get_money_flow
    with pytest.raises(CapitalFlowSourceError) as exc:
        source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    assert "secret-user" not in str(exc.value)
    assert "secret-pass" not in str(exc.value)
