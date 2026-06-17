"""SQLite snapshot repository for capital flow data.

The repository is the only component that knows about the on-disk schema.
Snapshots are written atomically: a single ``with connection:`` block deletes
any prior rows for the trade date and inserts the new snapshot plus its child
rows, so a partial write can never be observed by readers.

Read methods emit camelCase dictionaries that match the frontend contract
exactly; no key-munging happens at the API layer.
"""

from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path
from typing import List, Optional

from .models import SnapshotDraft

_SCHEMA = """
CREATE TABLE IF NOT EXISTS capital_flow_snapshots (
  id INTEGER PRIMARY KEY,
  trade_date TEXT NOT NULL UNIQUE,
  fetched_at TEXT NOT NULL,
  source TEXT NOT NULL,
  metric TEXT NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ready', 'partial', 'failed')),
  requested INTEGER NOT NULL,
  succeeded INTEGER NOT NULL,
  failed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS capital_flow_points (
  snapshot_id INTEGER NOT NULL REFERENCES capital_flow_snapshots(id) ON DELETE CASCADE,
  security_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  net_amount_main REAL NOT NULL,
  PRIMARY KEY (snapshot_id, security_code)
);

CREATE TABLE IF NOT EXISTS stock_mappings (
  snapshot_id INTEGER NOT NULL REFERENCES capital_flow_snapshots(id) ON DELETE CASCADE,
  security_code TEXT NOT NULL,
  stock_id TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  sub_theme_id TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  aggregation_role TEXT NOT NULL CHECK(aggregation_role IN ('primary', 'related')),
  PRIMARY KEY (snapshot_id, stock_id)
);

CREATE TABLE IF NOT EXISTS capital_flow_failures (
  snapshot_id INTEGER NOT NULL REFERENCES capital_flow_snapshots(id) ON DELETE CASCADE,
  security_code TEXT,
  stock_id TEXT,
  reason TEXT NOT NULL
);
"""


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path = Path(db_path)
    if db_path.parent and not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


