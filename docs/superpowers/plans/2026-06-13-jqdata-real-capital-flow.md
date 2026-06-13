# JQData Real Capital Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the silent AkShare/mock path with a JQData-backed end-of-day snapshot pipeline whose real P3 stock values aggregate consistently into P2 sub-themes and P1 themes.

**Architecture:** A Python sync command authenticates with JQData, fetches `net_amount_main`, converts the source unit from ten-thousand CNY to CNY, validates coverage, and atomically writes SQLite snapshots. Flask serves read-only snapshot APIs; React loads those APIs asynchronously and derives all three map levels from the same de-duplicated stock facts.

**Tech Stack:** Python 3.9+, Flask 3, SQLite, jqdatasdk 1.9.8, pytest 8.4.2, React 19, TypeScript 5.7, Vitest 3, Testing Library, Playwright.

---

## File Map

**Shared registries**

- Create `src/data/stockRegistry.json`: single machine-readable source for all stock display mappings.
- Create `src/data/subThemeRegistry.json`: single machine-readable source for sub-theme-to-theme relationships.
- Modify `src/domain/stockRegistry.ts`: freeze and export JSON-backed `Stock` objects.
- Modify `src/domain/subThemeRegistry.ts`: freeze and export JSON-backed `SubTheme` objects.

**Python pipeline**

- Create `server/__init__.py`: make the backend importable as a package.
- Create `server/capital_flow/__init__.py`: package marker.
- Create `server/capital_flow/models.py`: immutable pipeline records and snapshot status rules.
- Create `server/capital_flow/registry.py`: load shared JSON, normalize supported A-share codes, and choose primary mappings.
- Create `server/capital_flow/source.py`: `CapitalFlowSource` protocol and JQData adapter.
- Create `server/capital_flow/repository.py`: SQLite schema, atomic writes, and snapshot reads.
- Create `server/capital_flow/service.py`: orchestration, coverage, failures, and aggregation validation.
- Create `server/capital_flow/sync.py`: command-line entry point.
- Create `server/capital_flow/api.py`: read-only Flask Blueprint.
- Create `server/tests/`: pytest fixtures and focused tests for every backend unit.
- Modify `server/app.py`: register the snapshot Blueprint without rewriting the existing AkShare diagnostics.
- Modify `server/requirements.txt`: pin JQData and pytest dependencies.
- Modify `package.json`: package-safe backend, sync, and test scripts.
- Modify `.gitignore`: exclude SQLite databases and local credential files.

**Frontend**

- Create `src/data/capitalFlowSnapshot.ts`: API contract and runtime parsing.
- Create `src/data/capitalFlowDataProvider.ts`: async latest/date/status provider.
- Create `src/domain/capitalFlowAggregation.ts`: de-duplicated P1/P2/P3 aggregation.
- Create `src/components/DataStatus.tsx`: source/date/metric/coverage state.
- Modify `src/domain/types.ts`: add snapshot-backed stock point types only where shared domain types are appropriate.
- Modify `src/domain/themeRenderNodes.ts`: consume theme totals rather than sector scenarios.
- Modify `src/domain/subThemeRenderNodes.ts`: consume sub-theme totals rather than sector scenarios.
- Modify `src/domain/stockRenderNodes.ts`: use real stock facts and remove synthetic distribution.
- Modify `src/components/ControlsPanel.tsx`: replace period buttons with snapshot date selection.
- Modify `src/App.tsx`: explicit loading, ready, partial, and error states.
- Modify `src/App.css`: status and error presentation.
- Remove `src/data/akShareDataProvider.ts` from the product path; retain or delete it only after its imports/tests are gone.

## Task 1: Move Registries To Shared JSON

**Files:**
- Create: `src/data/stockRegistry.json`
- Create: `src/data/subThemeRegistry.json`
- Modify: `src/domain/stockRegistry.ts`
- Modify: `src/domain/subThemeRegistry.ts`
- Modify: `src/domain/stockRegistry.test.ts`
- Modify: `src/domain/subThemeRegistry.test.ts`

- [ ] **Step 1: Add failing tests that assert JSON is the registry source**

Add these assertions to the existing registry tests:

```ts
import stockConfig from "../data/stockRegistry.json";
import subThemeConfig from "../data/subThemeRegistry.json";

it("matches the shared stock JSON exactly", () => {
  expect(stocks).toEqual(stockConfig);
  expect(stockConfig).toHaveLength(184);
});

it("matches the shared sub-theme JSON exactly", () => {
  expect(subThemes).toEqual(subThemeConfig);
});
```

- [ ] **Step 2: Run the tests and verify the missing JSON failure**

