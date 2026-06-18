"""Pure rolling-window aggregation over daily capital-flow snapshots.

Each window snapshot sums per-stock daily net_amount_main across the latest N
trading days, anchored at the newest day. Output mirrors the repository's
``_expand`` dict shape plus a ``window`` metadata block.
"""

from __future__ import annotations

from datetime import date
from typing import List

#: window query key -> (trading-day count, Chinese label)
WINDOW_SPECS = {
    "1d": (1, "今日"),
    "5d": (5, "近5日"),
    "10d": (10, "近10日"),
    "20d": (20, "近20日"),
}

#: Max calendar-day gap between two consecutive stored trade dates that still
#: counts as "contiguous". Covers the longest A-share market closure (Spring
#: Festival ≈ 11 calendar days between adjacent trading days) with margin. A
#: larger gap is treated as a data hole that BOUNDS the window — so a sparse
#: store can never let "近5日" silently reach months into the past.
MAX_TRADING_GAP_DAYS = 14


def select_window_dates(dates_desc: List[str], requested_days: int) -> List[str]:
    """Pick the anchored run of contiguous trading days for a window.

    ``dates_desc`` are stored trade dates (ISO ``YYYY-MM-DD``) newest-first.
    Returns at most ``requested_days`` of them, starting at the newest, and
    stops as soon as the gap to the previously-accepted day exceeds
    :data:`MAX_TRADING_GAP_DAYS`. Such a hole means the older snapshot is stale,
    not part of the recent window, so excluding it keeps the window label
    ("近5日") honest about the span it actually covers.
    """
    chosen: List[str] = []
    prev: date | None = None
    for ds in dates_desc[:requested_days]:
        d = date.fromisoformat(ds)
        if prev is not None and (prev - d).days > MAX_TRADING_GAP_DAYS:
            break
        chosen.append(ds)
        prev = d
    return chosen


def aggregate_window(snapshots: List[dict], requested_days: int, label: str) -> dict:
    """Sum points across ``snapshots`` (DESC by tradeDate, index 0 = anchor).

    ``snapshots`` must be non-empty. Each point is keyed by ``stockId``; the
    first (newest) occurrence supplies display metadata, later days add to its
    ``netAmountMain``. Every output point is stamped with the anchor tradeDate.
    """
    anchor = snapshots[0]
    to = anchor["tradeDate"]
    frm = snapshots[-1]["tradeDate"]

    merged: dict = {}
    order: list = []
    for snap in snapshots:  # anchor first → first-seen keeps newest metadata
        for p in snap["points"]:
            sid = p["stockId"]
            if sid in merged:
                merged[sid]["netAmountMain"] += p["netAmountMain"]
            else:
                merged[sid] = {**p, "tradeDate": to}
                order.append(sid)

    return {
        "tradeDate": to,
        "fetchedAt": anchor["fetchedAt"],
        "source": anchor["source"],
        "metric": anchor["metric"],
        "unit": anchor["unit"],
        # status reflects the WORST constituent day (any partial → the window is
        # partial), so a multi-day window touching a partial day is honestly
        # flagged. coverage stays the anchor (newest) day's breadth.
        "status": "partial" if any(s["status"] == "partial" for s in snapshots) else anchor["status"],
        "coverage": anchor["coverage"],
        "points": [merged[sid] for sid in order],
        "failures": anchor["failures"],
        "window": {
            "days": requested_days,
            "label": label,
            "from": frm,
            "to": to,
            "availableDays": len(snapshots),
        },
    }
