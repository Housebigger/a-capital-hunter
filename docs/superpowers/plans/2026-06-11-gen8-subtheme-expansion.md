# Gen8 SubTheme Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand each theme from 2-3 SubThemes to 3-8 SubThemes, update all downstream data (sectors, stocks, layout engine params), ensuring P2 view renders cleanly.

**Architecture:** Data-first approach — expand subThemeRegistry first, then update sector→subThemeId mappings in themeRegistry, then update stock→subThemeId in stockRegistry, then tune layout engine parameters for denser SubTheme grids, finally update tests.

**Tech Stack:** TypeScript (strict), Vitest 3 (jsdom)

---

## Current State

- 11 themes, 30 SubThemes (2-3 per theme), 81 sectors, 76 stocks
- P1: 11 theme cells, P2: ~30 subtheme cells

## Target State

Each theme gets 3-8 SubThemes based on sector count and thematic subdivision potential:

| Theme | Sectors | Current ST | Target ST |
|-------|---------|-----------|-----------|
| ai-computing | 9 | 3 | 5 |
| robotics-physical-ai | 8 | 3 | 4 |
| low-altitude-economy | 7 | 2 | 4 |
| semiconductors | 8 | 3 | 5 |
| new-energy | 7 | 3 | 4 |
| defense-aerospace | 7 | 3 | 4 |
| innovative-medicine | 6 | 3 | 3 |
| new-energy-vehicles | 8 | 3 | 5 |
| consumer-electronics | 7 | 2 | 4 |
| digital-economy | 8 | 3 | 4 |
| fintech | 6 | 2 | 3 |

**Total: ~49 SubThemes** (up from 30)

---

### Task 1: Expand SubTheme Registry

**Files:**
- Modify: `src/domain/subThemeRegistry.ts`

Add new SubTheme entries and split existing ones. Keep all existing IDs unchanged.

- [ ] **Step 1: Add new SubThemes to subThemeRegistry.ts**

New SubThemes to add (keeping all existing ones):

```
AI算力 (+2 → 5 total):
  - "optical-interconnect" — 光互连 (optical-modules, cpo)
  - "liquid-cooling-infra" — 液冷基础设施 (liquid-cooled-servers, data-centers)

机器人/物理AI (+1 → 4 total):
  - "motion-control" — 运动控制 (servo-systems, actuators)

低空经济 (+2 → 4 total):
  - "drone-systems" — 无人机系统 (drones, flight-control-systems)
  - "low-alt-comm" — 低空通信导航 (low-altitude-communication, air-traffic-systems)

半导体 (+2 → 5 total):
  - "materials-process" — 材料工艺 (photoresist)
  - "chip-arch" — 芯片架构 (chiplet, hbm)

新能源 (+1 → 4 total):
  - "battery-tech" — 电池技术 (power-batteries, solid-state-batteries)

军工/商业航天 (+1 → 4 total):
  - "defense-informatics-st" — 军工信息化 (defense-informatics)

新能源汽车 (+2 → 5 total):
  - "electric-drive" — 电驱动 (electric-drive-systems)
  - "smart-cockpit-st" — 智能座舱 (smart-cockpit, automotive-chips)

消费电子 (+2 → 4 total):
  - "vr-ar" — VR/AR (vr-ar-devices, wearable-devices)
  - "optical-acoustic" — 光学声学 (optical-lenses, acoustic-devices)

数字经济 (+1 → 4 total):
  - "security-software" — 安全软件 (data-security, cybersecurity)

金融科技 (+1 → 3 total):
  - "digital-finance" — 数字金融 (digital-currency, financial-ai)
```

- [ ] **Step 2: Run subTheme registry tests**

Run: `npx vitest run src/domain/subThemeRegistry.test.ts`
Expected: FAIL (count assertion 27-33 needs update → fix in Task 5)

- [ ] **Step 3: Commit**

```bash
git add src/domain/subThemeRegistry.ts
git commit -m "feat: expand SubTheme registry to ~49 entries (Gen8)"
```

---

### Task 2: Update Sector → SubThemeId Mappings

**Files:**
- Modify: `src/domain/themeRegistry.ts`

Update the `subThemeId` field on sectors to distribute them among the new finer-grained SubThemes.

- [ ] **Step 1: Update sector subThemeId assignments**

Key reassignments:

```
AI算力:
  optical-modules → "optical-interconnect" (was ai-computing-infra)
  cpo → "optical-interconnect" (was ai-computing-infra)
  liquid-cooled-servers → "liquid-cooling-infra" (was ai-computing-infra)
  data-centers → "liquid-cooling-infra" (was ai-computing-infra)

机器人:
  servo-systems → "motion-control" (was core-components)
  actuators → "motion-control" (was core-components)

低空经济:
  flight-control-systems → "drone-systems" (was aircraft-control)
  drones → "drone-systems" (was aircraft-control)
  low-altitude-communication → "low-alt-comm" (was operations-infra)
  air-traffic-systems → "low-alt-comm" (was operations-infra)

半导体:
  photoresist → "materials-process" (was equipment-materials)
  chiplet → "chip-arch" (was advanced-packaging-st)
  hbm → "chip-arch" (was advanced-packaging-st)

新能源:
  power-batteries → "battery-tech" (was storage-battery)
  solid-state-batteries → "battery-tech" (was storage-battery)

军工:
  defense-informatics → "defense-informatics-st" (was navigation-electronics)

新能源汽车:
  electric-drive-systems → "electric-drive" (was vehicle-powertrain)
  smart-cockpit → "smart-cockpit-st" (was autonomous-driving-st)
  automotive-chips → "smart-cockpit-st" (was autonomous-driving-st)

消费电子:
  vr-ar-devices → "vr-ar" (was terminal-devices)
  wearable-devices → "vr-ar" (was terminal-devices)
  optical-lenses → "optical-acoustic" (was core-components-ce)
  acoustic-devices → "optical-acoustic" (was core-components-ce)

数字经济:
  data-security → "security-software" (was data-elements-st)
  cybersecurity → "security-software" (was xinchuang)

金融科技:
  digital-currency → "digital-finance" (was fin-applications)
  financial-ai → "digital-finance" (was fin-infra)
```

- [ ] **Step 2: Run theme registry tests**

Run: `npx vitest run src/domain/themeRegistry.test.ts`
Expected: PASS (tests check validity, not specific IDs)

- [ ] **Step 3: Commit**

```bash
git add src/domain/themeRegistry.ts
git commit -m "refactor: update sector→subThemeId for finer SubTheme granularity"
```

---

### Task 3: Update Stock → SubThemeId Assignments

**Files:**
- Modify: `src/domain/stockRegistry.ts`

Redistribute stocks among new SubThemes. Add ~6-8 new stocks for the new SubThemes that need them (each SubTheme needs ≥3 stocks).

- [ ] **Step 1: Update stock subThemeId assignments and add new stocks**

Reassign existing stocks and add new ones for SubThemes with < 3 stocks.

- [ ] **Step 2: Run stock registry tests**

Run: `npx vitest run src/domain/stockRegistry.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/domain/stockRegistry.ts
git commit -m "refactor: update stock→subThemeId, add stocks for new SubThemes"
```

---

### Task 4: Tune Voronoi Layout Engine for Denser SubThemes

**Files:**
- Modify: `src/domain/voronoiLayoutEngine.ts` (spread parameter)

The current `placeSubThemeCenters` uses `spread = avgDistFromCenter * 0.18`. With up to 8 SubThemes per theme, the angular spacing becomes tighter. Increase spread ratio to ~0.25 so SubTheme cells don't collapse into slivers.

- [ ] **Step 1: Adjust spread ratio**

In `placeSubThemeCenters`, change spread from `0.18` to `0.25`:

```typescript
const spread = avgDistFromCenter(themeCell.polygon, center) * 0.25;
```

- [ ] **Step 2: Adjust cityBorderGap**

In `src/domain/voronoiLayoutProvider.ts`, reduce `cityBorderGap` from `0.03` to `0.02`:

```typescript
options: {
  mapRadius: 11,
  cityBorderGap: 0.02,
  smoothIterations: 1,
}
```

- [ ] **Step 3: Run layout tests**

Run: `npx vitest run src/domain/voronoiLayoutEngine.test.ts src/domain/voronoiLayoutProvider.test.ts`
Expected: Most pass, count assertions may need update

- [ ] **Step 4: Commit**

```bash
git add src/domain/voronoiLayoutEngine.ts src/domain/voronoiLayoutProvider.ts
git commit -m "tune: adjust spread ratio and border gap for denser SubTheme grids"
```

---

### Task 5: Update Tests

**Files:**
- Modify: `src/domain/subThemeRegistry.test.ts`
- Modify: `src/domain/voronoiLayoutEngine.test.ts` (if needed)
- Modify: `src/domain/voronoiLayoutProvider.test.ts` (if needed)

- [ ] **Step 1: Update subTheme count assertion**

In `subThemeRegistry.test.ts`, change:
```typescript
expect(subThemes.length).toBeGreaterThanOrEqual(27);
expect(subThemes.length).toBeLessThanOrEqual(33);
```
to:
```typescript
expect(subThemes.length).toBeGreaterThanOrEqual(45);
expect(subThemes.length).toBeLessThanOrEqual(55);
```

- [ ] **Step 2: Update Voronoi cell count assertions**

Check `voronoiLayoutEngine.test.ts` and `voronoiLayoutProvider.test.ts` — the `expect(result.cells.length).toBe(subThemes.length)` assertions should auto-adjust since they reference `subThemes.length`. Verify they pass.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: update assertions for Gen8 SubTheme expansion"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Start dev server**

Run: `npx vite --port 5173`

- [ ] **Step 2: Manual review**

Open http://localhost:5173:
- P1: 11 theme cells render normally
- P2: ~49 subtheme cells render, each contained within its parent theme polygon
- All labels readable
- Golden breathing lines visible
- No overlapping or out-of-bounds cells

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix: Gen8 visual adjustments"
```
