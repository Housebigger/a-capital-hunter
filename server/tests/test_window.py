from server.capital_flow.window import aggregate_window, WINDOW_SPECS

def _snap(trade_date, points, status="ready", coverage=None):
    return {
        "tradeDate": trade_date, "fetchedAt": f"{trade_date}T16:00:00Z",
        "source": "tushare", "metric": "net_amount_main", "unit": "CNY",
        "status": status, "coverage": coverage or {"requested": 2, "succeeded": 2, "failed": 0},
        "points": points, "failures": [],
    }

def _pt(stock_id, amount, theme="t1", sub="s1"):
    return {"securityCode": f"{stock_id}.X", "stockName": stock_id, "netAmountMain": amount,
            "stockId": stock_id, "subThemeId": sub, "themeId": theme, "aggregationRole": "primary"}

def test_sums_net_amount_per_stock_across_days():
    snaps = [_snap("2026-06-17", [_pt("a", 100), _pt("b", -50)]),
             _snap("2026-06-16", [_pt("a", 10), _pt("b", -5)])]
    out = aggregate_window(snaps, requested_days=5, label="近5日")
    by = {p["stockId"]: p["netAmountMain"] for p in out["points"]}
    assert by == {"a": 110, "b": -55}
    assert out["window"] == {"days": 5, "label": "近5日", "from": "2026-06-16", "to": "2026-06-17", "availableDays": 2}
    assert out["tradeDate"] == "2026-06-17"
    for p in out["points"]:
        assert p["tradeDate"] == "2026-06-17"

def test_partial_window_reports_available_days():
    out = aggregate_window([_snap("2026-06-17", [_pt("a", 100)])], requested_days=20, label="近20日")
    assert out["window"]["availableDays"] == 1
    assert out["window"]["from"] == "2026-06-17"
    assert out["points"][0]["netAmountMain"] == 100

def test_stock_present_in_only_some_days():
    snaps = [_snap("2026-06-17", [_pt("a", 100)]),
             _snap("2026-06-16", [_pt("a", 10), _pt("b", -7)])]
    out = aggregate_window(snaps, 5, "近5日")
    by = {p["stockId"]: p["netAmountMain"] for p in out["points"]}
    assert by == {"a": 110, "b": -7}

def test_window_specs_map_keys_to_days_and_labels():
    assert WINDOW_SPECS["1d"] == (1, "今日")
    assert WINDOW_SPECS["20d"] == (20, "近20日")