Run: `npx vitest run src/domain/stockRegistry.test.ts src/domain/subThemeRegistry.test.ts`

Expected: FAIL because both JSON modules do not exist.

- [ ] **Step 3: Move existing registry literals into JSON without changing order or values**

Move every object currently inside `stockConfig` into a JSON array in `src/data/stockRegistry.json`. Move every object currently inside the sub-theme configuration array into `src/data/subThemeRegistry.json`. Preserve order because the first occurrence of a duplicated stock code defines its aggregation primary mapping.

Replace the TypeScript wrappers with:

```ts
import stockConfig from "../data/stockRegistry.json";
import type { Stock } from "./types";

const freezeStock = (stock: Stock): Readonly<Stock> => Object.freeze({ ...stock });

export const stocks: readonly Readonly<Stock>[] = Object.freeze(
  stockConfig.map((stock) => freezeStock(stock))
);
```

```ts
import subThemeConfig from "../data/subThemeRegistry.json";
import type { SubTheme } from "./types";

const freezeSubTheme = (subTheme: SubTheme): Readonly<SubTheme> =>
  Object.freeze({ ...subTheme });

export const subThemes: readonly Readonly<SubTheme>[] = Object.freeze(
  subThemeConfig.map((subTheme) => freezeSubTheme(subTheme))
);
```

- [ ] **Step 4: Verify registry integrity and the full frontend suite**

Run: `npx vitest run src/domain/stockRegistry.test.ts src/domain/subThemeRegistry.test.ts`

Expected: PASS, with 184 stock mappings and all existing sub-theme invariants intact.

Run: `npm test`

Expected: all existing Vitest tests PASS.

- [ ] **Step 5: Commit the shared registries**

```bash
git add src/data/stockRegistry.json src/data/subThemeRegistry.json src/domain/stockRegistry.ts src/domain/subThemeRegistry.ts src/domain/stockRegistry.test.ts src/domain/subThemeRegistry.test.ts
git commit -m "refactor: share market registries with backend"
```

## Task 2: Add Backend Models And Registry Normalization

**Files:**
- Create: `server/__init__.py`
- Create: `server/capital_flow/__init__.py`
- Create: `server/capital_flow/models.py`
- Create: `server/capital_flow/registry.py`
- Create: `server/tests/conftest.py`
- Create: `server/tests/test_registry.py`
- Modify: `server/requirements.txt`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Add backend test dependencies and scripts**

Append to `server/requirements.txt`:

```text
jqdatasdk==1.9.8
pytest==8.4.2
```

Add scripts to `package.json`:

```json
"test:backend": "python3 -m pytest server/tests -q",
"sync:capital-flow": "python3 -m server.capital_flow.sync --trade-date latest",
"dev:backend": "python3 -m server.app",
"dev:full": "concurrently \"npm run dev\" \"npm run dev:backend\""
```

Add to `.gitignore`:

```text
.env
.env.*
server/data/*.sqlite3
server/data/*.sqlite3-*
```

Run: `python3 -m pip install -r server/requirements.txt`

Expected: dependencies install successfully.

- [ ] **Step 2: Write failing normalization and primary-mapping tests**

Create `server/tests/test_registry.py`:

```python
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
```

Create `server/tests/conftest.py`:

```python
from pathlib import Path
import pytest


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).resolve().parents[2]
```

- [ ] **Step 3: Run tests and verify imports fail**

Run: `python3 -m pytest server/tests/test_registry.py -q`

Expected: FAIL because `server.capital_flow.registry` does not exist.

- [ ] **Step 4: Implement immutable records and registry loading**

In `models.py`, define frozen records for `StockMapping`, `RegistryFailure`, `RegistryResult`, `SourcePoint`, `SnapshotFailure`, `SnapshotDraft`, and the literal statuses `ready`, `partial`, `failed`. `StockMapping` must include `stock_id`, `stock_name`, `short_name`, `raw_code`, `security_code`, `sub_theme_id`, `theme_id`, and `aggregation_role`.

Implement `normalize_a_share_code` with explicit supported prefixes:

```python
def normalize_a_share_code(raw_code: str) -> str | None:
    if len(raw_code) != 6 or not raw_code.isdigit():
        return None
    if raw_code.startswith(("600", "601", "603", "605", "688")):
        return f"{raw_code}.XSHG"
    if raw_code.startswith(("000", "001", "002", "003", "300", "301")):
        return f"{raw_code}.XSHE"
    return None
```

`load_registry(project_root)` must read both shared JSON files, build a `subThemeId -> themeId` map, preserve stock order, assign the first mapping for each normalized code as `primary`, assign later mappings as `related`, and emit `RegistryFailure(reason="unsupported_or_placeholder_code")` for rejected codes.