class SnapshotRepository:
    """Read-only-by-convention access to the snapshot store.

    The single mutating method is :meth:`save_snapshot`; everything else is a
    SELECT. Tests use a temp path; production uses
    ``server/data/capital_flow.sqlite3``.
    """

    def __init__(self, db_path: Path):
        self._db_path = Path(db_path)
        self._conn = _connect(self._db_path)
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "SnapshotRepository":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    def save_snapshot(self, draft: SnapshotDraft) -> None:
        """Atomically replace the snapshot for ``draft.trade_date``.

        Runs inside ``with connection:`` so any constraint violation rolls
        back the whole delete-and-replace, leaving the previous state intact.
        """
        trade_date_str = draft.trade_date.isoformat()
        conn = self._conn
        with conn:
            # Remove any prior snapshot for this trade date (cascade handles
            # child rows because foreign keys are on).
            conn.execute(
                "DELETE FROM capital_flow_snapshots WHERE trade_date = ?",
                (trade_date_str,),
            )
            cur = conn.execute(
                """
                INSERT INTO capital_flow_snapshots
                  (trade_date, fetched_at, source, metric, unit, status,
                   requested, succeeded, failed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trade_date_str,
                    draft.fetched_at,
                    draft.source,
                    draft.metric,
                    draft.unit,
                    draft.status,
                    draft.requested,
                    draft.succeeded,
                    draft.failed,
                ),
            )
            snapshot_id = cur.lastrowid

            for point in draft.points:
                # Pull the display name from the primary mapping when present;
                # fall back to "" so the NOT NULL constraint still holds.
                name = self._primary_name_for(draft, point.security_code)
                conn.execute(
                    """
                    INSERT INTO capital_flow_points
                      (snapshot_id, security_code, stock_name, net_amount_main)
                    VALUES (?, ?, ?, ?)
                    """,
                    (snapshot_id, point.security_code, name, point.net_amount_main),
                )

            for m in draft.mappings:
                conn.execute(
                    """
                    INSERT INTO stock_mappings
                      (snapshot_id, security_code, stock_id, stock_name,
                       sub_theme_id, theme_id, aggregation_role)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        snapshot_id,
                        m.security_code,
                        m.stock_id,
                        m.stock_name,
                        m.sub_theme_id,
                        m.theme_id,
                        m.aggregation_role,
                    ),
                )

            for f in draft.failures:
                conn.execute(
                    """
                    INSERT INTO capital_flow_failures
                      (snapshot_id, security_code, stock_id, reason)
                    VALUES (?, ?, ?, ?)
                    """,
                    (snapshot_id, f.security_code, f.stock_id, f.reason),
                )

    @staticmethod
    def _primary_name_for(draft: SnapshotDraft, security_code: str) -> str:
        for m in draft.mappings:
            if (
                m.security_code == security_code
                and m.aggregation_role == "primary"
            ):
                return m.stock_name
        # Fallback: any mapping for this code
        for m in draft.mappings:
            if m.security_code == security_code:
                return m.stock_name
        return ""

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def _snapshot_row(self, trade_date_str: str) -> Optional[sqlite3.Row]:
        cur = self._conn.execute(
            "SELECT * FROM capital_flow_snapshots WHERE trade_date = ?",
            (trade_date_str,),
        )
        return cur.fetchone()

    def _expand(self, row: sqlite3.Row) -> dict:
        snapshot_id = row["id"]
        points = self._conn.execute(
            """
            SELECT p.security_code AS securityCode,
                   p.stock_name    AS stockName,
                   p.net_amount_main AS netAmountMain,
                   m.stock_id      AS stockId,
                   m.sub_theme_id  AS subThemeId,
                   m.theme_id      AS themeId,
                   m.aggregation_role AS aggregationRole
            FROM capital_flow_points p
            LEFT JOIN stock_mappings m
              ON m.snapshot_id = p.snapshot_id
             AND m.security_code = p.security_code
             AND m.aggregation_role = 'primary'
            WHERE p.snapshot_id = ?
            """,
            (snapshot_id,),
        ).fetchall()

        # When no primary mapping exists, fall back to any mapping for the
        # security so the frontend still has a stockId/subThemeId to render.
        resolved = []
        for p in points:
            d = dict(p)
            if d.get("stockId") is None:
                fallback = self._conn.execute(
                    """
                    SELECT stock_id AS stockId, sub_theme_id AS subThemeId,
                           theme_id AS themeId, aggregation_role AS aggregationRole
                    FROM stock_mappings
                    WHERE snapshot_id = ? AND security_code = ?
                    LIMIT 1
                    """,
                    (snapshot_id, p["securityCode"]),
                ).fetchone()
                if fallback is not None:
                    d.update(dict(fallback))
            resolved.append(d)

        failures = [
            dict(f)
            for f in self._conn.execute(
                """
                SELECT security_code AS securityCode,
                       stock_id AS stockId,
                       reason
                FROM capital_flow_failures
                WHERE snapshot_id = ?
                """,
                (snapshot_id,),
            ).fetchall()
        ]

        return {
            "tradeDate": row["trade_date"],
            "fetchedAt": row["fetched_at"],
            "source": row["source"],
            "metric": row["metric"],
            "unit": row["unit"],
            "status": row["status"],
            "coverage": {
                "requested": row["requested"],
                "succeeded": row["succeeded"],
                "failed": row["failed"],
            },
            "points": resolved,
            "failures": failures,
        }

    def get_snapshot(self, trade_date) -> Optional[dict]:
        """Return the expanded snapshot for a date, or ``None`` if missing.

        Accepts a ``date`` or ``YYYY-MM-DD`` string.
        """
        trade_date_str = (
            trade_date.isoformat() if isinstance(trade_date, date) else str(trade_date)
        )
        row = self._snapshot_row(trade_date_str)
        if row is None:
            return None
        return self._expand(row)

    def get_latest_snapshot(self) -> Optional[dict]:
        """Newest ``ready`` snapshot, else newest ``partial``.

        ``failed`` snapshots are never returned as "latest" because they carry
        no usable point data.
        """
        row = self._conn.execute(
            """
            SELECT * FROM capital_flow_snapshots
            WHERE status = 'ready'
            ORDER BY trade_date DESC
            LIMIT 1
            """
        ).fetchone()
        if row is None:
            row = self._conn.execute(
                """
                SELECT * FROM capital_flow_snapshots
                WHERE status = 'partial'
                ORDER BY trade_date DESC
                LIMIT 1
                """
            ).fetchone()
        if row is None:
            return None
        return self._expand(row)

    def list_trade_dates(self) -> List[str]:
        rows = self._conn.execute(
            "SELECT trade_date FROM capital_flow_snapshots ORDER BY trade_date DESC"
        ).fetchall()
        return [r["trade_date"] for r in rows]

    def status(self) -> dict:
        dates = self.list_trade_dates()
        latest_trade_date = dates[0] if dates else None
        latest_status = None
        if latest_trade_date is not None:
            row = self._snapshot_row(latest_trade_date)
            if row is not None:
                latest_status = row["status"]
        return {
            "databaseAvailable": True,
            "latestTradeDate": latest_trade_date,
            "latestStatus": latest_status,
            "source": "jqdata",
            "metric": "net_amount_main",
            "availableTradeDates": dates,
        }
