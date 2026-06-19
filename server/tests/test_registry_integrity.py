import json
from pathlib import Path

from server.capital_flow.registry import normalize_a_share_code

ROOT = Path(__file__).resolve().parents[2]
SUBS = json.loads((ROOT / "src/data/subThemeRegistry.json").read_text(encoding="utf-8"))
STOCKS = json.loads((ROOT / "src/data/stockRegistry.json").read_text(encoding="utf-8"))

THEME_IDS = {
    "ai-computing", "robotics-physical-ai", "low-altitude-economy", "semiconductors",
    "new-energy", "defense-aerospace", "innovative-medicine", "new-energy-vehicles",
    "consumer-electronics", "digital-economy", "fintech",
}


def test_every_stock_code_normalizes():
    for s in STOCKS:
        assert normalize_a_share_code(s["code"]) is not None, s["code"]


def test_every_stock_subtheme_exists():
    sub_ids = {s["id"] for s in SUBS}
    for s in STOCKS:
        assert s["subThemeId"] in sub_ids, s["subThemeId"]


def test_every_subtheme_theme_is_valid():
    for s in SUBS:
        assert s["themeId"] in THEME_IDS, s["themeId"]


def test_ids_unique():
    assert len({s["id"] for s in SUBS}) == len(SUBS)
    assert len({s["id"] for s in STOCKS}) == len(STOCKS)
