"""Export the local snapshot store to static JSON for the public (static) site.

Run from the project root AFTER syncing data:

    python3 scripts/export_static_data.py

For each window in WINDOW_SPECS it calls SnapshotRepository.get_window_snapshot
and writes public/data/snapshot-<key>.json — the exact payload the production
frontend fetches and validates with parseSnapshot. Exits non-zero if the store
holds no snapshots, so CI fails loudly instead of deploying an empty site.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List

# Allow `python3 scripts/export_static_data.py` from the project root: the
# script's own directory (scripts/) is on sys.path by default, not the root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.capital_flow.repository import SnapshotRepository
from server.capital_flow.window import WINDOW_SPECS

DEFAULT_DB = Path("server/data/capital_flow.sqlite3")
OUT_DIR = Path("public/data")


def export_static_data(db_path: Path, out_dir: Path) -> List[Path]:
    """Write one JSON file per window; return the paths written.

    Raises SystemExit if the store has no snapshots.
    """
    repo = SnapshotRepository(db_path)
    try:
        out_dir.mkdir(parents=True, exist_ok=True)
        written: List[Path] = []
        for key, (days, label) in WINDOW_SPECS.items():
            snapshot = repo.get_window_snapshot(days, label)
            if snapshot is None:
                raise SystemExit(
                    f"no snapshots in {db_path}; run the sync before exporting"
                )
            path = out_dir / f"snapshot-{key}.json"
            path.write_text(
                json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            written.append(path)
        return written
    finally:
        repo.close()


def main() -> None:
    for path in export_static_data(DEFAULT_DB, OUT_DIR):
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
