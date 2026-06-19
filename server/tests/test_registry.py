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


def test_registry_deduplicates_requests_and_keeps_all_mappings(project_root):
    registry = load_registry(project_root)
    mappings = [item for item in registry.mappings if item.raw_code == "688111"]
    assert len(mappings) == 2
    assert mappings[0].aggregation_role == "primary"
    assert mappings[1].aggregation_role == "related"
    assert len(registry.securities) < len(registry.mappings)


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
