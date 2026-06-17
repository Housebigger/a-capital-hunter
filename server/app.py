"""
Flask backend wrapping AkShare to serve real A-share sector capital flow data.
"""

import os
import logging

# Only clear proxy env vars when explicitly requested (default: keep system proxy)
if os.environ.get("CLEAR_PROXY_ON_STARTUP", "").lower() == "true":
    _PROXY_KEYS = [k for k in os.environ if "proxy" in k.lower()]
    for _k in _PROXY_KEYS:
        del os.environ[_k]

import akshare as ak
from flask import Flask, jsonify
from flask_cors import CORS
from flask_caching import Cache

logger = logging.getLogger("capital_hunter")

app = Flask(__name__)
CORS(app)

cache = Cache(app, config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})

# ---------------------------------------------------------------------------
# Sector keyword → domain sectorId mapping (substring match, first hit wins)
# ---------------------------------------------------------------------------
SECTOR_MAP: dict[str, str] = {
    # AI算力
    "光模块": "optical-modules",
    "CPO": "cpo",
    "光通信": "optical-modules",
    "液冷": "liquid-cooled-servers",
    "算力": "data-centers",
    "国产芯片": "domestic-computing",
    "国产算力": "domestic-computing",
    "数字芯片": "domestic-computing",
    "AI芯片": "ai-chip-design",
    "人工智能": "aigc",
    "AIGC": "aigc",
    "AI Agent": "ai-agent",
    "AI应用": "ai-agent",
    # 机器人/物理AI
    "机器人概念": "humanoid-robot",
    "减速器": "reducers",
    "伺服": "servo-systems",
    "机器视觉": "machine-vision",
    "传感器": "sensors",
    "人形机器人": "humanoid-robot",
    "工业机器人": "industrial-robotics",
    "执行器": "actuators",
    # 低空经济
    "低空经济": "evtol",
    "无人机": "drones",
    "通用航空": "general-aviation-operations",
    "eVTOL": "evtol",
    "飞行控制": "flight-control-systems",
    "空管": "air-traffic-systems",
    # 半导体
    "半导体": "semiconductor-equipment",
    "半导体概念": "semiconductor-equipment",
    "半导体设备": "semiconductor-equipment",
    "芯片设计": "chip-design",
    "芯片": "domestic-computing",
    "集成电路": "wafer-fabrication",
    "晶圆": "wafer-fabrication",
    "光刻胶": "photoresist",
    "先进封装": "advanced-packaging",
    "封测": "advanced-packaging",
    "Chiplet": "chiplet",
    "HBM": "hbm",
    "存储芯片": "hbm",
    # 新能源
    "光伏设备": "photovoltaics",
    "光伏": "photovoltaics",
    "太阳能": "photovoltaics",
    "风电": "wind-power",
    "储能": "energy-storage",
    "锂电池": "power-batteries",
    "电池": "power-batteries",
    "充电桩": "charging-infrastructure",
    "固态电池": "solid-state-batteries",
    # 军工/商业航天
    "航天概念": "commercial-aerospace",
    "商业航天": "commercial-aerospace",
    "卫星": "satellite-internet",
    "卫星导航": "navigation-systems",
    "北斗": "navigation-systems",
    "军工": "defense-electronics",
    "国防": "defense-electronics",
    "军工信息化": "defense-informatics",
    "航天材料": "aerospace-materials",
    # 创新药/医药
    "创新药": "innovative-drugs",
    "CRO": "cro-cdmo",
    "医疗器械": "medical-devices",
    "合成生物": "synthetic-biology",
    "中药": "traditional-chinese-medicine",
    # 新能源汽车/智能驾驶
    "新能源车": "vehicle-manufacturing",
    "自动驾驶": "autonomous-driving",
    "智能驾驶": "autonomous-driving",
    "车联网": "v2x-communication",
    "激光雷达": "lidar",
    "汽车芯片": "automotive-chips",
    "智能座舱": "smart-cockpit",
    "电驱动": "electric-drive-systems",
    # 消费电子/VR
    "消费电子": "smartphones",
    "消费电子零部件": "smartphones",
    "VR": "vr-ar-devices",
    "AR": "vr-ar-devices",
    "虚拟现实": "vr-ar-devices",
    "苹果概念": "smartphones",
    "面板": "display-panels",
    "声学": "acoustic-devices",
    "光学镜头": "optical-lenses",
    "可穿戴": "wearable-devices",
    # 数字经济
    "数据要素": "data-elements",
    "数据安全": "data-security",
    "信创": "xinchuang",
    "操作系统": "os-database",
    "数据库": "os-database",
    "云计算": "cloud-computing",
    "SaaS": "saas-enterprise-software",
    "网络安全": "cybersecurity",
    # 金融科技
    "券商IT": "brokerage-it",
    "金融科技": "brokerage-it",
    "支付": "payment-systems",
    "数字货币": "digital-currency",
    "金融AI": "financial-ai",
    "保险科技": "insurance-tech",
}


def _safe_float(val):
    """Convert a value to float, returning 0.0 on failure."""
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0


