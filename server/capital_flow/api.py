"""Read-only Flask Blueprint serving capital flow snapshots.

These routes never touch JQData: they only read what the daily sync already
wrote to SQLite. That keeps page loads fast and decouples browser uptime from
data-source availability.

Error shape is uniform: ``{"error": {"code": str, "message": str}}``. 404 means
no usable snapshot exists; 503 means the SQLite database itself is unreadable.
"""

from __future__ import annotations

import sqlite3

from flask import Blueprint, jsonify, request

from .repository import SnapshotRepository
from .window import WINDOW_SPECS, aggregate_window


def _error(code: str, message: str, status: int):
    return jsonify({"error": {"code": code, "message": message}}), status


def create_capital_flow_blueprint(repository: SnapshotRepository) -> Blueprint:
    """Build the blueprint bound to a specific repository.

    The repository is constructed once in ``app.py`` and injected here so tests
    can pass a temp repository without touching real disk state.
    """
    bp = Blueprint("capital_flow", __name__)

    @bp.get("/api/capital-flow/snapshot/latest")
    def latest_snapshot():
        window = request.args.get("window", "1d")
        spec = WINDOW_SPECS.get(window)
        if spec is None:
            return _error("invalid_window",
                          f"Unknown window '{window}' (expected one of {sorted(WINDOW_SPECS)})", 400)
        days, label = spec
        try:
            snapshot = repository.get_window_snapshot(days, label)
        except sqlite3.Error as exc:
            return _error("snapshot_unavailable", f"Cannot read capital flow database: {exc}", 503)
        if snapshot is None:
            return _error("snapshot_not_found", "No usable capital flow snapshot has been synced yet", 404)
        return jsonify(snapshot)

    @bp.get("/api/capital-flow/snapshot")
    def snapshot_by_date():
        trade_date = request.args.get("trade_date")
        if not trade_date:
            return _error(
                "missing_trade_date",
                "Query parameter 'trade_date' is required (YYYY-MM-DD)",
                400,
            )
        try:
            snapshot = repository.get_snapshot(trade_date)
        except sqlite3.Error as exc:
            return _error("snapshot_unavailable", f"Cannot read capital flow database: {exc}", 503)
        if snapshot is None:
            return _error("snapshot_not_found", f"No snapshot for {trade_date}", 404)
        # Uniform contract: every snapshot response carries a window (single day = 1d).
        return jsonify(aggregate_window([snapshot], 1, "今日"))

    @bp.get("/api/capital-flow/status")
    def status():
        try:
            return jsonify(repository.status())
        except sqlite3.Error as exc:
            return _error(
                "snapshot_unavailable",
                f"Cannot read capital flow database: {exc}",
                503,
            )

    return bp
