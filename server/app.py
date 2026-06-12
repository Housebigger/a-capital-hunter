"""
Flask backend wrapping AkShare to serve real A-share sector capital flow data.
"""

import akshare as ak
from flask import Flask, jsonify
from flask_cors import CORS
from flask_caching import Cache

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


def map_to_sector_ids(df) -> list[dict]:
    """
    Iterate rows of an AkShare DataFrame, keyword-match against SECTOR_MAP,
    and return de-duplicated sector points.
    """
    results: list[dict] = []
    seen_ids: set[str] = set()

    for _, row in df.iterrows():
        name = str(row.get("名称", ""))
        net_inflow = _safe_float(row.get("主力净流入-净额", 0))
        pct_change = _safe_float(row.get("主力净流入-净占比", 0))

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


@app.route("/api/capital-flow/rank")
@cache.cached(timeout=300, query_string=True)
def capital_flow_rank():
    """Sector capital flow ranking by time period.

    Query params:
      indicator: str — one of "今日", "5日", "10日", "20日" (default: "今日")
      demo: str — set to "1" to inject simulated non-zero data for testing
    """
    from flask import request
    import hashlib, random

    indicator = request.args.get("indicator", "今日")
    demo_mode = request.args.get("demo", "") == "1"

    # Validate indicator
    valid_indicators = {"今日", "5日", "10日", "20日"}
    if indicator not in valid_indicators:
        return jsonify({"error": f"Invalid indicator: {indicator}. Must be one of {valid_indicators}", "fallback": True}), 400

    try:
        # --- Industry (行业资金流) ---
        df_industry = ak.stock_sector_fund_flow_rank(
            indicator=indicator, sector_type="行业资金流"
        )
        points = map_to_sector_ids(df_industry)

        # --- Concept (概念资金流) — non-fatal ---
        try:
            df_concept = ak.stock_sector_fund_flow_rank(
                indicator=indicator, sector_type="概念资金流"
            )
            concept_points = map_to_sector_ids(df_concept)
            seen = {p["sectorId"] for p in points}
            for cp in concept_points:
                if cp["sectorId"] not in seen:
                    points.append(cp)
                    seen.add(cp["sectorId"])
        except Exception:
            pass

        # --- Demo mode: inject non-zero simulated data ---
        if demo_mode:
            for i, p in enumerate(points):
                # Deterministic pseudo-random based on sectorId + indicator
                seed = int(hashlib.md5((p["sectorId"] + indicator).encode()).hexdigest()[:8], 16)
                rng = random.Random(seed)
                # Range: -80 to +120, varies by indicator
                base = rng.randint(-80, 120)
                if indicator == "5日":
                    base = int(base * 3.2)
                elif indicator == "10日":
                    base = int(base * 5.5)
                p["netInflow"] = float(base)
                p["pctChange"] = float(rng.randint(-5, 8))

        return jsonify({
            "indicator": indicator,
            "source": "eastmoney",
            "points": points,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "fallback": True}), 503


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


if __name__ == "__main__":
    app.run(debug=True, port=5001)
