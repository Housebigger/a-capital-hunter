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

    #: Identifier recorded on snapshots so the UI can honestly report origin.
    name = "jqdata"

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


# ---------------------------------------------------------------------------
# Tushare adapter
# ---------------------------------------------------------------------------

#: Tushare caps the number of securities per money-flow call. Keep batches
#: well under the server limit to avoid partial-response surprises.
_TUSHARE_DEFAULT_BATCH = 90

#: Permission-denied substring patterns returned by Tushare when the account
#: lacks the 5000-point entitlement for moneyflow_dc. Used to trigger the
#: automatic degrade to moneyflow (2000 points).
_DC_PERMISSION_HINTS = ("权限", "积分不足", "访问该接口", "最多访问")


def _jq_to_tushare_code(jq_code: str) -> str:
    """Convert our internal JQData-style code to Tushare's .SZ/.SH suffix."""
    if jq_code.endswith(".XSHE"):
        return jq_code[: -len(".XSHE")] + ".SZ"
    if jq_code.endswith(".XSHG"):
        return jq_code[: -len(".XSHG")] + ".SH"
    # Already in tushare format or unknown — pass through.
    return jq_code


def _tushare_to_jq_code(ts_code: str) -> str:
    """Convert a Tushare code back to our internal JQData-style format."""
    if ts_code.endswith(".SZ"):
        return ts_code[: -len(".SZ")] + ".XSHE"
    if ts_code.endswith(".SH"):
        return ts_code[: -len(".SH")] + ".XSHG"
    return ts_code


def _is_dc_permission_error(exc: Exception) -> bool:
    """True when ``exc`` looks like a Tushare entitlement/permission failure."""
    msg = str(exc)
    return any(hint in msg for hint in _DC_PERMISSION_HINTS)


