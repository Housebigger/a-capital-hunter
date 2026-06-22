# SP5 — Share / SEO Meta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site shareable + discoverable — `index.html` title/description + Open Graph/Twitter tags, a favicon, a 1200×630 share image, and robots.txt — static and presentation-only, with an honesty-framed description.

**Architecture:** All metadata lives in `index.html`; static assets live in a new `public/` dir that Vite copies to the deploy root. Crawler-facing URLs (`og:*`, `canonical`) are full absolute `https://housebigger.github.io/a-capital-hunter/…`; favicon links use Vite's `%BASE_URL%` so they resolve under the `/a-capital-hunter/` base. A Vitest guard asserts the tags stay present. No app/data/backend changes.

**Tech Stack:** Vite 6 (static `public/`, `%BASE_URL%`, `build:pages` sets `--base=/a-capital-hunter/`), Vitest, macOS `sips`/`qlmanage` for image generation.

**Spec:** `docs/superpowers/specs/2026-06-22-share-seo-meta-design.md`

**Branch:** `feat/share-seo-meta` (Task 0).

**Key facts (verified):**
- `index.html` currently: `<!doctype html><html lang="zh-CN">` with charset, viewport, `<title>A Capital Hunter</title>`, `#root`, `<script type="module" src="/src/main.tsx">`. No description/OG/favicon.
- Deploy: GitHub Pages project site; `npm run build:pages` = `tsc && vite build --base=/a-capital-hunter/`. No `public/` dir exists yet. Site URL `https://housebigger.github.io/a-capital-hunter/`.
- `image_log/` holds ~3 MB PNG screenshots (e.g. `Screenshot 2026-06-19 at 07.57.26.png`) — source for the OG card.
- Vite substitutes `%BASE_URL%` in `index.html` at build (→ `/a-capital-hunter/`); a bare `/favicon.svg` would 404 under the base.
- `vitest.config` excludes `node_modules`/`dist`/`.worktrees`/`tests/e2e` — a test in `src/` reading `index.html` via `node:fs` runs in Node with cwd = repo root.

---

## File structure

| File | Responsibility |
|---|---|
| `index.html` (modify) | Title, description, theme-color, canonical, OG, Twitter, favicon links. |
| `src/test/indexHtmlMeta.test.ts` (new) | Vitest guard: required tags present. |
| `public/favicon.svg` (new) | On-brand SVG favicon (inflow/outflow bar motif). |
| `public/robots.txt` (new) | Allow all crawlers. |
| `public/og-image.png` (new, generated) | 1200×630 share card from a screenshot. |
| `public/apple-touch-icon.png` (new, generated, best-effort) | 180×180 iOS icon. |

---

### Task 0: Feature branch

- [ ] **Step 1**
```bash
cd /Users/housebigger/Documents/01_work/playground_claude_code/ws_a_capital_hunter
git checkout main && git checkout -b feat/share-seo-meta
git status -sb   # ## feat/share-seo-meta
```

---

### Task 1: `index.html` meta + presence test (TDD)

**Files:** Create `src/test/indexHtmlMeta.test.ts`; Modify `index.html`

- [ ] **Step 1: Write the failing test**

Create `src/test/indexHtmlMeta.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");

describe("index.html SEO / share meta", () => {
  const patterns: ReadonlyArray<readonly [string, RegExp]> = [
    ["title", /<title>[^<]*A Capital Hunter[^<]*<\/title>/],
    ["description", /<meta name="description" content="[^"]{20,}"/],
    ["theme-color", /<meta name="theme-color" content="#10151b"/],
    ["canonical", /<link rel="canonical" href="https:\/\/housebigger\.github\.io\/a-capital-hunter\/"/],
    ["icon (base-relative)", /<link rel="icon"[^>]*href="%BASE_URL%favicon\.svg"/],
    ["og:title", /<meta property="og:title" content="[^"]+"/],
    ["og:description", /<meta property="og:description" content="[^"]+"/],
    ["og:url", /<meta property="og:url" content="https:\/\/housebigger\.github\.io\/a-capital-hunter\/"/],
    ["og:image (absolute)", /<meta property="og:image" content="https:\/\/housebigger\.github\.io\/a-capital-hunter\/og-image\.[a-z]+"/],
    ["og:image:width", /<meta property="og:image:width" content="1200"/],
    ["twitter:card", /<meta name="twitter:card" content="summary_large_image"/],
    ["twitter:image (absolute)", /<meta name="twitter:image" content="https:\/\/housebigger\.github\.io\/a-capital-hunter\/og-image\.[a-z]+"/],
  ];
  it.each(patterns)("has %s", (_label, re) => {
    expect(html).toMatch(re);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/indexHtmlMeta.test.ts`
