# SP1 — Content Depth: Data-Driven Registry Expansion — Design

**Date:** 2026-06-19
**Status:** Approved (design); spec under review
**Sub-project:** SP1 of the pre-publish optimization set (SP2 dynamic layout, SP3 mobile, SP4 polish, SP5 SEO are separate).

## Goal

Grow the shared registries from **45 sub-themes / 184 stocks** to **~80 concept-anchored sub-themes × ~8 representative stocks (~600 total)**, where every stock's membership is sourced from **real Tushare concept-board constituents** — no fabricated mappings. The 11 narrative themes are unchanged. Everything downstream (aggregation, layout, render, sync) already reads the shared `src/data/*.json`, so no consumer code changes.

## Approved decisions

| Decision | Choice |
|---|---|
| Sourcing | Data-driven: real Tushare concept-board membership; assistant drafts the board mapping, user reviews |
| Board universe | Concept boards (同花顺 `ths_*`, 东方财富 `dc_*` fallback) |
| Scale | ~80 sub-themes (~7/theme) × ~8 stocks ≈ ~600 stocks (~3×) |
| Representativeness ranking | Free-float market cap (`circ_mv`) primary + a liquidity/eligibility floor |
| Dedup | Each stock is `primary` in exactly one sub-theme |
| Themes | Unchanged (11) |

## Architecture & flow

Offline curation → committed registries → existing pipeline unchanged. The token-dependent steps are **run by the user** (their Tushare token, their quota); the assistant builds/tests the tooling with a fake client and drafts the board mapping.

```
[1] preflight + board catalog   (user runs, token)   scripts/generate_registries.py --list-boards
        → verifies ths_member/daily_basic access; writes data/boardCatalog.json (real board names + ts_code)
[2] board mapping (curation)    (assistant drafts → user reviews)   src/data/conceptBoardMapping.json
        → each finer sub-theme → one real board ts_code (+ parent themeId)
[3] generate                    (user runs, token)   scripts/generate_registries.py --build
        → ths_member per board → daily_basic ranking → top ~8 → dedup → emit registries
[4] validate                    (CI/tests)   registry validators (TS + Python)
[5] downstream                  unchanged    aggregation / layout / render / sync read the new JSONs
```

### Components

**`scripts/generate_registries.py`** (new, offline tool; reuses the existing Tushare client from `server/capital_flow/source.py` where possible)
- `--list-boards`: preflight — call the concept-board list + membership + `daily_basic` once each; if any is permission-denied, print a clear entitlement report and exit non-zero (the feasibility gate). On success, write `data/boardCatalog.json` (`[{ts_code, name, member_count}]`).
- `--build`: read `src/data/conceptBoardMapping.json`; for each mapped board, pull members (`ths_member`), join `daily_basic` (latest trade date) for `circ_mv` + liquidity fields; apply the eligibility floor; rank by `circ_mv` desc; take top N (default 8); run the dedup pass; emit `src/data/subThemeRegistry.json` and `src/data/stockRegistry.json`; print a summary (counts, any boards under target, any stocks dropped by dedup/floor).
- Tushare source is injectable (a `BoardMembershipSource` protocol) so unit tests pass a **fake** client — no token needed to test the generator logic. Matches the existing `CapitalFlowSource` seam.

**`src/data/conceptBoardMapping.json`** (new, the one human-curated artifact)
- Schema: `[{ "subThemeId": "...", "name": "...", "shortName": "...", "themeId": "...", "boardTsCode": "...", "boardName": "..." }]`.
- Assistant drafts from `boardCatalog.json` (≈7 sub-themes per theme, board names matched to the narrative); user reviews/corrects. This file is the durable source of curation truth; re-running `--build` regenerates registries from it.

**Generated registries** (existing files, expanded — same schemas)
- `subThemeRegistry.json` entry: `{id, name, shortName, themeId, displayOrder, primarySectorId, areaWeight}`. The generator sets `displayOrder` sequentially within each theme, `primarySectorId` = the parent theme's existing primary sector (deterministic lookup), `areaWeight` = a constant default `0.8` (SP2 later drives this from live heat).
- `stockRegistry.json` entry: `{id, name, shortName, subThemeId, code}`. `id` = a stable slug derived from `code` (e.g. `s-300308`); `code` is the 6-digit board code; name/shortName from `ths_member`.