def _find_col(df, suffix: str):
    """Find a column whose name ends with `suffix`.

    AkShare columns include the indicator as prefix, e.g.
    '今日主力净流入-净额' or '5日主力净流入-净额'.
    """
    for col in df.columns:
        if col.endswith(suffix):
            return col
    # Fallback: try exact match (older AkShare versions)
    if suffix in df.columns:
        return suffix
    return None


def map_to_sector_ids(df) -> list[dict]:
    """
    Iterate rows of an AkShare DataFrame, keyword-match against SECTOR_MAP,
    and return de-duplicated sector points.
    """
    # Find the dynamic column names
    inflow_col = _find_col(df, "主力净流入-净额") or "主力净流入-净额"
    pct_col = _find_col(df, "主力净流入-净占比") or "主力净流入-净占比"
    change_col = _find_col(df, "涨跌幅") or "涨跌幅"

    results: list[dict] = []
    seen_ids: set[str] = set()

    for _, row in df.iterrows():
        name = str(row.get("名称", ""))
        net_inflow = _safe_float(row.get(inflow_col, 0))
        pct_change = _safe_float(row.get(change_col, 0))

        matched_id: str | None = None
        for keyword, sector_id in SECTOR_MAP.items():
            if keyword in name:
                matched_id = sector_id
                break

        if matched_id is None or matched_id in seen_ids:
            continue

        seen_ids.add(matched_id)
        results.append({
            "sectorId": matched_id,
            "sectorName": name,
            "netInflow": net_inflow,
            "pctChange": pct_change,
        })

    return results


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "akshare_version": ak.__version__})


def _fetch_with_retry(fetch_fn, retries=2, delay=1):
    """Call an AkShare function with retries on network errors."""
    import time
    for attempt in range(retries + 1):
        try:
            return fetch_fn()
        except Exception as e:
            if attempt < retries:
                time.sleep(delay)
            else:
                raise


def _check_proxy() -> dict:
    """Quick connectivity probe: proxy reachable → domain reachable → API reachable."""
    import urllib.request, urllib.error

    diag = {"proxy_ok": None, "domain_ok": None, "api_ok": None}

    # 1) Proxy — check if HTTP_PROXY / HTTPS_PROXY is set and reachable
    proxy_url = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("https_proxy") or os.environ.get("http_proxy")
    if proxy_url:
        try:
            req = urllib.request.Request(proxy_url, method="HEAD")
            urllib.request.urlopen(req, timeout=5)
            diag["proxy_ok"] = True
        except Exception:
            diag["proxy_ok"] = False
    else:
        diag["proxy_ok"] = None  # no proxy configured

    # 2) Domain — push2.eastmoney.com root
    try:
        req = urllib.request.Request("https://push2.eastmoney.com/", headers={"User-Agent": "probe"})
        urllib.request.urlopen(req, timeout=8)
        diag["domain_ok"] = True
    except Exception:
        diag["domain_ok"] = False

    # 3) API — clist/get with minimal params
    try:
        url = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=1&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:2+f:!50&fields=f12,f14"
        req = urllib.request.Request(url, headers={"User-Agent": "probe"})
        resp = urllib.request.urlopen(req, timeout=10)
        resp.read()
        diag["api_ok"] = True
    except Exception:
        diag["api_ok"] = False

    return diag


