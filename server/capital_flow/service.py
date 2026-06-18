"""Sync orchestration: registry + source + repository -> validated snapshot.

The service is the single place that knows the full pipeline shape. It keeps
JQData calls out of the request path: the CLI (``sync.py``) invokes this once
per day, and the Flask API only reads what the repository already stores.

Coverage rule: ``succeeded / requested >= 0.9`` → ``ready``; any positive
``succeeded`` below that → ``partial``; zero usable points → raise
``SnapshotSyncError`` and never touch the repository, so a bad day cannot
overwrite a good prior snapshot.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from .models import (
    RegistryResult,
    SnapshotDraft,
    SnapshotFailure,
    SnapshotStatus,
    SourcePoint,
    StockMapping,
)
from .registry import load_registry
from .repository import SnapshotRepository
from .source import CapitalFlowSource, CapitalFlowSourceError

#: Ready coverage threshold (inclusive).
READY_COVERAGE = 0.9

#: Tolerance for the P1 == P2 == P3 aggregation invariant, in CNY.
AGGREGATION_TOLERANCE = 0.01

#: How many recent trading days to try when ``latest`` has no data yet.
#: Money flow is an end-of-day dataset, so a sync run before/around market
#: close legitimately finds no data for today; walking back 5 days covers a
#: long weekend plus the prior close.
LATEST_FALLBACK_DAYS = 5


class SnapshotSyncError(RuntimeError):
    """Raised when a sync cannot produce a usable snapshot."""


def _parse_trade_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


class CapitalFlowSyncService:
    def __init__(
        self,
        source: CapitalFlowSource,
        repository: SnapshotRepository,
        registry_root,
    ):
        self._source = source
        self._repository = repository
        self._registry_root = registry_root

    def sync(self, trade_date_spec: str) -> SnapshotDraft:
        """Run one sync. ``trade_date_spec`` is ``"latest"`` or ``YYYY-MM-DD``.

        For ``"latest"``, if the most recent trading day has no money-flow
        data yet (common before/around market close, since money flow is an
        end-of-day dataset), the syncer automatically retries the previous
        few trading days until it finds data — so a morning run still
        produces a usable snapshot from the prior close.
        """
        registry = load_registry(self._registry_root)
        try:
            if trade_date_spec == "latest":
                draft = self._sync_latest_with_fallback(registry)
            else:
                trade_date = self._resolve_trade_date(trade_date_spec)
                draft = self._build_draft(trade_date, registry)
        finally:
            self._source.close()
        # Persist only after every invariant passes.
        self._repository.save_snapshot(draft)
        return draft

    def sync_backfill(self, count: int) -> list:
        """Attempt the latest ``count`` trading days; persist each that has data.

        Keeps the source open across all days (unlike :meth:`sync`, which closes
        per call) and never aborts the run on a single empty day — it records the
        skip and continues, so one missing day cannot block the backfill.
        """
        registry = load_registry(self._registry_root)
        results: list = []
        try:
            trade_date = self._source.latest_trade_date()
            for _ in range(count):
                if trade_date is None:
                    break
                try:
                    draft = self._build_draft(trade_date, registry)
                    self._repository.save_snapshot(draft)
                    results.append({"tradeDate": trade_date.isoformat(),
                                    "status": draft.status, "error": None})
                except SnapshotSyncError as exc:
                    results.append({"tradeDate": trade_date.isoformat(),
                                    "status": None, "error": str(exc)})
                trade_date = self._previous_trade_date(trade_date)
        finally:
            self._source.close()
        return results

    def _sync_latest_with_fallback(self, registry: RegistryResult) -> SnapshotDraft:
        """Try the latest trade date; on 'no usable points', walk back up to
        :data:`LATEST_FALLBACK_DAYS` days until data is found."""
        trade_date = self._source.latest_trade_date()
        last_error: Optional[Exception] = None
        for attempt in range(LATEST_FALLBACK_DAYS):
            try:
                return self._build_draft(trade_date, registry)
            except SnapshotSyncError as exc:
                last_error = exc
                trade_date = self._previous_trade_date(trade_date)
                if trade_date is None:
                    break
        # Every fallback exhausted — surface the original error.
        raise last_error or SnapshotSyncError(
            "no usable capital flow points in the last "
            f"{LATEST_FALLBACK_DAYS} trading days"
        )

    def _previous_trade_date(self, trade_date: date) -> Optional[date]:
        """Return the trading day strictly before ``trade_date``.

        Walks back calendar days one at a time and asks the source's calendar
        whether each is a trading day. Capped at 10 calendar days to bound cost
        (no 10-calendar-day window contains zero trading days).
        """
        probe = trade_date - timedelta(days=1)
        for _ in range(10):
            if self._source.is_trade_date(probe):
                return probe
            probe -= timedelta(days=1)
        return None

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    def _resolve_trade_date(self, spec: str) -> date:
        if spec == "latest":
            return self._source.latest_trade_date()
        candidate = _parse_trade_date(spec)
        if not self._source.is_trade_date(candidate):
            raise CapitalFlowSourceError(
                f"{spec} is not a JQData trade date for this account"
            )
        return candidate

    def _build_draft(
        self, trade_date: date, registry: RegistryResult
    ) -> SnapshotDraft:
        securities = [s.security_code for s in registry.securities]
        # One batch fetch for the whole universe.
        points_by_code = {
            p.security_code: p
            for p in self._source.fetch_daily(trade_date, securities)
        }

        requested = len(securities)
        if requested == 0:
            raise SnapshotSyncError("registry has no supported securities")

        succeeded_points: list = []
        failures: list = []
        for sec in registry.securities:
            point = points_by_code.get(sec.security_code)
            if point is None:
                failures.append(
                    SnapshotFailure(
                        reason="missing_source_row",
                        security_code=sec.security_code,
                    )
                )
            else:
                succeeded_points.append(point)

        if not succeeded_points:
            raise SnapshotSyncError(
                f"no usable capital flow points for {trade_date} "
                f"(data may not be available yet — money flow updates after "
                f"market close; try a past trading day)"
            )

        # Pre-filtered unsupported codes are reported but excluded from the
        # coverage denominator, matching the design's definition of "requested".
        for rf in registry.failures:
            failures.append(
                SnapshotFailure(
                    reason=rf.reason,
                    security_code=None,
                    stock_id=rf.stock_id,
                )
            )

        succeeded = len(succeeded_points)
        coverage = succeeded / requested
        status: SnapshotStatus = "ready" if coverage >= READY_COVERAGE else "partial"

        theme_totals, sub_theme_totals = self._aggregate(
            succeeded_points, registry
        )

        self._assert_invariants(
            succeeded_points, theme_totals, sub_theme_totals
        )

        # Mappings carried into storage: all display mappings (primary +
        # related) so the frontend can render a security under each sub-theme.
        mappings = [self._to_storage_mapping(m) for m in registry.mappings]

        return SnapshotDraft(
            trade_date=trade_date,
            fetched_at=datetime.now(timezone.utc).isoformat(),
            source=self._source_name(),
            metric="net_amount_main",
            unit="CNY",
            status=status,
            requested=requested,
            succeeded=succeeded,
            failed=len(failures),
            points=list(succeeded_points),
            mappings=mappings,
            failures=failures,
            theme_totals=theme_totals,
            sub_theme_totals=sub_theme_totals,
        )

    def _aggregate(self, points, registry: RegistryResult):
        """Sum primary mappings into P2 (sub-theme) and P1 (theme) totals.

        Related mappings are intentionally excluded so a security listed under
        two sub-themes contributes its capital exactly once.
        """
        point_by_code = {p.security_code: p for p in points}
        # index primary mappings by security code for O(1) lookup
        primary_by_code = {
            m.security_code: m
            for m in registry.mappings
            if m.aggregation_role == "primary"
        }
        theme_totals: dict = {}
        sub_theme_totals: dict = {}
        for code, point in point_by_code.items():
            mapping = primary_by_code.get(code)
            if mapping is None:
                continue
            sub_theme_totals[mapping.sub_theme_id] = (
                sub_theme_totals.get(mapping.sub_theme_id, 0.0)
                + point.net_amount_main
            )
            theme_totals[mapping.theme_id] = (
                theme_totals.get(mapping.theme_id, 0.0)
                + point.net_amount_main
            )
        return theme_totals, sub_theme_totals

    @staticmethod
    def _assert_invariants(points, theme_totals, sub_theme_totals) -> None:
        unique_total = sum(p.net_amount_main for p in points)
        theme_sum = sum(theme_totals.values())
        sub_sum = sum(sub_theme_totals.values())
        assert (
            abs(theme_sum - unique_total) < AGGREGATION_TOLERANCE
        ), f"theme total {theme_sum} != unique total {unique_total}"
        assert (
            abs(sub_sum - unique_total) < AGGREGATION_TOLERANCE
        ), f"sub-theme total {sub_sum} != unique total {unique_total}"

    def _source_name(self) -> str:
        """Identify which adapter produced this snapshot.

        Reads an optional ``name`` attribute from the source so the stored
        snapshot honestly reports its origin (``tushare`` vs ``jqdata``).
        Falls back to ``tushare`` (the configured default source) for sources
        that don't set a name.
        """
        return getattr(self._source, "name", None) or "tushare"

    @staticmethod
    def _to_storage_mapping(m: StockMapping) -> StockMapping:
        # Pass through; kept as a hook in case future fields need reshaping.
        return m