- [ ] **Step 5: Run registry tests**

Run: `python3 -m pytest server/tests/test_registry.py -q`

Expected: PASS.

- [ ] **Step 6: Commit backend foundations**

```bash
git add .gitignore package.json server/__init__.py server/capital_flow/__init__.py server/capital_flow/models.py server/capital_flow/registry.py server/tests/conftest.py server/tests/test_registry.py server/requirements.txt
git commit -m "feat: add capital flow registry model"
```

## Task 3: Implement The JQData Adapter

**Files:**
- Create: `server/capital_flow/source.py`
- Create: `server/tests/test_source.py`

- [ ] **Step 1: Write failing adapter tests with a fake SDK**

Create `server/tests/test_source.py` with a fake SDK whose `get_trade_days` returns `2026-06-12` and whose `get_money_flow` returns a pandas DataFrame containing `date`, `sec_code`, and `net_amount_main`.

```python
def test_fetch_daily_converts_ten_thousand_cny_to_cny(fake_sdk):
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    points = source.fetch_daily(date(2026, 6, 12), ["300308.XSHE"])
    assert points == [
        SourcePoint(
            security_code="300308.XSHE",
            trade_date=date(2026, 6, 12),
            net_amount_main=12_345_600.0,
        )
    ]
    assert fake_sdk.money_flow_fields == ["date", "sec_code", "net_amount_main"]


def test_fetch_daily_omits_dash_none_and_nan(fake_sdk):
    fake_sdk.money_flow_values = ["-", None, float("nan")]
    source = JqDataCapitalFlowSource("user", "secret", sdk=fake_sdk)
    assert source.fetch_daily(date(2026, 6, 12), fake_sdk.security_codes) == []


def test_credentials_are_required():
    with pytest.raises(CapitalFlowSourceError, match="JQDATA_USERNAME"):
        JqDataCapitalFlowSource.from_environment({})
```

- [ ] **Step 2: Run tests and verify the adapter is missing**

Run: `python3 -m pytest server/tests/test_source.py -q`

Expected: FAIL because `JqDataCapitalFlowSource` is undefined.

- [ ] **Step 3: Implement protocol, authentication, dates, and conversion**

Define:

```python
class CapitalFlowSource(Protocol):
    def latest_trade_date(self) -> date:
        raise NotImplementedError

    def is_trade_date(self, trade_date: date) -> bool:
        raise NotImplementedError

    def fetch_daily(self, trade_date: date, securities: list[str]) -> list[SourcePoint]:
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError
```

`JqDataCapitalFlowSource` must authenticate once with `sdk.auth(username, password)`, resolve the latest day with `sdk.get_trade_days(end_date=date.today(), count=1)`, implement `is_trade_date()` with `sdk.get_trade_days(start_date=trade_date, end_date=trade_date)`, and request one explicit date using:

```python
sdk.get_money_flow(
    securities,
    start_date=trade_date,
    end_date=trade_date,
    fields=["date", "sec_code", "net_amount_main"],
)
```

Convert valid source values with `float(value) * 10_000`. Reject non-finite values and the string `"-"`. Wrap SDK/authentication errors in `CapitalFlowSourceError` without including credentials. Call `sdk.logout()` from `close()` when available.

- [ ] **Step 4: Run adapter tests**

Run: `python3 -m pytest server/tests/test_source.py -q`

Expected: PASS.

- [ ] **Step 5: Commit the source adapter**

```bash
git add server/capital_flow/source.py server/tests/test_source.py
git commit -m "feat: add JQData capital flow source"
```

## Task 4: Add Atomic SQLite Snapshot Storage

**Files:**
- Create: `server/capital_flow/repository.py`
- Create: `server/tests/test_repository.py`

- [ ] **Step 1: Write failing repository tests**

Cover these exact behaviors:

```python
def test_save_and_expand_snapshot(repository, ready_snapshot):
    repository.save_snapshot(ready_snapshot)
    result = repository.get_snapshot("2026-06-12")
    assert result["tradeDate"] == "2026-06-12"
    assert result["unit"] == "CNY"
    assert result["points"][0]["aggregationRole"] == "primary"


def test_latest_prefers_ready_over_partial(repository, ready_snapshot, newer_partial_snapshot):
    repository.save_snapshot(ready_snapshot)
    repository.save_snapshot(newer_partial_snapshot)
    assert repository.get_latest_snapshot()["status"] == "ready"


def test_transaction_rolls_back_when_mapping_insert_fails(repository, invalid_snapshot):
    with pytest.raises(sqlite3.IntegrityError):
        repository.save_snapshot(invalid_snapshot)
    assert repository.list_trade_dates() == []
```

