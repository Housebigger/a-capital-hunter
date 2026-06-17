"""Capital flow data source protocol and the JQData adapter.

The protocol keeps the sync pipeline decoupled from any specific vendor SDK:
tests inject a fake, and future data sources (Tushare, etc.) can be added by
implementing the same four methods.

JQData reports ``net_amount_main`` in units of 万元 (ten-thousand CNY). The
adapter converts every value to CNY (yuan) at the boundary by multiplying by
``10_000``, so nothing downstream has to know the source unit.
"""

from __future__ import annotations

import math
from datetime import date, datetime
from typing import Any, List, Optional, Protocol, runtime_checkable

from .models import SourcePoint

#: Upstream unit is 万元; multiply by this to store CNY (yuan).
_TEN_THOUSAND = 10_000

#: Money-flow fields requested from JQData. Kept explicit so a future SDK
#: change that adds default columns cannot widen what we store.
_MONEY_FLOW_FIELDS = ["date", "sec_code", "net_amount_main"]


class CapitalFlowSourceError(RuntimeError):
    """Raised for any authentication, network, or parse failure.

    The message must never include credentials; adapters strip them before
    raising.
    """


@runtime_checkable
class CapitalFlowSource(Protocol):
    def latest_trade_date(self) -> date: ...

    def is_trade_date(self, trade_date: date) -> bool: ...

    def fetch_daily(
        self, trade_date: date, securities: List[str]
    ) -> List[SourcePoint]: ...

    def close(self) -> None: ...


def _is_usable_value(value: Any) -> bool:
    """True only for finite numeric values (not '-', None, or NaN)."""
    if value is None:
        return False
    if isinstance(value, str):
        if value.strip() in ("", "-"):
            return False
        try:
            value = float(value)
        except ValueError:
            return False
    try:
        f = float(value)
    except (TypeError, ValueError):
        return False
    return math.isfinite(f)


class JqDataCapitalFlowSource:
    """JQData-backed implementation of :class:`CapitalFlowSource`.

    Pass ``sdk`` to inject a fake for testing. In production the constructor
    lazily imports :mod:`jqdatasdk` so that simply importing this module does
    not require the SDK to be installed.
    """

    def __init__(
        self,
        username: str,
        password: str,
        sdk: Optional[Any] = None,
    ):
        if not username or not password:
            raise CapitalFlowSourceError(
                "JQDATA_USERNAME and JQDATA_PASSWORD must both be set"
            )
        self._username = username
        self._password = password
        self._sdk = sdk if sdk is not None else self._import_sdk()
        self._authed = False
        try:
            self._sdk.auth(username, password)
            self._authed = True
        except Exception as exc:  # noqa: BLE001 — wrap any SDK auth failure
            # Surface the server-side message (e.g. "用户不存在或密码错误") so
            # operators can act on it. The message is returned by JQData and
            # never contains the supplied credentials.
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"JQData authentication failed: {msg}"
            ) from exc

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    @staticmethod
    def _import_sdk():
        try:
            import jqdatasdk  # local import: SDK is optional at test time
        except ImportError as exc:
            raise CapitalFlowSourceError(
                "jqdatasdk is not installed; run pip install jqdatasdk"
            ) from exc
        return jqdatasdk

    @classmethod
    def from_environment(cls, env: dict, sdk: Optional[Any] = None):
        username = env.get("JQDATA_USERNAME")
        password = env.get("JQDATA_PASSWORD")
        if not username or not password:
            raise CapitalFlowSourceError(
                "JQDATA_USERNAME and JQDATA_PASSWORD must both be set in the environment"
            )
        return cls(username, password, sdk=sdk)

    # ------------------------------------------------------------------
    # Protocol
    # ------------------------------------------------------------------

    def _ensure_authed(self) -> None:
        if not self._authed:
            raise CapitalFlowSourceError("JQData source is not authenticated")

    def latest_trade_date(self) -> date:
        self._ensure_authed()
        try:
            days = self._sdk.get_trade_days(end_date=date.today(), count=1)
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"Failed to resolve latest trade date: {msg}"
            ) from exc
        if not days:
            raise CapitalFlowSourceError("JQData returned no trade days")
        return self._parse_date(days[-1])

    def is_trade_date(self, trade_date: date) -> bool:
        self._ensure_authed()
        try:
            days = self._sdk.get_trade_days(
                start_date=trade_date, end_date=trade_date
            )
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"Failed to query trade calendar: {msg}"
            ) from exc
        return bool(days)

    def fetch_daily(
        self, trade_date: date, securities: List[str]
    ) -> List[SourcePoint]:
        self._ensure_authed()
        try:
            df = self._sdk.get_money_flow(
                securities,
                start_date=trade_date,
                end_date=trade_date,
                fields=_MONEY_FLOW_FIELDS,
            )
        except Exception as exc:  # noqa: BLE001
            # Surface the server-side message (e.g. "今日查询额度已用完" or
            # "不支持该日期"). str(exc) comes from JQData, never from our
            # credentials — auth params are not echoed in SDK error messages.
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"JQData get_money_flow failed: {msg}"
            ) from exc
        return self._parse_frame(df, trade_date)

    def close(self) -> None:
        logout = getattr(self._sdk, "logout", None)
        if callable(logout):
            try:
                logout()
            except Exception:  # noqa: BLE001 — best-effort cleanup
                pass

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_date(raw) -> date:
        if isinstance(raw, date):
            return raw
        if isinstance(raw, datetime):
            return raw.date()
        if isinstance(raw, str):
            return datetime.strptime(raw, "%Y-%m-%d").date()
        raise CapitalFlowSourceError(f"Unrecognized date value: {raw!r}")

    def _parse_frame(self, df, trade_date: date) -> List[SourcePoint]:
        # An empty/None frame is a valid "no data" result, not an error.
        if df is None or len(df) == 0:
            return []

        points: List[SourcePoint] = []
        # Iterate by row to stay decoupled from pandas-specific iteration
        # styles; the frame is small (<= a few hundred rows per day).
        for _, row in df.iterrows():
            raw = row.get("net_amount_main")
            if not _is_usable_value(raw):
                continue
            code = row.get("sec_code")
            if not isinstance(code, str) or not code:
                continue
            points.append(
                SourcePoint(
                    security_code=code,
                    trade_date=trade_date,
                    net_amount_main=float(raw) * _TEN_THOUSAND,
                )
            )
        return points
