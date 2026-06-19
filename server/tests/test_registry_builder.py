from server.capital_flow.registry_builder import (
    MemberBasic,
    is_eligible,
    rank_members,
    assign_primary,
    build_registries,
    compute_order_index,
)

REF = "20260617"

def _m(code, name, circ_mv, amount, list_date="20180101"):
    return MemberBasic(ts_code=code, name=name, circ_mv=circ_mv, amount=amount, list_date=list_date)

def test_is_eligible_rejects_st_suspended_new_illiquid():
    assert is_eligible(_m("1.SZ", "中际旭创", 1e6, 9e5), REF, min_amount=5e5, min_listed_days=60)
    assert not is_eligible(_m("2.SZ", "ST中际", 1e6, 9e5), REF, 5e5, 60)        # ST
    assert not is_eligible(_m("3.SZ", "停牌股", 1e6, 0), REF, 5e5, 60)          # suspended (amount 0)
    assert not is_eligible(_m("4.SZ", "次新股", 1e6, 9e5, "20260601"), REF, 5e5, 60)  # listed <60d
    assert not is_eligible(_m("5.SZ", "小票", 1e6, 1e4), REF, 5e5, 60)          # below liquidity floor

def test_rank_members_sorts_by_circ_mv_desc_after_filter():
    members = [_m("a.SZ", "A", 3e6, 9e5), _m("b.SZ", "ST B", 9e9, 9e5), _m("c.SZ", "C", 5e6, 9e5)]
    ranked = rank_members(members, REF, min_amount=5e5, min_listed_days=60)
    assert [m.ts_code for m in ranked] == ["c.SZ", "a.SZ"]   # ST B filtered; C(5e6) > A(3e6)

def test_assign_primary_one_subtheme_per_stock_with_backfill():
    A = _m("x.SZ", "X", 9e6, 9e5); B = _m("y.SZ", "Y", 8e6, 9e5); C = _m("z.SZ", "Z", 7e6, 9e5)
    ranked = {"s1": [A, B], "s2": [A, C]}          # X is in both; ranks best (0) in both
    order = {"s1": 1, "s2": 2}
    out = assign_primary(ranked, order, target_n=2)
    # X -> s1 (lower displayOrder tie-break); s2 backfills with C
    assert [m.ts_code for m in out["s1"]] == ["x.SZ", "y.SZ"]
    assert [m.ts_code for m in out["s2"]] == ["z.SZ"]
    all_codes = [m.ts_code for ms in out.values() for m in ms]
    assert len(all_codes) == len(set(all_codes))    # each stock once

def test_build_registries_emits_expected_shapes():
    mapping = [{"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
                "themeId": "ai-computing", "boardTsCode": "885001.TI", "boardName": "CPO"}]
    assignments = {"opt": [_m("300308.SZ", "中际旭创", 9e6, 9e5)]}
    subs, stocks = build_registries(mapping, assignments)
    assert subs == [{"id": "opt", "name": "光通信", "shortName": "光通信",
                     "themeId": "ai-computing", "displayOrder": 1,
                     "primarySectorId": "ai-computing", "areaWeight": 0.8}]
    assert stocks == [{"id": "s-300308", "name": "中际旭创", "shortName": "中际旭创",
                       "subThemeId": "opt", "code": "300308"}]

def test_build_registries_honors_optional_primary_sector_id():
    mapping = [{"subThemeId": "opt", "name": "光通信", "shortName": "光通信",
                "themeId": "ai-computing", "boardTsCode": "x", "boardName": "y",
                "primarySectorId": "optical-modules"}]
    subs, _ = build_registries(mapping, {"opt": []})
    assert subs[0]["primarySectorId"] == "optical-modules"

def test_compute_order_index_is_per_theme_sequential():
    mapping = [{"subThemeId": "a", "themeId": "t1"}, {"subThemeId": "b", "themeId": "t1"},
               {"subThemeId": "c", "themeId": "t2"}]
    assert compute_order_index(mapping) == {"a": 1, "b": 2, "c": 1}
