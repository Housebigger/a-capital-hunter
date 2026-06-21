import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.generate_registries import run_build
from server.capital_flow.board_source import BoardInfo, FakeBoardSource
from server.capital_flow.registry_builder import MemberBasic


def _source():
    return FakeBoardSource(
        latest="20260617",
        boards=[BoardInfo("885001.TI", "CPO", 2), BoardInfo("885002.TI", "AI算力", 2)],
        members={"885001.TI": ["300308.SZ", "300502.SZ"],
                 "885002.TI": ["300308.SZ", "688041.SH"]},  # 300308 in both
        basics={
            "300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
            "300502.SZ": MemberBasic("300502.SZ", "新易盛", 5e6, 8e5, "20160101"),
            "688041.SH": MemberBasic("688041.SH", "海光信息", 8e6, 9e5, "20220101"),
        },
    )


def test_run_build_produces_deduped_registries():
    mapping = [
        {"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
         "themeId": "ai-computing", "boardTsCode": "885001.TI", "boardName": "CPO"},
        {"subThemeId": "compute", "name": "AI算力", "shortName": "算力",
         "themeId": "ai-computing", "boardTsCode": "885002.TI", "boardName": "AI算力"},
    ]
    subs, stocks, summary = run_build(_source(), mapping, target_n=8,
                                      min_amount=5e5, min_listed_days=60)
    assert {s["id"] for s in subs} == {"opt", "compute"}
    codes = [s["code"] for s in stocks]
    assert len(codes) == len(set(codes))                 # each stock once
    assert "300308" in codes                              # 中际旭创 assigned once
    assert summary["totalStocks"] == len(stocks)


def test_run_build_excludes_unsupported_codes():
    src = FakeBoardSource(
        latest="20260617",
        boards=[BoardInfo("885001.TI", "CPO", 2)],
        members={"885001.TI": ["300308.SZ", "873593.BJ"]},   # 873593 = BSE, unsupported
        basics={
            "300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
            "873593.BJ": MemberBasic("873593.BJ", "鼎智科技", 1e6, 5e5, "20200101"),
        },
    )
    mapping = [{"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
                "themeId": "ai-computing", "boardTsCode": "885001.TI", "boardName": "CPO"}]
    subs, stocks, summary = run_build(src, mapping)
    assert [s["code"] for s in stocks] == ["300308"]   # 873593 excluded


def test_preflight_permission_error_is_reported(capsys):
    from scripts.generate_registries import preflight

    class Denied:
        def list_boards(self): raise PermissionError("ths_member not authorized")
        def latest_trade_date(self): return "20260617"
        def board_members(self, b): return []
        def basics(self, d): return {}

    with pytest.raises(SystemExit):
        preflight(Denied())
    assert "not authorized" in capsys.readouterr().out


def test_run_build_hybrid_verifies_drops_and_reports():
    from scripts.generate_registries import run_build_hybrid
    src = FakeBoardSource(
        latest="20260618", boards=[], members={},
        basics={
            "300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
            "688041.SH": MemberBasic("688041.SH", "海光信息", 8e6, 9e5, "20220101"),
        },
    )
    draft = [{"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
              "themeId": "ai-computing",
              "candidates": [{"code": "300308", "name": "中际旭创"},
                             {"code": "688041", "name": "寒武纪"},     # mismatch: resolves 海光信息
                             {"code": "999999", "name": "幽灵股"}]}]   # unverified
    subs, stocks, summary = run_build_hybrid(src, draft, target_n=8,
                                             min_amount=5e5, min_listed_days=60)
    assert [s["code"] for s in stocks] == ["300308", "688041"]        # 999999 dropped
    names = {s["code"]: s["name"] for s in stocks}
    assert names["688041"] == "海光信息"                               # RESOLVED name emitted
    assert {u["code"] for u in summary["unverified"]} == {"999999"}
    assert {m["code"] for m in summary["nameMismatches"]} == {"688041"}


def test_run_build_hybrid_dedups_across_subthemes():
    from scripts.generate_registries import run_build_hybrid
    src = FakeBoardSource(
        latest="20260618", boards=[], members={},
        basics={"300308.SZ": MemberBasic("300308.SZ", "中际旭创", 9e6, 9e5, "20120101"),
                "688041.SH": MemberBasic("688041.SH", "海光信息", 8e6, 9e5, "20220101")},
    )
    draft = [
        {"subThemeId": "opt", "name": "光通信", "shortName": "光通信", "themeId": "ai-computing",
         "candidates": [{"code": "300308", "name": "中际旭创"}]},
        {"subThemeId": "chip", "name": "AI芯片", "shortName": "AI芯片", "themeId": "ai-computing",
         "candidates": [{"code": "300308", "name": "中际旭创"}, {"code": "688041", "name": "海光信息"}]},
    ]
    subs, stocks, summary = run_build_hybrid(src, draft, target_n=8,
                                             min_amount=5e5, min_listed_days=60)
    assert sorted(s["code"] for s in stocks) == ["300308", "688041"]  # 300308 once (opt wins)