class TushareCapitalFlowSource:
    """Tushare-backed implementation of :class:`CapitalFlowSource`.

    Primary path: ``moneyflow_dc`` (5000 points) returns ``net_amount`` =
    main-force net inflow directly, in 万元.

    Fallback path: if the account lacks the 5000-point entitlement, the source
    degrades to ``moneyflow`` (2000 points) and computes main-force net inflow
    as ``(buy_elg - sell_elg) + (buy_lg - sell_lg)`` (super-large + large
    orders), in 万元.

    Either way the value is converted to CNY (yuan) at the boundary, matching
    the JQData source so downstream code is source-agnostic.
    """

    #: Identifier recorded on snapshots so the UI can honestly report origin.
    name = "tushare"

    def __init__(
        self,
        token: str,
        api: Optional[Any] = None,
        batch_size: int = _TUSHARE_DEFAULT_BATCH,
    ):
        if not token:
            raise CapitalFlowSourceError(
                "TUSHARE_TOKEN must be set (get one at https://tushare.pro)"
            )
        self._token = token
        self._batch_size = batch_size
        self._api = api if api is not None else self._import_api(token)
        # Once moneyflow_dc fails with a permission error, remember it so we
        # don't retry the privileged call for every subsequent batch.
        self._use_moneyflow_only = False

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    @staticmethod
    def _import_api(token: str):
        try:
            import tushare  # local import: SDK is optional at test time
        except ImportError as exc:
            raise CapitalFlowSourceError(
                "tushare is not installed; run pip install tushare"
            ) from exc
        return tushare.pro_api(token)

    @classmethod
    def from_environment(cls, env: dict, api: Optional[Any] = None):
        token = env.get("TUSHARE_TOKEN")
        if not token:
            raise CapitalFlowSourceError(
                "TUSHARE_TOKEN must be set in the environment"
            )
        return cls(token, api=api)

    # ------------------------------------------------------------------
    # Protocol
    # ------------------------------------------------------------------

    def latest_trade_date(self) -> date:
        try:
            df = self._api.trade_cal(
                exchange="SSE",
                end_date=date.today().strftime("%Y%m%d"),
                limit=1,
                is_open="1",
            )
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"Tushare trade_cal failed: {msg}"
            ) from exc
        if df is None or len(df) == 0:
            raise CapitalFlowSourceError("Tushare returned no trade calendar")
        return self._parse_yyyymmdd(df.iloc[-1]["cal_date"])

    def is_trade_date(self, trade_date: date) -> bool:
        yyyymmdd = trade_date.strftime("%Y%m%d")
        try:
            df = self._api.trade_cal(
                exchange="SSE",
                start_date=yyyymmdd,
                end_date=yyyymmdd,
            )
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"Tushare trade_cal failed: {msg}"
            ) from exc
        if df is None or len(df) == 0:
            return False
        return int(df.iloc[0]["is_open"]) == 1

    def fetch_daily(
        self, trade_date: date, securities: List[str]
    ) -> List[SourcePoint]:
        """Fetch main-force net inflow for one trade date.

        ``securities`` are in our internal JQData-style format
        (``300308.XSHE``); they are converted to Tushare format internally and
        the returned points carry the original format.
        """
        if not securities:
            return []

        yyyymmdd = trade_date.strftime("%Y%m%d")
        # Map our codes -> tushare codes, and remember the reverse mapping so
        # we can translate the response back.
        ts_to_jq = {}
        tushare_codes = []
        for jq_code in securities:
            ts_code = _jq_to_tushare_code(jq_code)
            ts_to_jq[ts_code] = jq_code
            tushare_codes.append(ts_code)

        all_points: List[SourcePoint] = []
        for i in range(0, len(tushare_codes), self._batch_size):
            batch = tushare_codes[i : i + self._batch_size]
            points = self._fetch_batch(batch, yyyymmdd, ts_to_jq, trade_date)
            all_points.extend(points)
        return all_points

    def _fetch_batch(
        self,
        tushare_codes: List[str],
        yyyymmdd: str,
        ts_to_jq: dict,
        trade_date: date,
    ) -> List[SourcePoint]:
        # Try the privileged direct interface first (unless we already know we
        # can't use it).
        if not self._use_moneyflow_only:
            try:
                df = self._api.moneyflow_dc(
                    ts_code=",".join(tushare_codes),
                    trade_date=yyyymmdd,
                    fields="ts_code,trade_date,net_amount",
                )
                return self._parse_dc_frame(df, ts_to_jq, trade_date)
            except Exception as exc:  # noqa: BLE001
                if _is_dc_permission_error(exc):
                    # Permanently degrade: every batch and future sync uses the
                    # lower-entitlement interface.
                    self._use_moneyflow_only = True
                else:
                    msg = str(exc).strip() or type(exc).__name__
                    raise CapitalFlowSourceError(
                        f"Tushare moneyflow_dc failed: {msg}"
                    ) from exc
        # Fallback: compute main force from buy/sell components.
        try:
            df = self._api.moneyflow(
                ts_code=",".join(tushare_codes),
                trade_date=yyyymmdd,
                fields=(
                    "ts_code,trade_date,"
                    "buy_elg_amount,sell_elg_amount,"
                    "buy_lg_amount,sell_lg_amount"
                ),
            )
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).strip() or type(exc).__name__
            raise CapitalFlowSourceError(
                f"Tushare moneyflow failed: {msg}"
            ) from exc
        return self._parse_mf_frame(df, ts_to_jq, trade_date)

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_yyyymmdd(raw) -> date:
        if isinstance(raw, date):
            return raw
        return datetime.strptime(str(raw), "%Y%m%d").date()

    def _parse_dc_frame(self, df, ts_to_jq, trade_date) -> List[SourcePoint]:
        if df is None or len(df) == 0:
            return []
        points: List[SourcePoint] = []
        for _, row in df.iterrows():
            raw = row.get("net_amount")
            if not _is_usable_value(raw):
                continue
            ts_code = row.get("ts_code")
            jq_code = ts_to_jq.get(ts_code) if isinstance(ts_code, str) else None
            if jq_code is None:
                continue
            points.append(
                SourcePoint(
                    security_code=jq_code,
                    trade_date=trade_date,
                    net_amount_main=float(raw) * _TEN_THOUSAND,
                )
            )
        return points

    def _parse_mf_frame(self, df, ts_to_jq, trade_date) -> List[SourcePoint]:
        if df is None or len(df) == 0:
            return []
        points: List[SourcePoint] = []
        for _, row in df.iterrows():
            # main force = (super-large net) + (large net), in 万元
            buy_elg = row.get("buy_elg_amount")
            sell_elg = row.get("sell_elg_amount")
            buy_lg = row.get("buy_lg_amount")
            sell_lg = row.get("sell_lg_amount")
            if not all(
                _is_usable_value(v)
                for v in (buy_elg, sell_elg, buy_lg, sell_lg)
            ):
                continue
            ts_code = row.get("ts_code")
            jq_code = ts_to_jq.get(ts_code) if isinstance(ts_code, str) else None
            if jq_code is None:
                continue
            main_wan = (
                (float(buy_elg) - float(sell_elg))
                + (float(buy_lg) - float(sell_lg))
            )
            points.append(
                SourcePoint(
                    security_code=jq_code,
                    trade_date=trade_date,
                    net_amount_main=main_wan * _TEN_THOUSAND,
                )
            )
        return points

    def close(self) -> None:
        # Tushare's SDK has no explicit logout; connection is stateless HTTP.
        pass
