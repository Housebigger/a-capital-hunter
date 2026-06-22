# SP5 — Share / SEO Meta — Design

**Date:** 2026-06-22
**Status:** Approved (design); spec under review
**Sub-project:** SP5 of the pre-publish optimization set (SP1 content, SP2 heat layout, SP3 mobile, SP4 UI polish done — SP5 is the last).

## Goal

Make the site shareable and discoverable: proper `<title>` + meta description, Open Graph + Twitter card tags with a share image, a favicon, and `robots.txt`. Static and presentation-only — almost entirely `index.html` + a few `public/` assets; no app/data/backend/layout changes. Honesty preserved: the description states it's a data visualization, **not investment advice**.

## Approved decisions

| Decision | Choice |
|---|---|
| Public URL | **`https://housebigger.github.io/a-capital-hunter/`** (GitHub Pages project site; base `/a-capital-hunter/` unchanged) |
| Share image | **1200×630 card cropped from an `image_log` screenshot** (the real 3D map) → `public/og-image.*` |
| Description tone | **Honesty framing** — "数据可视化 · 非投资建议", consistent with the in-app `SiteDisclaimer` |
| Constraint | Static/presentation-only; no app/data/backend/layout/registry changes |

## 1. `index.html` head tags

- **Title:** `A主猎人 · A Capital Hunter — A股主力资金动向捕捉神器`
- **Description:** `A主猎人：把 A 股主力资金净流入映射到交互式 3D 曲面的数据可视化。按主线 / 子题材 / 个股三级钻取，查看真实收盘资金动向。仅为数据可视化，非投资建议。`
- `<meta name="theme-color" content="#10151b">` (matches the app background).
- `<link rel="canonical" href="https://housebigger.github.io/a-capital-hunter/">`.
- `lang="zh-CN"` — already set; keep.
- **Open Graph:** `og:type=website`, `og:site_name="A主猎人 · A Capital Hunter"`, `og:title`, `og:description`, `og:locale=zh_CN`, `og:url` (full absolute), `og:image` (full absolute), `og:image:width=1200`, `og:image:height=630`.
- **Twitter:** `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image` (full absolute).

### URL handling (load-bearing correctness)
The site is served under the base path `/a-capital-hunter/`. Therefore:
- **Crawler-facing absolute URLs** — `og:url`, `og:image`, `twitter:image`, `canonical` — use the **full** `https://housebigger.github.io/a-capital-hunter/…` URL (crawlers don't resolve relative paths). The og/twitter image URL is `https://housebigger.github.io/a-capital-hunter/og-image.png`.
- **Browser-loaded icon links** — favicon / apple-touch-icon — use Vite's **`%BASE_URL%`** placeholder (e.g. `href="%BASE_URL%favicon.svg"`), which Vite substitutes with `/a-capital-hunter/` at build so the asset resolves under the base. (A bare `/favicon.svg` would 404 on the subpath.)

## 2. `public/` assets (new `public/` dir — Vite copies it to the deploy root)

- **`favicon.svg`** — a small on-brand SVG mark: a dark rounded square (`#10151b`) with a red upward bar + a green downward bar (the inflow/outflow motif). Crisp at all sizes, tiny, no binary. Referenced via `%BASE_URL%favicon.svg`.
- **`apple-touch-icon.png`** — 180×180 PNG for iOS home-screen (derived from the favicon motif). Referenced via `%BASE_URL%apple-touch-icon.png`.
- **`og-image.png`** (or `.jpg` if smaller) — the 1200×630 share card (see §3). Kept reasonably small (~150–250 KB; use JPG if PNG is too large for a photographic screenshot).
- **`robots.txt`** — allow all crawlers; reference the site host. (Single-page site → **no sitemap.xml**, YAGNI; trivial to add later.)

## 3. OG share image generation

- Pick the most representative `image_log` screenshot (a clear 3D map view). Produce `public/og-image.*` at **1200×630** using macOS `sips` (built-in): resize to cover then crop to the 1.9:1 card (or resize-to-fit on a dark canvas). Verify the output is exactly 1200×630 and a reasonable file size (prefer < 300 KB; convert to JPG if the PNG is large). The source screenshots are ~3 MB PNGs, so downscaling shrinks them substantially.
- The image is decorative/social-only; no text overlay required (the card title/description come from the meta tags).

## 4. Testing

- **Vitest meta-presence guard** (`src/test/indexHtmlMeta.test.ts` or similar): read `index.html` from disk and assert the required tags are present and non-empty — `<title>`, `meta[name=description]`, `meta[name=theme-color]`, `link[rel=canonical]`, `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`, `twitter:image`. A cheap regression guard so the metadata can't silently disappear.
- **Not unit-testable:** the actual share-card rendering (Open Graph) and favicon display → verified by the user via a share-link debugger (e.g. opengraph.xyz / platform preview) after deploy, plus a local `npm run build:pages` + preview to confirm paths resolve under the base.
- All existing ~206 frontend + 90 backend tests stay green (no app code touched).

## Honesty & invariants (preserved)

- The description explicitly frames the site as a **data visualization, not investment advice** — matching the in-app `SiteDisclaimer` and the project's honesty rule. No fabricated metrics or claims in metadata.
- No data/heat/layout/registry/backend changes; SP1–SP4 behavior untouched. The build (`build:pages`, base `/a-capital-hunter/`) is unchanged except for the new static assets it now copies.

## Out of scope

- Custom domain (chose GitHub Pages default).
- Structured data / JSON-LD, multi-page sitemap, analytics/tracking.
- GitHub Pages enablement + the `TUSHARE_TOKEN` CI secret (deploy-ops the user owns; documented in STATUS/README).
- Any app, data, layout, or backend change.