- [ ] **Step 2: Run tests and verify the repository is missing**

Run: `python3 -m pytest server/tests/test_repository.py -q`

Expected: FAIL because `SnapshotRepository` does not exist.

- [ ] **Step 3: Implement schema and transactional repository**

Create these tables with foreign keys enabled:

```sql
CREATE TABLE IF NOT EXISTS capital_flow_snapshots (
  id INTEGER PRIMARY KEY,
  trade_date TEXT NOT NULL UNIQUE,
  fetched_at TEXT NOT NULL,
  source TEXT NOT NULL,
  metric TEXT NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ready', 'partial', 'failed')),
  requested INTEGER NOT NULL,
  succeeded INTEGER NOT NULL,
  failed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS capital_flow_points (
  snapshot_id INTEGER NOT NULL REFERENCES capital_flow_snapshots(id) ON DELETE CASCADE,
  security_code TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  net_amount_main REAL NOT NULL,
  PRIMARY KEY (snapshot_id, security_code)
);

CREATE TABLE IF NOT EXISTS stock_mappings (
  snapshot_id INTEGER NOT NULL REFERENCES capital_flow_snapshots(id) ON DELETE CASCADE,
  security_code TEXT NOT NULL,
  stock_id TEXT NOT NULL,
  stock_name TEXT NOT NULL,
  sub_theme_id TEXT NOT NULL,
  theme_id TEXT NOT NULL,
  aggregation_role TEXT NOT NULL CHECK(aggregation_role IN ('primary', 'related')),
  PRIMARY KEY (snapshot_id, stock_id)
);

CREATE TABLE IF NOT EXISTS capital_flow_failures (
  snapshot_id INTEGER NOT NULL REFERENCES capital_flow_snapshots(id) ON DELETE CASCADE,
  security_code TEXT,
  stock_id TEXT,
  reason TEXT NOT NULL
);
```

Use `with connection:` for the complete delete-and-replace transaction for a trade date. `get_snapshot()` must join points to mappings and emit camelCase API objects. `get_latest_snapshot()` must first query newest `ready`; only if none exists may it return newest `partial`. `status()` must include `availableTradeDates` in descending order.

- [ ] **Step 4: Run repository tests**

Run: `python3 -m pytest server/tests/test_repository.py -q`

Expected: PASS.

- [ ] **Step 5: Commit storage**

```bash
git add server/capital_flow/repository.py server/tests/test_repository.py
git commit -m "feat: persist capital flow snapshots"
```

## Task 5: Build Sync Orchestration And CLI

**Files:**
- Create: `server/capital_flow/service.py`
- Create: `server/capital_flow/sync.py`
- Create: `server/tests/test_service.py`
- Create: `server/tests/test_sync.py`

- [ ] **Step 1: Write failing service tests**

Test an input registry with ten unique valid securities and two mappings for one duplicated security.

```python
def test_ready_snapshot_at_ninety_percent_coverage(service_fixture):
    draft = service_fixture.sync_with_success_count(9)
    assert draft.status == "ready"
    assert draft.requested == 10
    assert draft.succeeded == 9
    assert draft.failed == 1


def test_partial_snapshot_below_ninety_percent(service_fixture):
    draft = service_fixture.sync_with_success_count(8)
    assert draft.status == "partial"


def test_duplicate_security_is_fetched_and_aggregated_once(service_fixture):
    draft = service_fixture.sync_with_success_count(10)
    assert len(draft.points) == 10
    assert sum(draft.theme_totals.values()) == sum(
        point.net_amount_main for point in draft.points
    )
    assert sum(draft.sub_theme_totals.values()) == sum(
        point.net_amount_main for point in draft.points
    )


def test_zero_success_does_not_replace_existing_snapshot(service_fixture):
    with pytest.raises(SnapshotSyncError, match="no usable JQData points"):
        service_fixture.sync_with_success_count(0)
    assert service_fixture.repository.saved_snapshots == []
```

- [ ] **Step 2: Run tests and verify service imports fail**

Run: `python3 -m pytest server/tests/test_service.py server/tests/test_sync.py -q`

Expected: FAIL because service and CLI modules do not exist.

- [ ] **Step 3: Implement sync rules**

`CapitalFlowSyncService.sync(trade_date)` must:

