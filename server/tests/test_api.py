from datetime import date

import pytest

from server.capital_flow.api import create_capital_flow_blueprint
from server.capital_flow.models import (
    SnapshotDraft,
    SnapshotFailure,
    SourcePoint,
    StockMapping,
)
from server.capital_flow.repository import SnapshotRepository


def _sample_draft(trade_date=date(2026, 6, 12), status="ready") -> SnapshotDraft:
    net = 12_345_600.0
    return SnapshotDraft(
        trade_date=trade_date,
        fetched_at="2026-06-12T16:00:00Z",
        source="jqdata",
        metric="net_amount_main",
        unit="CNY",
        status=status,
        requested=10,
        succeeded=9,
        failed=1,
        points=[
            SourcePoint(
                security_code="300308.XSHE",
                trade_date=trade_date,
                net_amount_main=net,
            )
        ],
        mappings=[
            StockMapping(
                stock_id="aci-zjxc",
                stock_name="中际旭创",
                short_name="中际旭创",
                raw_code="300308",
                security_code="300308.XSHE",
                sub_theme_id="optical-interconnect",
                theme_id="ai-computing",
                aggregation_role="primary",
            )
        ],
        failures=[
            SnapshotFailure(reason="missing_source_row", security_code="000001.XSHE")
        ],
        theme_totals={"ai-computing": net},
        sub_theme_totals={"optical-interconnect": net},
    )


@pytest.fixture
def client(tmp_path):
    from flask import Flask

    repo = SnapshotRepository(tmp_path / "cf.sqlite3")
    repo.save_snapshot(_sample_draft())
    app = Flask(__name__)
    app.register_blueprint(create_capital_flow_blueprint(repo))
    app.config["TESTING"] = True
    # Keep repo alive for the test session
    app.config["_REPO"] = repo
    with app.test_client() as c:
        yield c
    repo.close()


def test_latest_snapshot_endpoint(client):
    response = client.get("/api/capital-flow/snapshot/latest")
    assert response.status_code == 200
    data = response.get_json()
    assert data["source"] == "jqdata"
    assert data["tradeDate"] == "2026-06-12"
    assert data["status"] == "ready"
    assert data["points"][0]["aggregationRole"] == "primary"
    assert data["points"][0]["netAmountMain"] == 12_345_600.0


def test_snapshot_by_date_returns_404_for_missing_date(client):
    response = client.get("/api/capital-flow/snapshot?trade_date=2026-06-11")
    assert response.status_code == 404
    assert response.get_json() == {
        "error": {
            "code": "snapshot_not_found",
            "message": "No snapshot for 2026-06-11",
        }
    }


def test_snapshot_by_date_returns_existing(client):
    response = client.get("/api/capital-flow/snapshot?trade_date=2026-06-12")
    assert response.status_code == 200
    assert response.get_json()["tradeDate"] == "2026-06-12"


def test_snapshot_missing_trade_date_param(client):
    response = client.get("/api/capital-flow/snapshot")
    assert response.status_code == 400
    body = response.get_json()
    assert body["error"]["code"] == "missing_trade_date"


def test_status_never_contacts_jqdata(client):
    response = client.get("/api/capital-flow/status")
    assert response.status_code == 200
    body = response.get_json()
    assert body["availableTradeDates"] == ["2026-06-12"]
    assert body["source"] == "jqdata"
    assert body["metric"] == "net_amount_main"
    assert body["databaseAvailable"] is True
    assert body["latestTradeDate"] == "2026-06-12"


def test_latest_returns_404_when_no_snapshot(tmp_path):
    from flask import Flask

    repo = SnapshotRepository(tmp_path / "cf.sqlite3")
    app = Flask(__name__)
    app.register_blueprint(create_capital_flow_blueprint(repo))
    app.config["TESTING"] = True
    with app.test_client() as c:
        response = c.get("/api/capital-flow/snapshot/latest")
    repo.close()
    assert response.status_code == 404
    assert response.get_json()["error"]["code"] == "snapshot_not_found"


def test_error_shape_is_consistent(client):
    """All 4xx errors use {error: {code, message}}."""
    response = client.get("/api/capital-flow/snapshot?trade_date=2025-01-01")
    body = response.get_json()
    assert set(body.keys()) == {"error"}
    assert set(body["error"].keys()) == {"code", "message"}
