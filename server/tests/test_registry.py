import json

from server.capital_flow.registry import load_registry, normalize_a_share_code


def test_normalizes_supported_shanghai_and_shenzhen_codes():
    assert normalize_a_share_code("600519") == "600519.XSHG"
    assert normalize_a_share_code("688111") == "688111.XSHG"
    assert normalize_a_share_code("000001") == "000001.XSHE"
    assert normalize_a_share_code("300308") == "300308.XSHE"


def test_rejects_placeholder_and_unconfirmed_markets():
    assert normalize_a_share_code("988000") is None
    assert normalize_a_share_code("900001") is None
    assert normalize_a_share_code("873593") is None


def test_load_registry_dedups_cross_listed_stock(tmp_path):
    """A stock listed under two sub-themes -> one security, two mappings (first
    primary, the rest related). The shared registry no longer cross-lists any
    stock (the generator emits each once), so this exercises the loader's dedup
    mechanism against a synthetic registry."""
    data = tmp_path / "src" / "data"
    data.mkdir(parents=True)
    (data / "subThemeRegistry.json").write_text(
        json.dumps(
            [
                {"id": "sa", "themeId": "ai-computing"},
                {"id": "sb", "themeId": "ai-computing"},
            ]
        ),
        encoding="utf-8",
    )
    (data / "stockRegistry.json").write_text(
        json.dumps(
            [
                {"id": "x-a", "name": "X", "shortName": "X", "subThemeId": "sa", "code": "300308"},
                {"id": "x-b", "name": "X", "shortName": "X", "subThemeId": "sb", "code": "300308"},
            ]
        ),
        encoding="utf-8",
    )
    registry = load_registry(tmp_path)
    mappings = [m for m in registry.mappings if m.raw_code == "300308"]
    assert len(mappings) == 2
    assert {m.aggregation_role for m in mappings} == {"primary", "related"}
    assert len(registry.securities) == 1


def test_registry_has_no_unsupported_codes(project_root):
    # After Part-1 cleanup the 7 non-A-share / BSE placeholders were removed
    # from stockRegistry.json.  The registry should now have zero failures.
    registry = load_registry(project_root)
    assert registry.failures == [], (
        f"Unexpected unsupported codes in registry: "
        f"{[f.raw_code for f in registry.failures]}"
    )


def test_registry_securities_have_no_duplicates(project_root):
    registry = load_registry(project_root)
    codes = [s.security_code for s in registry.securities]
    assert len(codes) == len(set(codes))