1. Resolve `latest` through the source or validate an explicit `YYYY-MM-DD` against the source trading calendar.
2. Load the shared registry.
3. Fetch each unique supported security exactly once in one batch.
4. Treat absent rows as `missing_source_row` failures.
5. Add pre-filtered invalid mappings as `unsupported_or_placeholder_code` failures without including them in the coverage denominator.
6. Set `ready` when `succeeded / requested >= 0.9`; otherwise set `partial` when at least one point exists.
7. Build P2 totals from primary mappings and P1 totals from their `theme_id`.
8. Assert both aggregate sums equal the unique P3 total within `0.01` CNY.
9. Save only after all validation succeeds.
10. Always close the source in a `finally` block.

The CLI must accept:

```text
--trade-date latest|YYYY-MM-DD
--database server/data/capital_flow.sqlite3
```

It must read `JQDATA_USERNAME` and `JQDATA_PASSWORD`, print a JSON summary without secrets, return exit code `0` for `ready` or `partial`, and return exit code `1` for authentication, source, validation, or write failure.

- [ ] **Step 4: Run service and CLI tests**

Run: `python3 -m pytest server/tests/test_service.py server/tests/test_sync.py -q`

Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

Run: `npm run test:backend`

Expected: all backend tests PASS without a network call.

- [ ] **Step 6: Commit sync orchestration**

```bash
git add server/capital_flow/service.py server/capital_flow/sync.py server/tests/test_service.py server/tests/test_sync.py
git commit -m "feat: sync daily JQData snapshots"
```

## Task 6: Expose Read-Only Snapshot APIs

**Files:**
- Create: `server/capital_flow/api.py`
- Create: `server/tests/test_api.py`
- Modify: `server/app.py`

- [ ] **Step 1: Write failing Flask contract tests**

Create a temporary repository, save one fixture snapshot, and assert:

```python
def test_latest_snapshot_endpoint(client):
    response = client.get("/api/capital-flow/snapshot/latest")
    assert response.status_code == 200
    assert response.get_json()["source"] == "jqdata"


def test_snapshot_by_date_returns_404_for_missing_date(client):
    response = client.get("/api/capital-flow/snapshot?trade_date=2026-06-11")
    assert response.status_code == 404
    assert response.get_json() == {
        "error": {"code": "snapshot_not_found", "message": "No snapshot for 2026-06-11"}
    }


def test_status_never_contacts_jqdata(client):
    response = client.get("/api/capital-flow/status")
    assert response.status_code == 200
    assert response.get_json()["availableTradeDates"] == ["2026-06-12"]
```

- [ ] **Step 2: Run tests and verify routes are missing**

Run: `python3 -m pytest server/tests/test_api.py -q`

Expected: FAIL with 404 responses.

- [ ] **Step 3: Implement Blueprint and register it**

Implement `create_capital_flow_blueprint(repository)` with these routes:

```text
GET /api/capital-flow/snapshot/latest
GET /api/capital-flow/snapshot?trade_date=YYYY-MM-DD
GET /api/capital-flow/status
```

Use a consistent JSON error shape: `{"error": {"code": string, "message": string}}`. Return 404 for no usable latest snapshot or missing date, and 503 only when SQLite cannot be opened/read.

In `server/app.py`, register the Blueprint using a database path from `CAPITAL_FLOW_DB`, defaulting to `server/data/capital_flow.sqlite3` relative to the project root. Preserve the user’s current uncommitted proxy diagnostics and existing AkShare routes; add a comment that they are experimental and not part of the product path.

- [ ] **Step 4: Run API and full backend tests**

Run: `python3 -m pytest server/tests/test_api.py -q`

Expected: PASS.

Run: `npm run test:backend`

Expected: all backend tests PASS.

- [ ] **Step 5: Commit the API**

```bash
git add server/app.py server/capital_flow/api.py server/tests/test_api.py
git commit -m "feat: serve capital flow snapshots"
```

## Task 7: Add The Frontend Snapshot Provider

**Files:**
- Create: `src/data/capitalFlowSnapshot.ts`
- Create: `src/data/capitalFlowDataProvider.ts`
- Create: `src/data/capitalFlowDataProvider.test.ts`
- Remove after migration: `src/data/akShareDataProvider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Test exact parsing and HTTP behavior:

```ts
it("loads a validated latest snapshot", async () => {
  mockFetch.mockResolvedValueOnce(okJson(snapshotFixture));
  const result = await createCapitalFlowDataProvider().fetchLatest();
  expect(result.tradeDate).toBe("2026-06-12");
  expect(result.points[0].aggregationRole).toBe("primary");
});

it("throws instead of falling back to demo data", async () => {
  mockFetch.mockResolvedValueOnce(errorJson(503, "snapshot_unavailable"));
  await expect(createCapitalFlowDataProvider().fetchLatest()).rejects.toThrow(
    "snapshot_unavailable"
  );
});

