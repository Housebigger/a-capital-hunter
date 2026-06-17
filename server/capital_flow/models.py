"""Immutable pipeline records and snapshot status literals.

All records are frozen dataclasses so pipeline stages can be passed around
without defensive copies. Literal types document the closed status sets used
by both the repository and the API layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import List, Literal, Optional


# ---------------------------------------------------------------------------
# Status literals
# ---------------------------------------------------------------------------

#: Snapshot aggregation outcome. ``ready`` requires >= 90% coverage,
#: ``partial`` covers the 0% < x < 90% band with at least one usable point.
SnapshotStatus = Literal["ready", "partial", "failed"]

#: Role of a stock mapping inside aggregation. Only ``primary`` mappings
#: contribute to P1/P2 totals; ``related`` mappings stay available for P3
#: display but are never double-counted.
AggregationRole = Literal["primary", "related"]

#: Reasons recorded when a registry entry or source row cannot enter a snapshot.
#: Kept as a plain string in the API contract so the set can grow without
#: breaking frontend parsing.
RegistryFailureReason = Literal[
    "unsupported_or_placeholder_code",
    "missing_source_row",
]


# ---------------------------------------------------------------------------
# Registry records
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class StockMapping:
    """One display mapping of a security to a sub-theme.

    A security that appears in multiple sub-themes produces one ``primary``
    mapping (first occurrence in the shared registry) and N ``related``
    mappings. Aggregation sums only primary mappings so totals are stable.
    """

    stock_id: str
    stock_name: str
    short_name: str
    raw_code: str
    security_code: str
    sub_theme_id: str
    theme_id: str
    aggregation_role: AggregationRole


@dataclass(frozen=True)
class RegistryFailure:
    reason: RegistryFailureReason
    raw_code: Optional[str] = None
    stock_id: Optional[str] = None


@dataclass(frozen=True)
class RegistryResult:
    """Loaded and normalized registry.

    ``securities`` is de-duplicated by normalized security code; ``mappings``
    preserves every display mapping so the frontend can still show a stock
    under each of its sub-themes.
    """

    securities: List["Security"] = field(default_factory=list)
    mappings: List[StockMapping] = field(default_factory=list)
    failures: List[RegistryFailure] = field(default_factory=list)


@dataclass(frozen=True)
class Security:
    """A single normalized, de-duplicated tradeable security."""

    security_code: str
    stock_name: str
    short_name: str


# ---------------------------------------------------------------------------
# Source records
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SourcePoint:
    """One normalized money-flow observation from a data source.

    ``net_amount_main`` is always in CNY (yuan). Source adapters convert the
    upstream unit (JQData reports ten-thousand CNY) at the boundary.
    """

    security_code: str
    trade_date: date
    net_amount_main: float


# ---------------------------------------------------------------------------
# Snapshot draft records (service -> repository boundary)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SnapshotFailure:
    reason: RegistryFailureReason
    security_code: Optional[str] = None
    stock_id: Optional[str] = None


@dataclass(frozen=True)
class SnapshotDraft:
    """Validated snapshot ready to persist.

    Aggregation invariants (P1 == P2 == unique P3 within 0.01 CNY) are checked
    before this record is constructed, so any persisted draft is internally
    consistent.
    """

    trade_date: date
    fetched_at: str
    source: str
    metric: str
    unit: str
    status: SnapshotStatus
    requested: int
    succeeded: int
    failed: int
    points: List[SourcePoint]
    mappings: List[StockMapping]
    failures: List[SnapshotFailure]
    theme_totals: dict
    sub_theme_totals: dict
