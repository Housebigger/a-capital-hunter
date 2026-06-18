"""Pure rolling-window aggregation over daily capital-flow snapshots.

Each window snapshot sums per-stock daily net_amount_main across the latest N
trading days, anchored at the newest day. Output mirrors the repository's
``_expand`` dict shape plus a ``window`` metadata block.
"""

from __future__ import annotations

from typing import List

#: window query key -> (trading-day count, Chinese label)
WINDOW_SPECS = {
    "1d": (1, "今日"),
    "5d": (5, "近5日"),
    "10d": (10, "近10日"),
    "20d": (20, "近20日"),
}


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
        "status": anchor["status"],
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