it("rejects malformed success payloads", async () => {
  mockFetch.mockResolvedValueOnce(okJson({ source: "jqdata", points: [] }));
  await expect(createCapitalFlowDataProvider().fetchLatest()).rejects.toThrow(
    "Invalid capital flow snapshot"
  );
});
```

- [ ] **Step 2: Run tests and verify modules are missing**

Run: `npx vitest run src/data/capitalFlowDataProvider.test.ts`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Define and parse the API contract**

Use these frontend types:

```ts
export type SnapshotStatus = "ready" | "partial" | "failed";
export type AggregationRole = "primary" | "related";

export interface StockCapitalFlowPoint {
  readonly stockId: string;
  readonly securityCode: string;
  readonly stockName: string;
  readonly subThemeId: string;
  readonly themeId: string;
  readonly aggregationRole: AggregationRole;
  readonly netAmountMain: number;
  readonly tradeDate: string;
}

export interface CapitalFlowSnapshot {
  readonly tradeDate: string;
  readonly fetchedAt: string;
  readonly source: "jqdata";
  readonly metric: "net_amount_main";
  readonly unit: "CNY";
  readonly status: SnapshotStatus;
  readonly coverage: Readonly<{ requested: number; succeeded: number; failed: number }>;
  readonly points: readonly StockCapitalFlowPoint[];
  readonly failures: readonly Readonly<{
    securityCode?: string;
    stockId?: string;
    reason: string;
  }>[];
}

export interface CapitalFlowStatus {
  readonly databaseAvailable: boolean;
  readonly latestTradeDate?: string;
  readonly latestStatus?: SnapshotStatus;
  readonly source: "jqdata";
  readonly metric: "net_amount_main";
  readonly availableTradeDates: readonly string[];
}
```

Runtime validation must reject missing metadata, non-finite money values, invalid statuses/roles, and non-array points.

The provider exposes `fetchLatest()`, `fetchDate(tradeDate)`, and `fetchStatus()`. Every method must check `response.ok`, parse the structured backend error, use a 10-second `AbortController`, and never import the mock scenario provider.

- [ ] **Step 4: Run provider tests**

Run: `npx vitest run src/data/capitalFlowDataProvider.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the provider**

```bash
git add src/data/capitalFlowSnapshot.ts src/data/capitalFlowDataProvider.ts src/data/capitalFlowDataProvider.test.ts
git commit -m "feat: load capital flow snapshots"
```

## Task 8: Derive P1, P2, And P3 From Real Stock Facts

**Files:**
- Create: `src/domain/capitalFlowAggregation.ts`
- Create: `src/domain/capitalFlowAggregation.test.ts`
- Modify: `src/domain/themeRenderNodes.ts`
- Modify: `src/domain/subThemeRenderNodes.ts`
- Modify: `src/domain/stockRenderNodes.ts`
- Modify: `src/domain/stockRenderNodes.test.ts`
- Modify: affected render-node tests

- [ ] **Step 1: Write failing aggregation tests**

Use a fixture where one security has a primary and related mapping:

```ts
it("counts related display mappings only once", () => {
  const aggregates = buildCapitalFlowAggregates(snapshotFixture.points);
  expect(aggregates.uniqueStockTotal).toBe(150_000_000);
  expect(sumMap(aggregates.bySubTheme)).toBe(150_000_000);
  expect(sumMap(aggregates.byTheme)).toBe(150_000_000);
});

it("keeps related mappings available for P3", () => {
  const aggregates = buildCapitalFlowAggregates(snapshotFixture.points);
  expect(aggregates.pointByStockId.has("aa-jsbg")).toBe(true);
  expect(aggregates.pointByStockId.has("cs-jsbg2")).toBe(true);
});

it("omits stocks that have no real point", () => {
  const nodes = buildP3StockRenderNodes({
    voronoiCells: [opticalCell],
    points: snapshotFixture.points,
  });
  expect(nodes.every((node) => node.metric.rawValue !== 5)).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify old synthetic APIs fail expectations**

Run: `npx vitest run src/domain/capitalFlowAggregation.test.ts src/domain/stockRenderNodes.test.ts`

Expected: FAIL because aggregation does not exist and P3 still distributes mock values.

- [ ] **Step 3: Implement shared aggregation**

`buildCapitalFlowAggregates(points)` must:

- Index every point by `stockId` for P3 display.
- Include only `aggregationRole === "primary"` in sums.
- Guard against duplicate primary `securityCode` values by throwing an error.
- Produce `bySubTheme`, `byTheme`, and `uniqueStockTotal`.
- Assert both map sums equal `uniqueStockTotal` within `0.01`.

Change `buildThemeRenderNodes` to accept `capitalByTheme: ReadonlyMap<string, number>`. Change `buildSubThemeRenderNodes` to accept `capitalBySubTheme`. Change `buildP3StockRenderNodes` to accept `points`, find the real point for each registry `stock.id`, skip missing points, and normalize only actual values. Delete the branches that set `distributedValue = 5` or split a sub-theme total 40/60.

- [ ] **Step 4: Run domain tests**

Run: `npx vitest run src/domain/capitalFlowAggregation.test.ts src/domain/themeRenderNodes.test.ts src/domain/subThemeRenderNodes.test.ts src/domain/stockRenderNodes.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the full frontend suite**

