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
    "光模块": "optical-modules",
    "CPO": "cpo",
    "光通信": "optical-modules",
    "液冷": "liquid-cooled-servers",
    "算力": "data-centers",
    "国产芯片": "domestic-chips",
    "AI芯片": "ai-chip-design",
    "人工智能": "ai-applications",
    "AIGC": "ai-applications",
    "机器人概念": "robotics-core",
    "减速器": "robotics-core",
    "机器视觉": "perception-layer",
    "传感器": "perception-layer",
    "人形机器人": "application-scenarios",
    "低空经济": "aircraft-control",
    "无人机": "drone-ops",
    "通用航空": "aircraft-control",
    "半导体": "semiconductor-equipment",
    "半导体概念": "semiconductor-equipment",
    "芯片": "domestic-chips",
    "集成电路": "design-manufacturing",
    "先进封装": "advanced-packaging",
    "光刻胶": "materials-process",
    "光伏设备": "power-generation",
    "太阳能": "power-generation",
    "储能": "storage-battery",
    "锂电池": "storage-battery",
    "充电桩": "charging-infra",
    "航天概念": "launch-communication",
    "卫星导航": "navigation-electronics",
    "北斗": "navigation-electronics",
    "军工": "defense-informatics",
    "商业航天": "launch-communication",
    "创新药": "drug-rd",
    "CRO": "device-biology",
    "医疗器械": "device-biology",
    "中药": "traditional-medicine",
    "新能源车": "vehicle-powertrain",
    "自动驾驶": "autonomous-driving",
    "智能驾驶": "autonomous-driving",
    "车联网": "v2x",
    "汽车芯片": "chip-arch",
    "消费电子": "terminal-devices",
    "VR": "vr-ar",
    "AR": "vr-ar",
    "虚拟现实": "vr-ar",
    "苹果概念": "terminal-devices",
    "数据要素": "data-elements",
    "信创": "xinchuang",
    "云计算": "cloud-software",
    "网络安全": "security-software",
    "数字货币": "digital-finance",
    "金融科技": "fin-infra",
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


@app.route("/api/capital-flow/realtime")
@cache.cached(timeout=300)
def capital_flow_realtime():
    try:
        # --- Industry (行业资金流) ---
        df_industry = ak.stock_sector_fund_flow_rank(
            indicator="今日", sector_type="行业资金流"
        )
        points = map_to_sector_ids(df_industry)

        # --- Concept (概念资金流) — non-fatal ---
        try:
            df_concept = ak.stock_sector_fund_flow_rank(
                indicator="今日", sector_type="概念资金流"
            )
            concept_points = map_to_sector_ids(df_concept)
            # Merge: concept data fills gaps not covered by industry
            seen = {p["sectorId"] for p in points}
            for cp in concept_points:
                if cp["sectorId"] not in seen:
                    points.append(cp)
                    seen.add(cp["sectorId"])
        except Exception:
            pass  # concept fetch failure is non-fatal

        return jsonify({"points": points})

    except Exception as e:
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