**Registry validators** (tests; both languages)
- TS (`src/domain/*registry*.test.ts`) and Python (`server/tests/`) assertions: every `code` is 6 digits and normalizes to a security code; every stock's `subThemeId` exists; every sub-theme's `themeId` is one of the 11; ids unique; **no stock `code` appears under more than one sub-theme** (the generator emits each once); every sub-theme has a valid `primarySectorId`.

Note: `aggregationRole` is NOT a registry-JSON field — it is derived in `server/capital_flow/registry.py` (first sighting of a security code → `primary`, repeats → `related`). Because SP1 emits each stock exactly once, every entry resolves to `primary`, no `related` rows arise, and the aggregation invariant (P1==P2==unique-P3, within 0.01 CNY) holds with no special handling.

### Ranking & eligibility (the "representative ~8")

Rank a board's members by **`circ_mv` (free-float market cap) descending**, after excluding ineligible names:
- name contains `ST` / `*ST` (risk-flagged),
- suspended on the reference trade date (no `daily_basic` row, or `amount`/`turnover_rate` is null/0),
- listed < 60 calendar days before the reference date (too new),
- `amount` (daily turnover) below a liquidity floor (default: bottom-decile cutoff computed across all candidates, or an absolute `amount < 50,000` 千元 — tunable constant).

Take the top N (default 8). If a board yields fewer than a `min_stocks` floor (default 3) eligible names, the generator flags it in the summary for manual attention (the user may remap or accept the smaller sub-theme).

### Dedup rule (deterministic; preserves P1==P2==P3)

Concept boards overlap, so a stock can rank into multiple mapped sub-themes. Resolve so each stock is `primary` in exactly one:
1. Candidate (stock, sub-theme) pairs are scored by the stock's rank within that board (1 = top).
2. Assign each stock to the sub-theme where it has the best (lowest) rank; ties broken by the sub-theme's `displayOrder`, then `subThemeId` lexicographic.
3. The stock is emitted once, under its winning sub-theme; it is omitted from the others. A sub-theme that loses members this way is back-filled from its next-ranked eligible candidates until it reaches N (or runs out).

This guarantees no stock is double-counted, so the existing aggregation invariant (P1 theme total == P2 sub-theme total == unique-P3 total, within 0.01 CNY) holds without special handling. Each stock is listed once, so `registry.py` marks every entry `primary` — no `related` rows. (Allowing a stock to appear in multiple boards via the `related` role is deferred to SP2, where it interacts with relationship/layout.)

## Honesty / coverage / quota

- **Honesty:** stock→board membership is 100% real Tushare constituents; the only hand-authored layer is `conceptBoardMapping.json`, which is reviewed. Nothing is fabricated.
- **Coverage rule:** with ~600 securities, the daily snapshot's `succeeded/requested` may occasionally dip below 0.9 (suspensions etc.), yielding a `partial` snapshot — still shown, honestly flagged. The eligibility floor (excluding suspended/illiquid) reduces this risk. No change to the rule.
- **Quota:** ~600 stocks ≈ 3× the batched daily-sync calls. **Contingency (included only if it strains the tier):** switch the daily fetch to a single full-day pull `moneyflow_dc(trade_date=…)` (no `ts_code`) and filter to the registry locally — making the daily sync quota-neutral regardless of registry size. Decision deferred to implementation once the real call volume is measured.

## Testing strategy

- **Generator unit tests** (pytest, fake `BoardMembershipSource`): ranking honors `circ_mv`; eligibility floor excludes ST/suspended/new/illiquid; dedup assigns one primary and back-fills; under-target boards are flagged; emitted JSON matches the registry schemas.
- **Registry validators** (TS + Python): the invariants above; run in CI against the committed registries so a bad hand-edit fails the build.
- **Aggregation-invariant test** (existing, extended): P1==P2==unique-P3 on the expanded registry via `buildCapitalFlowAggregates`.
- **Preflight** is exercised manually by the user (needs the token); its report format is unit-tested with a fake client (permission-denied path → clear message + non-zero exit).