Expected: FAIL — current `index.html` has none of these tags.

- [ ] **Step 3: Implement — replace `index.html`**

Overwrite `index.html` with:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>A主猎人 · A Capital Hunter — A股主力资金动向捕捉神器</title>
    <meta
      name="description"
      content="A主猎人：把 A 股主力资金净流入映射到交互式 3D 曲面的数据可视化。按主线 / 子题材 / 个股三级钻取，查看真实收盘资金动向。仅为数据可视化，非投资建议。"
    />
    <meta name="theme-color" content="#10151b" />
    <link rel="canonical" href="https://housebigger.github.io/a-capital-hunter/" />
    <link rel="icon" type="image/svg+xml" href="%BASE_URL%favicon.svg" />
    <link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="A主猎人 · A Capital Hunter" />
    <meta property="og:title" content="A主猎人 · A Capital Hunter — A股主力资金动向捕捉神器" />
    <meta
      property="og:description"
      content="把 A 股主力资金净流入映射到交互式 3D 曲面的数据可视化；主线 / 子题材 / 个股三级钻取。仅为数据可视化，非投资建议。"
    />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:url" content="https://housebigger.github.io/a-capital-hunter/" />
    <meta property="og:image" content="https://housebigger.github.io/a-capital-hunter/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="A主猎人 · A Capital Hunter" />
    <meta
      name="twitter:description"
      content="A 股主力资金动向的交互式 3D 数据可视化。仅为数据可视化，非投资建议。"
    />
    <meta name="twitter:image" content="https://housebigger.github.io/a-capital-hunter/og-image.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
> Keep the `<script src="/src/main.tsx">` line EXACTLY as-is (Vite rewrites it at build). The `og-image` extension here is `.png`; if Task 3 produces a `.jpg` for size, update both `og:image` and `twitter:image` to `.jpg` (the test regex accepts either).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/test/indexHtmlMeta.test.ts` → PASS (12).

- [ ] **Step 5: Commit**
```bash
git add index.html src/test/indexHtmlMeta.test.ts
git commit -m "feat: SEO/share meta in index.html (title, description, OG, Twitter, canonical)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `public/` text assets (favicon.svg, robots.txt)

**Files:** Create `public/favicon.svg`, `public/robots.txt`

- [ ] **Step 1: Create `public/favicon.svg`**
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="A主猎人">
  <rect width="32" height="32" rx="7" fill="#10151b" />
  <rect x="9" y="6" width="5" height="13" rx="1.5" fill="#e64646" />
  <rect x="18" y="13" width="5" height="13" rx="1.5" fill="#2fa66a" />