@app.route("/api/capital-flow/rank")
@cache.cached(timeout=300, query_string=True)
def capital_flow_rank():
    """Sector capital flow ranking by time period.

    Query params:
      indicator: str — one of "今日", "5日", "10日" (default: "今日")
      demo: str — set to "1" to inject simulated data when real is unavailable
    """
    from flask import request
    import hashlib, random, traceback as tb

    indicator = request.args.get("indicator", "今日")
    demo_mode = request.args.get("demo", "") == "1"

    valid_indicators = {"今日", "5日", "10日"}
    if indicator not in valid_indicators:
        return jsonify({"error": f"Invalid indicator: {indicator}", "fallback": True}), 400

    points = []
    diag = {"akshare_exception": []}

    # --- Industry (行业资金流) with retry ---
    try:
        df_industry = _fetch_with_retry(
            lambda: ak.stock_sector_fund_flow_rank(
                indicator=indicator, sector_type="行业资金流"
            )
        )
        points = map_to_sector_ids(df_industry)
    except Exception as exc:
        diag["akshare_exception"].append({
            "source": "行业资金流",
            "error": f"{type(exc).__name__}: {exc}",
        })
        logger.warning("行业资金流 fetch failed [%s]: %s", indicator, exc)

    # --- Concept (概念资金流) with retry — fills gaps ---
    try:
        df_concept = _fetch_with_retry(
            lambda: ak.stock_sector_fund_flow_rank(
                indicator=indicator, sector_type="概念资金流"
            )
        )
        concept_points = map_to_sector_ids(df_concept)
        seen = {p["sectorId"] for p in points}
        for cp in concept_points:
            if cp["sectorId"] not in seen:
                points.append(cp)
                seen.add(cp["sectorId"])
    except Exception as exc:
        diag["akshare_exception"].append({
            "source": "概念资金流",
            "error": f"{type(exc).__name__}: {exc}",
        })
        logger.warning("概念资金流 fetch failed [%s]: %s", indicator, exc)

    # If we got no data at all, try demo mode
    if not points:
        demo_mode = True

    # --- Determine fallback_reason ---
    fallback_reason = None
    if demo_mode:
        if diag["akshare_exception"]:
            fallback_reason = "akshare_exception"
        elif not points:
            fallback_reason = "no_matched_points"
        logger.info(
            "fallback triggered: indicator=%s reason=%s exceptions=%s",
            indicator, fallback_reason, diag["akshare_exception"],
        )

    # If real data was fetched, log connectivity summary
    if not demo_mode:
        logger.info("real data OK: indicator=%s points=%d", indicator, len(points))

    # --- Demo mode: inject simulated data ---
    if demo_mode:
        # Build a default set of points from SECTOR_MAP
        if not points:
            seen_ids = set()
            for keyword, sector_id in SECTOR_MAP.items():
                if sector_id not in seen_ids:
                    seen_ids.add(sector_id)
                    seed = int(hashlib.md5((sector_id + indicator).encode()).hexdigest()[:8], 16)
                    rng = random.Random(seed)
                    base = rng.randint(-80, 120)
                    if indicator == "5日":
                        base = int(base * 3.2)
                    elif indicator == "10日":
                        base = int(base * 5.5)
                    points.append({
                        "sectorId": sector_id,
                        "sectorName": keyword,
                        "netInflow": float(base),
                        "pctChange": float(rng.randint(-5, 8)),
                    })
        else:
            # Inject non-zero values for real points that are zero
            for p in points:
                if p["netInflow"] == 0:
                    seed = int(hashlib.md5((p["sectorId"] + indicator).encode()).hexdigest()[:8], 16)
                    rng = random.Random(seed)
                    base = rng.randint(-80, 120)
                    if indicator == "5日":
                        base = int(base * 3.2)
                    elif indicator == "10日":
                        base = int(base * 5.5)
                    p["netInflow"] = float(base)
                    p["pctChange"] = float(rng.randint(-5, 8))

    # --- Build response with optional diagnostics ---
    resp = {
        "indicator": indicator,
        "source": "eastmoney",
        "points": points,
        "demo": demo_mode,
    }
    if demo_mode or diag["akshare_exception"]:
        conn = _check_proxy()
        resp["diagnostics"] = {
            "proxy_ok": conn["proxy_ok"],
            "domain_ok": conn["domain_ok"],
            "api_ok": conn["api_ok"],
            "akshare_exception": diag["akshare_exception"],
            "fallback_reason": fallback_reason,
        }

    return jsonify(resp)


@app.route("/api/capital-flow/history")
@cache.cached(timeout=600, query_string=True)
def capital_flow_history():
    from flask import request

    days = request.args.get("days", "5", type=str)
    # Validate days to one of the indicators AkShare supports
    indicator = f"{days}日"

    try:
        df = ak.stock_sector_fund_flow_rank(
            indicator=indicator, sector_type="行业资金流"
        )
        points = map_to_sector_ids(df)
        return jsonify({"scenarios": [{"indicator": indicator, "points": points}]})

    except Exception as e:
        return jsonify({"error": str(e), "fallback": True}), 503


# ---------------------------------------------------------------------------
# JQData capital flow snapshot API (product path)
# ---------------------------------------------------------------------------
# NOTE: The AkShare routes above (`/api/capital-flow/rank`, `/api/capital-flow/
# history`, `/api/health`) are experimental diagnostics kept for local probing
# of the Eastmoney link. The product path is the read-only JQData snapshot
# Blueprint below; the frontend should consume these endpoints, not AkShare.
#
# Registration is wrapped so that running this file directly from inside the
# ``server/`` directory (``cd server && python3 app.py``) still serves the
# AkShare diagnostics even though the ``server.*`` package import fails. The
# recommended launch is ``python3 -m server.app`` from the project root, which
# registers both.
import os as _os
from pathlib import Path as _Path

try:
    from server.capital_flow.api import create_capital_flow_blueprint
    from server.capital_flow.repository import SnapshotRepository

    _CAPITAL_FLOW_DB = _os.environ.get(
        "CAPITAL_FLOW_DB",
        str(_Path(__file__).resolve().parent / "data" / "capital_flow.sqlite3"),
    )
    _capital_flow_repo = SnapshotRepository(_CAPITAL_FLOW_DB)
    app.register_blueprint(create_capital_flow_blueprint(_capital_flow_repo))
    logger.info("registered JQData snapshot blueprint (db=%s)", _CAPITAL_FLOW_DB)
except ImportError as _e:
    logger.warning(
        "JQData snapshot blueprint not registered (run via 'python3 -m server.app' "
        "from the project root to enable it): %s",
        _e,
    )


if __name__ == "__main__":
    app.run(debug=True, port=5001)