Run: `npm test`

Expected: PASS after updating old scenario-based fixtures to explicit capital maps/points.

- [ ] **Step 6: Commit real aggregation**

```bash
git add src/domain/capitalFlowAggregation.ts src/domain/capitalFlowAggregation.test.ts src/domain/themeRenderNodes.ts src/domain/subThemeRenderNodes.ts src/domain/stockRenderNodes.ts src/domain/stockRenderNodes.test.ts
git commit -m "feat: aggregate real stock capital flow"
```

## Task 9: Wire Explicit Data States Into The React App

**Files:**
- Create: `src/components/DataStatus.tsx`
- Create: `src/components/DataStatus.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/ControlsPanel.tsx`
- Modify: `src/components/ControlsPanel.test.tsx`
- Modify: `src/App.css`
- Remove: `src/data/akShareDataProvider.ts`
- Remove: `src/data/akShareDataProvider.test.ts`

- [ ] **Step 1: Write failing loading, partial, error, and date tests**

Mock `capitalFlowDataProvider` before importing `App` and cover:

```ts
it("shows loading before the first snapshot resolves", () => {
  render(<App />);
  expect(screen.getByText("正在读取本地资金流快照…")).toBeInTheDocument();
});

it("shows source date metric and coverage", async () => {
  render(<App />);
  expect(await screen.findByText("数据截至 2026-06-12")).toBeInTheDocument();
  expect(screen.getByText("JQData · 主力净流入")).toBeInTheDocument();
  expect(screen.getByText("覆盖 9 / 10（90.0%）")).toBeInTheDocument();
});

it("shows partial data without replacing it with demo data", async () => {
  render(<App />);
  expect(await screen.findByText("部分股票缺少真实数据")).toBeInTheDocument();
});

it("shows a hard error when no snapshot exists", async () => {
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("没有可用的真实资金流快照");
});
```

Update `ControlsPanel` tests to select `2026-06-11` from a `资金流快照日期` `<select>` and expect `onTradeDateChange("2026-06-11")`.

- [ ] **Step 2: Run component tests and verify old controls fail**

Run: `npx vitest run src/App.test.tsx src/components/DataStatus.test.tsx src/components/ControlsPanel.test.tsx`

Expected: FAIL because the app still renders mock scenarios and period buttons.

- [ ] **Step 3: Implement App data state**

Use this state shape in `App.tsx`:

```ts
type SnapshotViewState =
  | { status: "loading"; previous?: CapitalFlowSnapshot }
  | { status: "ready"; snapshot: CapitalFlowSnapshot }
  | { status: "partial"; snapshot: CapitalFlowSnapshot }
  | { status: "error"; message: string };
```

On mount, fetch status and latest in `useEffect`. Ignore stale responses after unmount. Derive aggregates with `useMemo` from a ready/partial snapshot or `loading.previous`. Render no `HunterScene` during the initial load or error; during a date refresh, retain the previous scene with a loading indicator. Render a retry button in error state that re-runs both requests.

Replace period controls with a date `<select>` populated from `availableTradeDates`. Selecting a date calls `fetchDate` and retains the old scene until the new request resolves while marking the status as loading.

`DataStatus` must render exact source, actual trade date, `net_amount_main` label, coverage, and a partial warning. Remove all imports and runtime uses of `createAkShareDataProvider`, `PERIOD_OPTIONS`, and automatic mock scenarios.

- [ ] **Step 4: Add focused CSS**

Add `.data-status`, `.data-status.partial`, `.data-error`, and `.loading-state` styles using the existing panel colors. Do not redesign the map layout.

- [ ] **Step 5: Run component and full frontend tests**

Run: `npx vitest run src/App.test.tsx src/components/DataStatus.test.tsx src/components/ControlsPanel.test.tsx`

Expected: PASS.

Run: `npm test`

Expected: all frontend tests PASS.

- [ ] **Step 6: Commit the app integration**

