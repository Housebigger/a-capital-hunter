from pathlib import Path
from datetime import date
import pytest


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


@pytest.fixture
def tmp_db_path(tmp_path) -> Path:
    return tmp_path / "capital_flow.sqlite3"


class FakeTushareApi:
    """In-memory stand-in for tushare.pro_api used by source tests.

    The real ``pro_api`` is constructed via ``tushare.pro_api(token)`` and
    exposes one method per interface (``moneyflow_dc``, ``moneyflow``,
    ``trade_cal``). The fake records every call so tests can assert args and
    scripted responses / errors.
    """

    def __init__(self):
        self.dc_rows = []          # rows returned by moneyflow_dc
        self.mf_rows = []          # rows returned by moneyflow
        self.dc_error = None       # if set, moneyflow_dc raises
        self.trade_cal_dates = ["20260612"]
        self.dc_calls = []
        self.mf_calls = []

    def moneyflow_dc(self, **kwargs):
        self.dc_calls.append(kwargs)
        if self.dc_error:
            raise self.dc_error
        import pandas as pd
        return pd.DataFrame(self.dc_rows)

    def moneyflow(self, **kwargs):
        self.mf_calls.append(kwargs)
        import pandas as pd
        return pd.DataFrame(self.mf_rows)

    def trade_cal(self, **kwargs):
        import pandas as pd
        dates = list(self.trade_cal_dates)
        start = kwargs.get("start_date")
        end = kwargs.get("end_date")
        if start:
            dates = [d for d in dates if d >= start]
        if end:
            dates = [d for d in dates if d <= end]
        # When the caller asks for a specific window, only return rows that
        # actually fall in it — otherwise is_trade_date tests can't distinguish
        # open from closed days.
        limit = kwargs.get("limit")
        if limit:
            dates = dates[-limit:]
        return pd.DataFrame(
            {"cal_date": dates, "is_open": [1] * len(dates)}
        )


@pytest.fixture
def fake_tushare_api():
    return FakeTushareApi()


class FakeJqSdk:
    """In-memory stand-in for jqdatasdk used by source tests.

    Implements only the methods the adapter calls. The default money-flow
    table returns one valid row (1234.56 万元 = 12,345,600 CNY) per requested
    security so tests can assert the unit conversion without network access.
    """

    def __init__(self):
        self.authed = False
        self.logged_out = False
        self.username = None
        self.password = None
        self.trade_days = ["2026-06-12"]
        self.security_codes = ["300308.XSHE", "688111.XSHG"]
        self.money_flow_fields = ["date", "sec_code", "net_amount_main"]
        # default: 1234.56 万元 per security
        self.money_flow_values = [1234.56, 1234.56]
        self.last_money_flow_args = None

    def auth(self, username, password):
        self.authed = True
        self.username = username
        self.password = password

    def logout(self):
        self.logged_out = True

    def get_trade_days(self, start_date=None, end_date=None, count=None):
        if count is not None:
            return self.trade_days[-count:]
        if start_date and end_date:
            d = str(start_date)
            return [d] if d in self.trade_days else []
        return self.trade_days

    def get_money_flow(self, securities, start_date, end_date, fields=None):
        self.last_money_flow_args = {
            "securities": list(securities),
            "start_date": start_date,
            "end_date": end_date,
            "fields": list(fields) if fields else None,
        }
        import pandas as pd  # local import keeps pandas out of collection

        rows = []
        for i, code in enumerate(securities):
            value = self.money_flow_values[i] if i < len(self.money_flow_values) else 1234.56
            rows.append(
                {
                    "date": str(start_date),
                    "sec_code": code,
                    "net_amount_main": value,
                }
            )
        return pd.DataFrame(rows, columns=self.money_flow_fields)


@pytest.fixture
def fake_sdk():
    return FakeJqSdk()

