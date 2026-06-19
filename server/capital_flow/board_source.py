"""Concept-board membership source.

A Protocol decouples the registry generator from the Tushare SDK (tests inject
``FakeBoardSource``). ``TushareBoardSource`` is thin glue over ``tushare.pro_api``
calling ths_index / ths_member / daily_basic / daily / stock_basic; its real
behavior is validated at the user's preflight (``--list-boards``), while all
generator logic is tested against the fake.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Protocol

from .registry_builder import MemberBasic


@dataclass(frozen=True)
class BoardInfo:
    ts_code: str
    name: str
    member_count: int


class BoardMembershipSource(Protocol):
    def latest_trade_date(self) -> str: ...
    def list_boards(self) -> List[BoardInfo]: ...
    def board_members(self, board_ts_code: str) -> List[str]: ...
    def basics(self, trade_date: str) -> Dict[str, MemberBasic]: ...


class FakeBoardSource:
    """In-memory source for tests."""

    def __init__(self, latest, boards, members, basics):
        self._latest = latest
        self._boards = boards
        self._members = members
        self._basics = basics

    def latest_trade_date(self) -> str:
        return self._latest

    def list_boards(self) -> List[BoardInfo]:
        return list(self._boards)

    def board_members(self, board_ts_code: str) -> List[str]:
        return list(self._members.get(board_ts_code, []))

    def basics(self, trade_date: str) -> Dict[str, MemberBasic]:
        return dict(self._basics)


class TushareBoardSource:
    """Tushare adapter. Concept boards via ths_index(type='N'); members via
    ths_member; circ_mv via daily_basic; amount via daily; name/list_date via
    stock_basic (cached). Built the same way as TushareCapitalFlowSource."""

    def __init__(self, api):
        self._api = api
        self._stock_basic_cache: Dict[str, tuple] = {}

    @classmethod
    def from_environment(cls, env: dict) -> "TushareBoardSource":
        import tushare  # local import: SDK optional at test time
        token = (env.get("TUSHARE_TOKEN") or "").strip()
        if not token:
            raise RuntimeError("TUSHARE_TOKEN is required for board membership")
        return cls(tushare.pro_api(token))

    def latest_trade_date(self) -> str:
        df = self._api.trade_cal(
            exchange="SSE", is_open="1",
            end_date=__import__("datetime").date.today().strftime("%Y%m%d"),
        )
        return str(sorted(df["cal_date"].tolist())[-1])

    def list_boards(self) -> List[BoardInfo]:
        df = self._api.ths_index(exchange="A", type="N")  # N = 概念指数
        return [BoardInfo(ts_code=r["ts_code"], name=r["name"],
                          member_count=int(r.get("count") or 0))
                for _, r in df.iterrows()]

    def board_members(self, board_ts_code: str) -> List[str]:
        df = self._api.ths_member(ts_code=board_ts_code)
        return [r["con_code"] for _, r in df.iterrows()]

    def _load_stock_basic(self) -> None:
        if self._stock_basic_cache:
            return
        df = self._api.stock_basic(fields="ts_code,name,list_date")
        for _, r in df.iterrows():
            self._stock_basic_cache[r["ts_code"]] = (r["name"], str(r["list_date"]))

    def basics(self, trade_date: str) -> Dict[str, MemberBasic]:
        self._load_stock_basic()
        db = self._api.daily_basic(trade_date=trade_date, fields="ts_code,circ_mv")
        dy = self._api.daily(trade_date=trade_date, fields="ts_code,amount")
        amount_by = {r["ts_code"]: float(r["amount"] or 0) for _, r in dy.iterrows()}
        out: Dict[str, MemberBasic] = {}
        for _, r in db.iterrows():
            ts = r["ts_code"]
            name, list_date = self._stock_basic_cache.get(ts, ("", "19900101"))
            out[ts] = MemberBasic(
                ts_code=ts, name=name,
                circ_mv=float(r["circ_mv"] or 0),
                amount=amount_by.get(ts, 0.0),
                list_date=list_date,
            )
        return out
