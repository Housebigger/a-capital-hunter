"""Command-line entry point for the daily capital flow sync.

Usage::

    python3 -m server.capital_flow.sync --trade-date latest
    python3 -m server.capital_flow.sync --trade-date 2026-06-12 \
        --database server/data/capital_flow.sqlite3

Credentials come from ``JQDATA_USERNAME`` / ``JQDATA_PASSWORD``. The summary
printed to stdout never includes credentials. Exit code is 0 for a persisted
``ready``/``partial`` snapshot, 1 for any failure.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Optional

from .repository import SnapshotRepository
from .service import CapitalFlowSyncService, SnapshotSyncError
from .source import (
    CapitalFlowSource,
    CapitalFlowSourceError,
    JqDataCapitalFlowSource,
    TushareCapitalFlowSource,
)

#: Default SQLite path relative to the project root.
DEFAULT_DB = "server/data/capital_flow.sqlite3"

#: Which data source to use. ``tushare`` is the default: it has no region
#: restriction and its moneyflow interface is reachable with a free 2000-point
#: account. JQData's money-flow module is paid, so jqdata is kept only as an
#: alternative for accounts that have purchased it.
DEFAULT_SOURCE = "tushare"


def build_summary(
    *,
    trade_date: Optional[date],
    status: Optional[str],
    requested: int,
    succeeded: int,
    failed: int,
    error: Optional[str],
) -> dict:
    """Build a JSON-serializable, credential-free summary."""
    return {
        "tradeDate": trade_date.isoformat() if trade_date else None,
        "status": status,
        "coverage": {
            "requested": requested,
            "succeeded": succeeded,
            "failed": failed,
        },
        "error": error,
    }


def _project_root() -> Path:
    # server/capital_flow/sync.py -> repo root is three parents up
    return Path(__file__).resolve().parents[2]


def build_source_from_environment(env: dict) -> CapitalFlowSource:
    """Construct the configured data source from environment variables.

    Selection rule (first match wins):
      * ``CAPITAL_FLOW_SOURCE=tushare`` (default) → Tushare, needs TUSHARE_TOKEN
      * ``CAPITAL_FLOW_SOURCE=jqdata``            → JQData, needs JQDATA_*

    Defaulting to Tushare because JQData blocks access from outside mainland
    China; Tushare has no such restriction.
    """
    kind = (env.get("CAPITAL_FLOW_SOURCE") or DEFAULT_SOURCE).strip().lower()
    if kind == "tushare":
        return TushareCapitalFlowSource.from_environment(env)
    if kind == "jqdata":
        return JqDataCapitalFlowSource.from_environment(env)
    raise CapitalFlowSourceError(
        f"Unknown CAPITAL_FLOW_SOURCE '{kind}' (expected 'tushare' or 'jqdata')"
    )


def run_sync(argv: list, env: Optional[dict] = None) -> int:
    env = env if env is not None else os.environ
    parser = argparse.ArgumentParser(
        description="Sync capital flow snapshots (Tushare or JQData)"
    )
    parser.add_argument(
        "--trade-date",
        default="latest",
        help="'latest' or YYYY-MM-DD (default: latest)",
    )
    parser.add_argument(
        "--database",
        default=None,
        help=f"SQLite path (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--source",
        default=None,
        help="Override CAPITAL_FLOW_SOURCE: 'tushare' or 'jqdata'",
    )
    args = parser.parse_args(argv)

    db_path = Path(args.database) if args.database else _project_root() / DEFAULT_DB
    if args.source:
        env = {**env, "CAPITAL_FLOW_SOURCE": args.source}

    try:
        source = build_source_from_environment(env)
    except CapitalFlowSourceError as exc:
        print(json.dumps(build_summary(
            trade_date=None, status=None, requested=0, succeeded=0, failed=0,
            error=f"{type(exc).__name__}: {exc}",
        ), ensure_ascii=False))
        return 1

    repository = SnapshotRepository(db_path)
    service = CapitalFlowSyncService(
        source=source,
        repository=repository,
        registry_root=_project_root(),
    )

    try:
        draft = service.sync(args.trade_date)
    except (CapitalFlowSourceError, SnapshotSyncError) as exc:
        print(json.dumps(build_summary(
            trade_date=None, status=None, requested=0, succeeded=0, failed=0,
            error=f"{type(exc).__name__}: {exc}",
        ), ensure_ascii=False))
        return 1
    finally:
        repository.close()

    print(json.dumps(build_summary(
        trade_date=draft.trade_date,
        status=draft.status,
        requested=draft.requested,
        succeeded=draft.succeeded,
        failed=draft.failed,
        error=None,
    ), ensure_ascii=False))
    return 0


def main() -> None:
    sys.exit(run_sync(sys.argv[1:]))


if __name__ == "__main__":
    main()
