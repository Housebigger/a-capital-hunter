"""Load and normalize the shared market registries.

The shared JSON files (``src/data/stockRegistry.json`` and
``src/data/subThemeRegistry.json``) are the single source of truth for stock
display mappings and sub-theme→theme relationships. Both the TypeScript
frontend and this Python pipeline consume them verbatim; no second copy is
maintained.

The normalizer:
  * rejects placeholder / non-A-share codes without throwing,
  * assigns the first mapping of each security as ``primary`` (so aggregation
    totals stay stable when a security spans multiple sub-themes), and
  * records every rejected entry as a ``RegistryFailure`` for data-quality
    reporting.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

from .models import (
    AggregationRole,
    RegistryFailure,
    RegistryResult,
    Security,
    StockMapping,
)

#: Prefixes that identify tradable Shanghai A-shares (JQData ``.XSHG`` suffix).
_SHANGHAI_PREFIXES = ("600", "601", "603", "605", "688")

#: Prefixes that identify tradable Shenzhen A-shares (JQData ``.XSHE`` suffix).
_SHENZHEN_PREFIXES = ("000", "001", "002", "003", "300", "301")


def normalize_a_share_code(raw_code: str) -> Optional[str]:
    """Map a 6-digit A-share code to its JQData security code.

    Returns ``None`` for placeholder codes (e.g. ``988xxx`` pseudo-listings),
    B-shares (``900xxx``), unconfirmed markets, and anything that is not a
    6-digit string. North-of-Beijing (北交所 ``8xxxxx``/``4xxxxx``) codes are
    rejected in this first version because JQData entitlements for them vary
    by account.
    """
    if len(raw_code) != 6 or not raw_code.isdigit():
        return None
    if raw_code.startswith(_SHANGHAI_PREFIXES):
        return f"{raw_code}.XSHG"
    if raw_code.startswith(_SHENZHEN_PREFIXES):
        return f"{raw_code}.XSHE"
    return None


def load_registry(project_root: Path) -> RegistryResult:
    """Load the shared JSON registries and normalize them for the pipeline.

    ``project_root`` is the repository root that contains ``src/data``. The
    function is pure: given the same root it always returns the same result.
    """
    data_dir = project_root / "src" / "data"
    stocks_path = data_dir / "stockRegistry.json"
    sub_themes_path = data_dir / "subThemeRegistry.json"

    stocks_raw = json.loads(stocks_path.read_text(encoding="utf-8"))
    sub_themes_raw = json.loads(sub_themes_path.read_text(encoding="utf-8"))

    # subThemeId -> themeId lookup
    theme_by_sub_theme: Dict[str, str] = {
        st["id"]: st["themeId"] for st in sub_themes_raw
    }

    securities: List[Security] = []
    mappings: List[StockMapping] = []
    failures: List[RegistryFailure] = []

    seen_security_codes: Dict[str, Security] = {}
    primary_codes: set = set()

    for entry in stocks_raw:
        stock_id = entry["id"]
        stock_name = entry["name"]
        short_name = entry["shortName"]
        sub_theme_id = entry["subThemeId"]
        raw_code = entry["code"]

        theme_id = theme_by_sub_theme.get(sub_theme_id)
        if theme_id is None:
            # Sub-theme references a theme we do not know about — treat as a
            # data-quality failure rather than silently dropping the stock.
            failures.append(
                RegistryFailure(
                    reason="unsupported_or_placeholder_code",
                    raw_code=raw_code,
                    stock_id=stock_id,
                )
            )
            continue

        security_code = normalize_a_share_code(raw_code)
        if security_code is None:
            failures.append(
                RegistryFailure(
                    reason="unsupported_or_placeholder_code",
                    raw_code=raw_code,
                    stock_id=stock_id,
                )
            )
            continue

        # Register a new security on first sighting
        if security_code not in seen_security_codes:
            security = Security(
                security_code=security_code,
                stock_name=stock_name,
                short_name=short_name,
            )
            seen_security_codes[security_code] = security
            securities.append(security)
            primary_codes.add(security_code)

        role: AggregationRole = (
            "primary" if security_code in primary_codes else "related"
        )
        # The first mapping for a security stays primary; subsequent ones
        # demote it to related and clear the primary marker.
        if role == "primary":
            primary_codes.discard(security_code)

        mappings.append(
            StockMapping(
                stock_id=stock_id,
                stock_name=stock_name,
                short_name=short_name,
                raw_code=raw_code,
                security_code=security_code,
                sub_theme_id=sub_theme_id,
                theme_id=theme_id,
                aggregation_role=role,
            )
        )

    return RegistryResult(
        securities=securities, mappings=mappings, failures=failures
    )