```bash
git add src/App.tsx src/App.test.tsx src/App.css src/components/DataStatus.tsx src/components/DataStatus.test.tsx src/components/ControlsPanel.tsx src/components/ControlsPanel.test.tsx src/data/akShareDataProvider.ts src/data/akShareDataProvider.test.ts
git commit -m "feat: show verified capital flow snapshots"
```

## Task 10: Document Setup And Complete End-To-End Verification

**Files:**
- Create: `.env.example`
- Create or Modify: `README.md`
- Modify: `tests/e2e/a-capital-hunter.spec.ts`
- Modify: `playwright.config.ts` only if a deterministic test server command is required
- Review: `server/app.py`
- Review: `scripts/diagnose_data.py`

- [ ] **Step 1: Add deterministic E2E API fixtures**

Update the Playwright test to intercept:

```ts
await page.route("**/api/capital-flow/status", (route) =>
  route.fulfill({ json: statusFixture })
);
await page.route("**/api/capital-flow/snapshot/latest", (route) =>
  route.fulfill({ json: snapshotFixture })
);
```

Assert the page shows `数据截至 2026-06-12`, `JQData · 主力净流入`, the three view buttons, and no “演示数据” text. Remove stale assertions for timeline stage `T4` and “只看主线中心”.

- [ ] **Step 2: Run E2E and verify failures before fixture/UI alignment**

Run the dev server in one terminal: `npm run dev`

Run: `npm run e2e`

Expected before the updated assertions are complete: FAIL on stale scenario text. Expected after fixture alignment: PASS.

- [ ] **Step 3: Document credentials, sync, and operations**

Create `.env.example`:

```text
JQDATA_USERNAME=
JQDATA_PASSWORD=
CAPITAL_FLOW_DB=server/data/capital_flow.sqlite3
```

Document these exact commands in `README.md`:

```bash
python3 -m pip install -r server/requirements.txt
cp .env.example .env
set -a; source .env; set +a
npm run sync:capital-flow
npm run dev:full
npm run test:backend
npm test
npm run build
```

Explain that JQData updates money flow after market close, source values are in ten-thousand CNY and are converted to CNY at ingestion, unsupported/non-A-share entries are hidden, and the old AkShare endpoint is diagnostic only.

Also document the entitlement caveat: JQData trial accounts may restrict the accessible date window. The sync command must report the actual returned trade date and fail clearly when the account cannot access the requested latest day; meeting the daily end-of-day goal may require enabling the corresponding JQData permission.

- [ ] **Step 4: Verify the complete automated suite**

Run: `npm run test:backend`

Expected: PASS.

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript and Vite build PASS; the existing large-chunk warning may remain.

Run with a dev server: `npm run e2e`

Expected: PASS.

- [ ] **Step 5: Perform the real-token acceptance check**

After the user places valid credentials in the environment, run:

```bash
npm run sync:capital-flow
curl -s http://127.0.0.1:5001/api/capital-flow/status
curl -s http://127.0.0.1:5001/api/capital-flow/snapshot/latest
```

Expected:

- Sync exits `0` and reports at least 90% coverage of supported unique securities.
- Status reports source `jqdata`, metric `net_amount_main`, unit `CNY`, and an actual trade date.
- Latest snapshot contains only finite real values and no demo/fallback flag.
- P1, P2, and unique P3 totals match within `0.01` CNY.

Open `http://127.0.0.1:5173` and verify the same trade date, source, metric, and coverage are visible. Temporarily remove network access and refresh: the app must still load the SQLite snapshot because runtime display does not contact JQData.

- [ ] **Step 6: Review legacy diagnostics without overwriting user work**

Confirm `App` has no AkShare import and `/api/capital-flow/rank` is not called by product code. Keep the user’s existing uncommitted `server/app.py` diagnostics and `scripts/diagnose_data.py` unless they conflict with package imports; do not delete or revert them as part of this feature.

- [ ] **Step 7: Commit documentation and acceptance coverage**

```bash
git add .env.example README.md tests/e2e/a-capital-hunter.spec.ts playwright.config.ts
git commit -m "docs: add JQData snapshot operations"
```

## Final Verification

- [ ] Run `git status --short` and confirm no generated SQLite database, credential file, build output, or unrelated user modification is staged.
- [ ] Run `npm run test:backend && npm test && npm run build` and confirm all commands exit `0`.
- [ ] Run `npm run e2e` against the deterministic API fixtures and confirm it exits `0`.
- [ ] Compare implementation against every success criterion in `docs/superpowers/specs/2026-06-13-jqdata-real-capital-flow-design.md`.
- [ ] Use `superpowers:verification-before-completion` before claiming the feature is complete.
