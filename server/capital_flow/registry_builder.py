"""Pure logic for regenerating the shared registries from concept-board members.

Zero SDK / IO: it consumes already-fetched ``MemberBasic`` rows and a board
mapping, and returns JSON-serializable registry entries. The Tushare access
lives in ``board_source.py``; this module is fully unit-testable with fakes.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List


@dataclass(frozen=True)
class MemberBasic:
    ts_code: str        # "300308.SZ"
    name: str           # "中际旭创"
    circ_mv: float      # free-float market cap, 万元 (ranking key)
    amount: float       # daily turnover, 千元 (liquidity floor; 0/None => suspended)
    list_date: str      # "YYYYMMDD"


def is_eligible(m: MemberBasic, ref_date: str, min_amount: float, min_listed_days: int) -> bool:
    """A member is representative-eligible if it is not ST, not suspended, not
    too newly listed, and meets the liquidity floor."""
    if "ST" in (m.name or "").upper():
        return False
    if not m.amount or m.amount <= 0:          # no turnover that day => suspended
        return False
    if not m.circ_mv or m.circ_mv <= 0:
        return False
    if m.amount < min_amount:
        return False
    try:
        listed = datetime.strptime(m.list_date, "%Y%m%d").date()
        ref = datetime.strptime(ref_date, "%Y%m%d").date()
    except (ValueError, TypeError):
        return False
    return (ref - listed).days >= min_listed_days


def rank_members(
    members: List[MemberBasic], ref_date: str, min_amount: float, min_listed_days: int
) -> List[MemberBasic]:
    """Eligible members, sorted by free-float market cap descending (ts_code tie-break)."""
    eligible = [m for m in members if is_eligible(m, ref_date, min_amount, min_listed_days)]
    return sorted(eligible, key=lambda m: (-m.circ_mv, m.ts_code))


def compute_order_index(mapping: List[dict]) -> Dict[str, int]:
    """Per-theme sequential displayOrder (1-based) keyed by subThemeId."""
    counts: Dict[str, int] = {}
    order: Dict[str, int] = {}
    for spec in mapping:
        theme = spec["themeId"]
        counts[theme] = counts.get(theme, 0) + 1
        order[spec["subThemeId"]] = counts[theme]
    return order


def assign_primary(
    ranked_by_sub: Dict[str, List[MemberBasic]],
    order_index: Dict[str, int],
    target_n: int,
) -> Dict[str, List[MemberBasic]]:
    """Assign each stock to exactly one sub-theme (its best-ranked board), filling
    each sub-theme up to ``target_n`` with the best available not-yet-taken stocks.

    Deterministic: candidates processed by (rank asc, displayOrder asc,
    subThemeId, ts_code). Guarantees no stock appears under two sub-themes.
    """
    candidates = []
    for sub_id, members in ranked_by_sub.items():
        do = order_index.get(sub_id, 0)
        for rank, m in enumerate(members):
            candidates.append((rank, do, sub_id, m))
    candidates.sort(key=lambda c: (c[0], c[1], c[2], c[3].ts_code))

    assigned: set = set()
    result: Dict[str, List[MemberBasic]] = {sub_id: [] for sub_id in ranked_by_sub}
    for rank, do, sub_id, m in candidates:
        if m.ts_code in assigned:
            continue
        if len(result[sub_id]) >= target_n:
            continue
        result[sub_id].append(m)
        assigned.add(m.ts_code)
    return result


def build_registries(mapping: List[dict], assignments: Dict[str, List[MemberBasic]]):
    """Return (sub_theme_entries, stock_entries) as JSON-serializable dicts."""
    order_index = compute_order_index(mapping)
    sub_entries: List[dict] = []
    stock_entries: List[dict] = []
    for spec in mapping:
        sub_id = spec["subThemeId"]
        sub_entries.append({
            "id": sub_id,
            "name": spec["name"],
            "shortName": spec["shortName"],
            "themeId": spec["themeId"],
            "displayOrder": order_index[sub_id],
            # themeId is a valid SectorId for all 11 themes; the mapping may
            # override with a finer sector during curation review.
            "primarySectorId": spec.get("primarySectorId", spec["themeId"]),
            "areaWeight": 0.8,   # SP2 will drive this from live market heat
        })
        for m in assignments.get(sub_id, []):
            code = m.ts_code.split(".")[0]
            stock_entries.append({
                "id": f"s-{code}",
                "name": m.name,
                "shortName": m.name,
                "subThemeId": sub_id,
                "code": code,
            })
    return sub_entries, stock_entries
