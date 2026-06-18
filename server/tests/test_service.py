from datetime import date
from pathlib import Path

import pytest

from server.capital_flow.models import SourcePoint
from server.capital_flow.repository import SnapshotRepository
from server.capital_flow.service import (
    CapitalFlowSyncService,
    SnapshotSyncError,
)
from server.capital_flow.source import CapitalFlowSourceError


class _ScriptedSource:
    """Test double for CapitalFlowSource.

    Returns one point per security listed in ``succeeding_codes``; every other
    requested security is treated as missing by the service because it never
    appears in the returned frame.
    """

    def __init__(self, succeeding_codes):
        self._succeeding = list(succeeding_codes)
        self.requested: list = []

    def latest_trade_date(self) -> date:
        return date(2026, 6, 12)

    def is_trade_date(self, trade_date: date) -> bool:
        return trade_date == date(2026, 6, 12)

    def fetch_daily(self, trade_date, securities):
        self.requested = list(securities)
        return [
            SourcePoint(security_code=c, trade_date=trade_date, net_amount_main=1_000_000.0)
            for c in securities
            if c in self._succeeding
        ]

    def close(self):
        pass


class ServiceFixture:
    """Builds a small controlled registry and service for service tests.

    The registry has 10 unique securities, one of which (688111) has two
    display mappings — matching the production duplicate pattern. The fake
    source returns points for the first ``succeeding_count`` securities.
    """

    def __init__(self, tmp_path: Path):
        self.tmp_path = tmp_path
        self.registry_dir = tmp_path / "src" / "data"
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        # 10 unique securities; 688111 appears twice (primary + related)
        securities = [
            ("s1", "名1", "n1", "300308", "300308.XSHE", "st-a", "t-a"),
            ("s2", "名2", "n2", "600519", "600519.XSHG", "st-a", "t-a"),
            ("s3", "名3", "n3", "000001", "000001.XSHE", "st-b", "t-b"),
            ("s4", "名4", "n4", "002594", "002594.XSHE", "st-b", "t-b"),
            ("s5", "名5", "n5", "688111", "688111.XSHG", "st-c", "t-c"),
            ("s6", "名6", "n6", "601318", "601318.XSHG", "st-c", "t-c"),
            ("s7", "名7", "n7", "603986", "603986.XSHG", "st-d", "t-d"),
            ("s8", "名8", "n8", "300750", "300750.XSHE", "st-d", "t-d"),
            ("s9", "名9", "n9", "002475", "002475.XSHE", "st-e", "t-e"),
            ("s10", "名10", "n10", "600276", "600276.XSHG", "st-e", "t-e"),
        ]
        # add the duplicate mapping for 688111 (related, different sub-theme)
        stocks_json = [
            {"id": sid, "name": nm, "shortName": sn, "subThemeId": st, "code": code}
            for (sid, nm, sn, code, _sec, st, _t) in securities
        ]
        # Second mapping for 688111 under a different sub-theme
        stocks_json.append(
            {"id": "s5b", "name": "名5b", "shortName": "n5b", "subThemeId": "st-c2", "code": "688111"}
        )
        (self.registry_dir / "stockRegistry.json").write_text(
            __import__("json").dumps(stocks_json, ensure_ascii=False)
        )
        sub_themes = []
        seen_themes = {}
        for (_sid, _nm, _sn, _code, _sec, st, t) in securities:
            seen_themes[st] = t
        seen_themes["st-c2"] = "t-c"
        sub_themes = [
            {"id": st, "name": st, "shortName": st, "themeId": t, "displayOrder": i + 1,
             "primarySectorId": st, "areaWeight": 0.5}
            for i, (st, t) in enumerate(seen_themes.items())
        ]
        (self.registry_dir / "subThemeRegistry.json").write_text(
            __import__("json").dumps(sub_themes, ensure_ascii=False)
        )
        self.all_codes = [s[4] for s in securities]  # unique security codes
        self._succeeding = list(self.all_codes)
        self.repository = SnapshotRepository(tmp_path / "cf.sqlite3")
        self.saved_snapshots: list = []
        # Wrap save to record calls
        self._real_save = self.repository.save_snapshot
        self.repository.save_snapshot = self._record_save(self._real_save)

    def _record_save(self, real_save):
        def wrapper(draft):
            real_save(draft)
            self.saved_snapshots.append(draft)
        return wrapper

    def build_service(self, succeeding_count: int) -> CapitalFlowSyncService:
        succeeding = self.all_codes[:succeeding_count]
        source = _ScriptedSource(succeeding)
        return CapitalFlowSyncService(
            source=source,
            repository=self.repository,
            registry_root=self.tmp_path,
        )

    def sync_with_success_count(self, succeeding_count: int):
        service = self.build_service(succeeding_count)
        return service.sync("latest")


@pytest.fixture
def service_fixture(tmp_path) -> ServiceFixture:
    return ServiceFixture(tmp_path)


def test_ready_snapshot_at_ninety_percent_coverage(service_fixture):
    draft = service_fixture.sync_with_success_count(9)
    assert draft.status == "ready"
    assert draft.requested == 10
    assert draft.succeeded == 9
    assert draft.failed == 1


def test_partial_snapshot_below_ninety_percent(service_fixture):
    draft = service_fixture.sync_with_success_count(8)
    assert draft.status == "partial"


def test_duplicate_security_is_fetched_and_aggregated_once(service_fixture):
    draft = service_fixture.sync_with_success_count(10)
    # 10 unique securities → 10 points (the duplicate 688111 mapping adds a
    # second *display* mapping but not a second point).
    assert len(draft.points) == 10
    assert sum(draft.theme_totals.values()) == sum(
        point.net_amount_main for point in draft.points
    )
    assert sum(draft.sub_theme_totals.values()) == sum(
        point.net_amount_main for point in draft.points
    )
    # The related mapping (s5b → 688111) does not double-count in totals.
    assert draft.sub_theme_totals.get("st-c2", 0) == 0


def test_zero_success_does_not_replace_existing_snapshot(service_fixture):
    with pytest.raises(SnapshotSyncError, match="no usable capital flow points"):
        service_fixture.sync_with_success_count(0)
    assert service_fixture.saved_snapshots == []


def test_aggregation_invariant_holds_within_tolerance(service_fixture):
    draft = service_fixture.sync_with_success_count(10)
    unique_total = sum(p.net_amount_main for p in draft.points)
    assert abs(sum(draft.theme_totals.values()) - unique_total) < 0.01
    assert abs(sum(draft.sub_theme_totals.values()) - unique_total) < 0.01


def test_explicit_date_is_validated_against_calendar(service_fixture):
    service = service_fixture.build_service(10)
    with pytest.raises(CapitalFlowSourceError):
        service.sync("2026-06-11")  # not a trade date per the scripted source


def test_missing_securities_recorded_as_failures(service_fixture):
    draft = service_fixture.sync_with_success_count(8)
    missing = [f for f in draft.failures if f.reason == "missing_source_row"]
    assert len(missing) == 2
    assert draft.failed == 2