</svg>
```
(Dark rounded square + a tall red up-bar and a green down-bar — the inflow/outflow motif.)

- [ ] **Step 2: Create `public/robots.txt`**
```
User-agent: *
Allow: /
```

- [ ] **Step 3: Verify**
Run: `ls public/` → shows `favicon.svg robots.txt`. (No test; covered by the build check in Task 4.)

- [ ] **Step 4: Commit**
```bash
git add public/favicon.svg public/robots.txt
git commit -m "feat: favicon (inflow/outflow motif) + robots.txt"
```

---

### Task 3: Generate `og-image` + `apple-touch-icon`

**Files:** Create `public/og-image.png`, `public/apple-touch-icon.png` (binary, via macOS tools)

- [ ] **Step 1: Pick a source screenshot**
List `image_log/*.png` and pick the clearest full 3D-map view. Set a shell var:
```bash
SRC="image_log/Screenshot 2026-06-19 at 07.57.26.png"   # adjust to the chosen file
[ -f "$SRC" ] && echo OK || echo "pick a real file from: $(ls image_log/*.png)"
```

- [ ] **Step 2: Make the 1200×630 OG card** (resize-to-width, then center-crop height)
```bash
cp "$SRC" /tmp/og-src.png
sips --resampleWidth 1200 /tmp/og-src.png --out /tmp/og-1200.png   # → 1200 × (proportional, >630 for a landscape source)
sips -c 630 1200 /tmp/og-1200.png --out public/og-image.png        # center-crop to 1200×630
sips -g pixelWidth -g pixelHeight public/og-image.png              # MUST report 1200 × 630
ls -lh public/og-image.png                                         # prefer < 300 KB
```
If `> ~400 KB`, convert to JPG and update `index.html`'s `og:image`/`twitter:image` to `og-image.jpg`:
```bash
sips -s format jpeg -s formatOptions 80 public/og-image.png --out public/og-image.jpg && rm public/og-image.png
```
> If the chosen screenshot is portrait or < 630 px tall after width-resize, pick a wider/taller one, or resize by height first (`--resampleHeight 630` then `-c 630 1200`). The acceptance is: `public/og-image.*` is exactly 1200×630.

- [ ] **Step 3: Make the 180×180 apple-touch-icon** (best-effort; rasterize the favicon motif)
```bash
qlmanage -t -s 180 -o /tmp public/favicon.svg >/dev/null 2>&1 && \
  sips -z 180 180 /tmp/favicon.svg.png --out public/apple-touch-icon.png && \
  sips -g pixelWidth -g pixelHeight public/apple-touch-icon.png
```
If `qlmanage` produces a poor/empty result, fall back to a 180×180 center-crop of the OG source:
```bash
sips --resampleHeight 180 /tmp/og-src.png --out /tmp/atouch.png && sips -c 180 180 /tmp/atouch.png --out public/apple-touch-icon.png
```
> apple-touch-icon is a nice-to-have (iOS home-screen). If neither path yields a clean icon, it's acceptable to drop the `apple-touch-icon` `<link>` from `index.html` — note it in the report. The favicon.svg covers all modern browsers.

- [ ] **Step 4: Commit**
```bash
git add public/og-image.* public/apple-touch-icon.png
git commit -m "feat: 1200x630 OG share image + apple-touch-icon"
```

---

### Task 4: Build verification + full gate

- [ ] **Step 1: Build for Pages**
```bash
npm run build:pages 2>&1 | tail -3   # succeeds
```

- [ ] **Step 2: Verify the built output**
```bash
# %BASE_URL% resolved to the base path in the built HTML:
grep -o 'href="/a-capital-hunter/favicon.svg"' dist/index.html && echo "favicon base OK"
# absolute crawler URLs preserved:
grep -o 'https://housebigger.github.io/a-capital-hunter/og-image\.[a-z]*' dist/index.html && echo "og:image abs OK"
# static assets copied to the deploy root:
ls dist/favicon.svg dist/robots.txt dist/og-image.* dist/apple-touch-icon.png 2>/dev/null
```
Expected: favicon href rewritten to `/a-capital-hunter/favicon.svg`; `og:image` still the full `https://…` URL; the four assets present in `dist/`.

- [ ] **Step 3: Full gate**
```bash
npm test 2>&1 | grep -E "Test Files|Tests "    # ~207 (206 + the meta test file)
npx tsc --noEmit 2>&1 | tail -1                # clean
python3 -m pytest server/tests -q 2>&1 | tail -1   # 90
```

- [ ] **Step 4: Commit (only if anything changed)** — usually nothing to commit here; this task is verification.

---

### Task 5: Final review + finish branch

- [ ] **Step 1:** Dispatch a final whole-branch review (gate + spec coverage + honesty: description says "数据可视化 / 非投资建议"; absolute vs `%BASE_URL%` URL split correct; assets build into `dist/`; no app/data/backend change).
- [ ] **Step 2:** User check — after merge + deploy, paste the live URL into a share debugger (opengraph.xyz / platform card preview) to confirm the card renders; confirm the favicon shows. (Also requires GitHub Pages enabled + `TUSHARE_TOKEN` secret — user owns that; out of scope.)
- [ ] **Step 3:** Use **superpowers:finishing-a-development-branch** to merge `feat/share-seo-meta` → `main`.

---

## Self-review

**Spec coverage:** title/description/theme-color/canonical → Task 1; OG/Twitter tags → Task 1; absolute-vs-`%BASE_URL%` URL handling → Task 1 (index) + Task 4 (build verify); favicon.svg + robots.txt → Task 2; og-image 1200×630 + apple-touch-icon → Task 3; meta-presence test → Task 1; honesty framing → Task 1 copy. ✅ All spec sections mapped.

**Placeholder scan:** Task 3 image generation gives exact `sips`/`qlmanage` commands + an acceptance check (exactly 1200×630) + fallbacks; the screenshot filename is a concrete example with a "pick a real file" guard (the exact file varies, so the implementer selects + verifies). apple-touch-icon is explicitly best-effort with a documented drop-path. No TBD/TODO; all code/commands present.

**Type/name consistency:** site URL `https://housebigger.github.io/a-capital-hunter/` and asset name `og-image.png` (or `.jpg`) are identical across `index.html`, the test regex (`og-image\.[a-z]+`), and the build-verify grep. Favicon path `%BASE_URL%favicon.svg` in index.html ↔ `/a-capital-hunter/favicon.svg` in the build check. `public/` asset names match across Tasks 2/3/4.