## Manual / human-in-loop touchpoints (made explicit)

1. User runs `--list-boards` (token) → shares/commits `data/boardCatalog.json`.
2. Assistant drafts `conceptBoardMapping.json` from the catalog → user reviews/corrects (the curation gate).
3. User runs `--build` (token) → registries regenerated → user spot-checks the summary → commit.

## Entitlement risk & fallback

The one hard dependency is Tushare concept-membership access (`ths_member`/`dc_member`) + `daily_basic`. Preflight (`--list-boards`) determines this immediately. If unavailable on the user's tier:
- **Fallback A:** use 申万 industry membership (`index_classify` + `index_member_all`, lower entitlement) for boards that have no accessible concept equivalent — a per-board fallback, not a wholesale switch.
- **Fallback B:** narrow the scale to the boards that ARE accessible.
The board mapping records, per sub-theme, which membership source was used, so the honesty/source is auditable.

## Out of scope (other sub-projects / later)

- SP2: heat-driven dynamic layout (will replace the default `areaWeight` and may expand `relationshipRegistry` edges for the new sub-themes).
- SP3 mobile, SP4 polish, SP5 SEO.
- Changing the 11 themes; expanding `relationshipRegistry` comovement edges (left to SP2).
- Productionizing the generator beyond an offline curation script (YAGNI).

---

## ADDENDUM (2026-06-21): Hybrid fallback — entitlement-driven pivot

**Why:** Preflight showed the user's Tushare tier **cannot** access concept-board
membership (`ths_index` and `dc_index` both denied). It **can** access
`stock_basic`, `daily_basic` (circ_mv), and 申万 `index_classify`/`index_member_all`.
The owner chose the **hybrid** fallback (curate + verify) over pure 申万 industry
membership (too mechanical) and over upgrading the Tushare tier. This preserves
the narrative 题材 structure and works within the current tier. The capital-flow
**numbers remain 100% real** (from the sync); only the taxonomy *sourcing* changes
— and the current registry was already hand-curated this way, so this is
consistent, not a downgrade.

**Approach (draft → verify → emit):**
1. **Assistant drafts** `src/data/registryDraft.json`: for each of the 11 themes,
   ~7 sub-themes, each with a candidate list `{code, name}` (my intended 6-digit
   code + intended company name), ~10-12 candidates per sub-theme (over-provision
   so eligibility filtering + dedup still yields ~8).
2. **Tool verifies** (`--build-hybrid`, run by the user with their token):
   pulls `basics(ref_date)` (stock_basic name/list_date + daily_basic circ_mv +
   daily amount), indexes it by 6-digit code, and for each drafted candidate:
   - **drops + reports** codes not found in `basics` (not a real/liquid A-share),
   - **reports a name mismatch** when the resolved `stock_basic` name differs from
     my drafted name (catches mis-typed codes that resolve to the wrong company),
   - applies the existing eligibility floor (ST/suspended/new/illiquid),
   - ranks eligible by `circ_mv`, takes top N, dedups to one sub-theme per stock.
3. **Emits** the registries using the **resolved real names** from `stock_basic`
   (never my labels), so the committed data is ground-truth.
4. **User reviews** the build report (unverified codes, name mismatches,
   under-target sub-themes) and the final registry; I fix the draft and rebuild
   until clean.

**Tooling delta from the board-based plan:** `registry_builder.py` (rank /
eligibility / dedup / emit) is unchanged. `board_source.basics()` is reused
as-is. New: `run_build_hybrid(source, draft, ...)` in the generator that takes
candidate codes from the draft (indexed into `basics` by 6-digit code) instead of
`board_members`, and produces the verification report; a `--build-hybrid` CLI
mode. `list_boards`/`board_members`/`--list-boards`/`--build` remain for a future
concept-board path but are not used here.

**Honesty:** every emitted stock is a verified, liquid, real A-share with its real
name; the sub-theme assignment is editorial (as the registry always was) and
user-reviewed; the name-mismatch report prevents a mistyped code from silently
mislabelling. No fabricated numbers anywhere.
