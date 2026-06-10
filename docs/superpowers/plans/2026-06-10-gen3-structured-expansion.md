# Gen3 Structured Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand A Capital Hunter from 42 sectors / 7 themes to ~90 sectors / 11 themes with a SubTheme layer, country-map terrain base, and richer cross-theme relationships.

**Architecture:** Bottom-up layered implementation — domain types → registries → layout engine → render nodes → 3D scene → UI panels. Each layer is independently testable. Data registries are pure frozen data; the layout engine is pure functions; components consume immutable render nodes.

**Tech Stack:** React 19, TypeScript (strict), Three.js via @react-three/fiber + @react-three/drei, Vitest 3, Vite 6.

**Spec:** `docs/superpowers/specs/2026-06-10-a-capital-hunter-gen3-design.md`

---

## File Structure

### New Files
- `src/domain/subThemeRegistry.ts` — ~30 SubTheme definitions
- `src/domain/subThemeRegistry.test.ts` — SubTheme validation tests

### Modified Files
- `src/domain/types.ts` — SubTheme interface, subThemeId on Sector, expanded RelationshipType, new LayoutCell role
- `src/domain/themeRegistry.ts` — 4 new themes, ~48 new sectors, subThemeId on all sectors
- `src/domain/relationshipRegistry.ts` — 2 new relationship types, ~80-110 new edges
- `src/domain/layoutStages.ts` — 2 new stages, updated heat for new themes
- `src/domain/algorithmicLayoutEngine.ts` — SubTheme anchor step, larger grid, dual-layer pull
- `src/domain/layoutProvider.ts` — Gen3 parameters
- `src/domain/renderNodes.ts` — Pass SubTheme info, focus mode logic
- `src/state/useHunterState.ts` — Focus mode state
- `src/components/CapitalMapScene.tsx` — Country-map terrain, label density, focus mode
- `src/components/ControlsPanel.tsx` — 11 themes, 5 stages
- `src/components/InspectorPanel.tsx` — SubTheme info, 5 colored relationship types

### Test Files (all modified)
- `src/domain/themeRegistry.test.ts`
- `src/domain/relationshipRegistry.test.ts`
- `src/domain/layoutStages.test.ts`
- `src/domain/algorithmicLayoutEngine.test.ts`
- `src/domain/layoutProvider.test.ts`
- `src/domain/renderNodes.test.ts`

---

### Task 1: Update Domain Types

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Add SubTheme interface and expand RelationshipType**

At the top of `types.ts`, replace the `RelationshipType` line:

```typescript
// BEFORE:
export type RelationshipType = "industrial-chain" | "market-comovement" | "heat-correction";

// AFTER:
export type RelationshipType =
  | "industrial-chain"
  | "market-comovement"
  | "heat-correction"
  | "policy-linkage"
  | "capital-flow";
```

Add the `SubTheme` interface after the `Theme` interface:

```typescript
export interface SubTheme {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly themeId: ThemeId;
  readonly displayOrder: number;
  readonly primarySectorId: SectorId;
}
```

- [ ] **Step 2: Add subThemeId to Sector interface**

Add `subThemeId` field to the `Sector` interface:

```typescript
export interface Sector {
  readonly id: SectorId;
  readonly name: string;
  readonly shortName: string;
  readonly primaryThemeId: ThemeId;
  readonly subThemeId: string;        // NEW
  readonly relatedThemeIds: readonly ThemeId[];
  readonly aliases: readonly string[];
  readonly industrialChainRole: string;
  readonly isThemeCenter: boolean;
  readonly relationshipNote: string;
}
```

- [ ] **Step 3: Expand LayoutCell role and add SubTheme fields**

Update `LayoutCell` to include `sub-theme-center` role and SubTheme info:

```typescript
export interface LayoutCell {
  sectorId: SectorId;
  x: number;
  z: number;
  role: "theme-center" | "sub-theme-center" | "related-sector";
  relationshipStrength: 1 | 2 | 3;
  subThemeId?: string;
  previousPosition?: PreviousLayoutPosition;
}
```

- [ ] **Step 4: Add SubTheme info to RenderNode**

Add `subTheme` and `isSubThemeCenter` to `RenderNode`:

```typescript
export interface RenderNode {
  sector: Sector;
  theme: Theme;
  subTheme?: SubTheme;
  cell: LayoutCell;
  metric: NormalizedMetric;
  visible: boolean;
  dimmed: boolean;
  isSubThemeCenter: boolean;
  layoutExplanation?: LayoutExplanation;
}
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Errors in files that construct Sector/LayoutCell/RenderNode objects (missing `subThemeId`, `subTheme`, `isSubThemeCenter`). These will be fixed in subsequent tasks.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(gen3): add SubTheme type, expand RelationshipType, update Sector/LayoutCell/RenderNode"
```

---

### Task 2: Create SubTheme Registry

**Files:**
- Create: `src/domain/subThemeRegistry.ts`
- Create: `src/domain/subThemeRegistry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/subThemeRegistry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";

describe("subThemeRegistry", () => {
  it("has approximately 30 sub-themes", () => {
    expect(subThemes.length).toBeGreaterThanOrEqual(27);
    expect(subThemes.length).toBeLessThanOrEqual(33);
  });

  it("every sub-theme references a valid theme", () => {
    const themeIds = new Set(themes.map((t) => t.id));
    for (const st of subThemes) {
      expect(themeIds.has(st.themeId), `SubTheme ${st.id} references unknown theme ${st.themeId}`).toBe(true);
    }
  });

  it("every sub-theme has a primarySectorId", () => {
    for (const st of subThemes) {
      expect(st.primarySectorId, `SubTheme ${st.id} missing primarySectorId`).toBeTruthy();
    }
  });

  it("every theme has at least one sub-theme", () => {
    const themesWithSub = new Set(subThemes.map((st) => st.themeId));
    for (const theme of themes) {
      expect(themesWithSub.has(theme.id), `Theme ${theme.id} has no sub-themes`).toBe(true);
    }
  });

  it("displayOrder is unique within each theme", () => {
    const ordersByTheme = new Map<string, Set<number>>();
    for (const st of subThemes) {
      const orders = ordersByTheme.get(st.themeId) ?? new Set();
      expect(orders.has(st.displayOrder), `Duplicate displayOrder ${st.displayOrder} in theme ${st.themeId}`).toBe(false);
      orders.add(st.displayOrder);
      ordersByTheme.set(st.themeId, orders);
    }
  });

  it("sub-themes are frozen", () => {
    expect(Object.isFrozen(subThemes)).toBe(true);
    for (const st of subThemes) {
      expect(Object.isFrozen(st)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/subThemeRegistry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the SubTheme registry**

Create `src/domain/subThemeRegistry.ts`. All 30 SubTheme entries are listed below, matching the spec tables:

```typescript
import type { SubTheme } from "./types";

const freezeSubTheme = (st: SubTheme): Readonly<SubTheme> => Object.freeze(st);

const subThemeConfig = [
  // AI算力 (3)
  { id: "ai-computing-infra", name: "算力基础设施", shortName: "算力基建", themeId: "ai-computing", displayOrder: 1, primarySectorId: "optical-modules" },
  { id: "domestic-substitution", name: "国产替代", shortName: "国产替代", themeId: "ai-computing", displayOrder: 2, primarySectorId: "domestic-computing" },
  { id: "ai-applications", name: "AI应用", shortName: "AI应用", themeId: "ai-computing", displayOrder: 3, primarySectorId: "aigc" },
  // 机器人/物理AI (3)
  { id: "core-components", name: "核心零部件", shortName: "核心零部件", themeId: "robotics-physical-ai", displayOrder: 1, primarySectorId: "reducers" },
  { id: "perception-layer", name: "感知层", shortName: "感知层", themeId: "robotics-physical-ai", displayOrder: 2, primarySectorId: "sensors" },
  { id: "application-scenarios", name: "应用场景", shortName: "应用场景", themeId: "robotics-physical-ai", displayOrder: 3, primarySectorId: "industrial-robotics" },
  // 低空经济 (2)
  { id: "aircraft-control", name: "航空器与控制", shortName: "航空器控制", themeId: "low-altitude-economy", displayOrder: 1, primarySectorId: "evtol" },
  { id: "operations-infra", name: "运营与基础设施", shortName: "运营基建", themeId: "low-altitude-economy", displayOrder: 2, primarySectorId: "general-aviation-operations" },
  // 半导体 (3)
  { id: "design-manufacturing", name: "设计与制造", shortName: "设计制造", themeId: "semiconductors", displayOrder: 1, primarySectorId: "chip-design" },
  { id: "equipment-materials", name: "设备与材料", shortName: "设备材料", themeId: "semiconductors", displayOrder: 2, primarySectorId: "semiconductor-equipment" },
  { id: "advanced-packaging-st", name: "先进封装", shortName: "先进封装", themeId: "semiconductors", displayOrder: 3, primarySectorId: "advanced-packaging" },
  // 新能源 (3)
  { id: "power-generation", name: "发电", shortName: "发电", themeId: "new-energy", displayOrder: 1, primarySectorId: "photovoltaics" },
  { id: "storage-battery", name: "储能与电池", shortName: "储能电池", themeId: "new-energy", displayOrder: 2, primarySectorId: "energy-storage" },
  { id: "charging-infra", name: "补能设施", shortName: "补能设施", themeId: "new-energy", displayOrder: 3, primarySectorId: "charging-infrastructure" },
  // 军工/商业航天 (3)
  { id: "launch-communication", name: "航天发射与通信", shortName: "航天通信", themeId: "defense-aerospace", displayOrder: 1, primarySectorId: "commercial-aerospace" },
  { id: "navigation-electronics", name: "导航与电子", shortName: "导航电子", themeId: "defense-aerospace", displayOrder: 2, primarySectorId: "navigation-systems" },
  { id: "materials-equipment", name: "材料与装备", shortName: "材料装备", themeId: "defense-aerospace", displayOrder: 3, primarySectorId: "aerospace-materials" },
  // 创新药/医药 (3)
  { id: "drug-rd", name: "药物研发", shortName: "药物研发", themeId: "innovative-medicine", displayOrder: 1, primarySectorId: "innovative-drugs" },
  { id: "device-biology", name: "器械与生物", shortName: "器械生物", themeId: "innovative-medicine", displayOrder: 2, primarySectorId: "medical-devices" },
  { id: "traditional-medicine", name: "传统医药", shortName: "传统医药", themeId: "innovative-medicine", displayOrder: 3, primarySectorId: "traditional-chinese-medicine" },
  // 新能源汽车/智能驾驶 (3)
  { id: "vehicle-powertrain", name: "整车与三电", shortName: "整车三电", themeId: "new-energy-vehicles", displayOrder: 1, primarySectorId: "vehicle-manufacturing" },
  { id: "autonomous-driving-st", name: "智能驾驶", shortName: "智能驾驶", themeId: "new-energy-vehicles", displayOrder: 2, primarySectorId: "autonomous-driving" },
  { id: "v2x", name: "车联网", shortName: "车联网", themeId: "new-energy-vehicles", displayOrder: 3, primarySectorId: "v2x-communication" },
  // 消费电子/VR (2)
  { id: "terminal-devices", name: "终端设备", shortName: "终端设备", themeId: "consumer-electronics", displayOrder: 1, primarySectorId: "smartphones" },
  { id: "core-components-ce", name: "核心零部件", shortName: "核心零部件", themeId: "consumer-electronics", displayOrder: 2, primarySectorId: "display-panels" },
  // 数字经济/数据要素 (3)
  { id: "data-elements-st", name: "数据要素", shortName: "数据要素", themeId: "digital-economy", displayOrder: 1, primarySectorId: "data-elements" },
  { id: "cloud-software", name: "云计算与软件", shortName: "云计算", themeId: "digital-economy", displayOrder: 2, primarySectorId: "cloud-computing" },
  { id: "xinchuang", name: "信创", shortName: "信创", themeId: "digital-economy", displayOrder: 3, primarySectorId: "xinchuang" },
  // 金融科技 (2)
  { id: "fin-infra", name: "金融基础设施", shortName: "金融基建", themeId: "fintech", displayOrder: 1, primarySectorId: "brokerage-it" },
  { id: "fin-applications", name: "金融应用", shortName: "金融应用", themeId: "fintech", displayOrder: 2, primarySectorId: "payment-systems" }
] satisfies readonly SubTheme[];

export const subThemes: readonly Readonly<SubTheme>[] = Object.freeze(subThemeConfig.map(freezeSubTheme));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/subThemeRegistry.test.ts`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/subThemeRegistry.ts src/domain/subThemeRegistry.test.ts
git commit -m "feat(gen3): add SubTheme registry with 30 sub-themes"
```

---

### Task 3: Expand Theme and Sector Registry

**Files:**
- Modify: `src/domain/themeRegistry.ts`
- Modify: `src/domain/themeRegistry.test.ts`

- [ ] **Step 1: Update existing tests for Gen3 counts**

In `src/domain/themeRegistry.test.ts`, update theme count from 7 to 11 and sector count from 42 to ~90. Add a new test for `subThemeId` validity and add import `import { subThemes } from "./subThemeRegistry";`:

```typescript
it("has 11 themes", () => {
  expect(themes.length).toBe(11);
});

it("has approximately 90 sectors", () => {
  expect(sectors.length).toBeGreaterThanOrEqual(80);
  expect(sectors.length).toBeLessThanOrEqual(100);
});

it("every sector has a valid subThemeId", () => {
  const subThemeIds = new Set(subThemes.map((st) => st.id));
  for (const sector of sectors) {
    expect(subThemeIds.has(sector.subThemeId), `Sector ${sector.id} has invalid subThemeId ${sector.subThemeId}`).toBe(true);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/themeRegistry.test.ts`
Expected: FAIL — theme count, sector count, subThemeId validation

- [ ] **Step 3: Add 4 new themes to themeConfig**

Append to `themeConfig` in `themeRegistry.ts`:

```typescript
{ id: "new-energy-vehicles", name: "新能源汽车/智能驾驶", shortName: "新能源车", color: "#4ecdc4" },
{ id: "consumer-electronics", name: "消费电子/VR", shortName: "消费电子", color: "#ff8c42" },
{ id: "digital-economy", name: "数字经济/数据要素", shortName: "数字经济", color: "#6c5ce7" },
{ id: "fintech", name: "金融科技", shortName: "金融科技", color: "#3d9970" }
```

- [ ] **Step 4: Add subThemeId to all existing 42 sectors**

Add `subThemeId` field to every sector in `sectorConfig`. Mapping:

- AI算力: optical-modules/cpo/liquid-cooled-servers/data-centers → `"ai-computing-infra"`, domestic-computing → `"domestic-substitution"`
- 机器人: reducers/servo-systems/actuators → `"core-components"`, sensors/machine-vision → `"perception-layer"`
- 低空: evtol/flight-control-systems/drones → `"aircraft-control"`, general-aviation-operations/air-traffic-systems → `"operations-infra"`
- 半导体: chip-design/wafer-fabrication → `"design-manufacturing"`, semiconductor-equipment/photoresist → `"equipment-materials"`, advanced-packaging → `"advanced-packaging-st"`
- 新能源: photovoltaics/wind-power → `"power-generation"`, power-batteries/energy-storage → `"storage-battery"`, charging-infrastructure → `"charging-infra"`
- 军工: commercial-aerospace/satellite-internet → `"launch-communication"`, navigation-systems/defense-electronics → `"navigation-electronics"`, aerospace-materials → `"materials-equipment"`
- 医药: innovative-drugs/cro-cdmo → `"drug-rd"`, medical-devices/synthetic-biology → `"device-biology"`, traditional-chinese-medicine → `"traditional-medicine"`

Example:

```typescript
{
  id: "optical-modules",
  name: "光模块",
  shortName: "光模块",
  primaryThemeId: "ai-computing",
  subThemeId: "ai-computing-infra",  // NEW
  relatedThemeIds: ["ai-computing"],
  aliases: ["高速光模块"],
  industrialChainRole: "算力互联",
  isThemeCenter: false,
  relationshipNote: "AI数据中心高速互联的核心环节，常与算力主线共振。"
}
```

- [ ] **Step 5: Add ~48 new sectors**

Add all new sectors per spec tables. New sectors by theme:

- **AI算力 (3 new):** ai-chip-design, aigc, ai-agent
- **机器人 (2 new):** industrial-robotics, humanoid-robot
- **低空 (1 new):** low-altitude-communication
- **半导体 (2 new):** chiplet, hbm
- **新能源 (1 new):** solid-state-batteries
- **军工 (1 new):** defense-informatics
- **新能源汽车 (7 new):** new-energy-vehicles(center), vehicle-manufacturing, electric-drive-systems, autonomous-driving, lidar, automotive-chips, smart-cockpit, v2x-communication
- **消费电子 (6 new):** consumer-electronics(center), smartphones, vr-ar-devices, display-panels, acoustic-devices, optical-lenses, wearable-devices
- **数字经济 (8 new):** digital-economy(center), data-elements, data-security, cloud-computing, saas-enterprise-software, xinchuang, os-database, cybersecurity
- **金融科技 (5 new):** fintech(center), brokerage-it, payment-systems, digital-currency, financial-ai, insurance-tech

Example new sector:

```typescript
{
  id: "aigc",
  name: "AIGC",
  shortName: "AIGC",
  primaryThemeId: "ai-computing",
  subThemeId: "ai-applications",
  relatedThemeIds: ["ai-computing"],
  aliases: ["生成式AI", "AI内容生成"],
  industrialChainRole: "AI应用",
  isThemeCenter: false,
  relationshipNote: "AI能力向内容生成和终端应用延伸。"
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/domain/themeRegistry.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/domain/themeRegistry.ts src/domain/themeRegistry.test.ts
git commit -m "feat(gen3): expand to 11 themes, ~90 sectors with SubTheme membership"
```

---

### Task 4: Expand Relationship Registry

**Files:**
- Modify: `src/domain/relationshipRegistry.ts`
- Modify: `src/domain/relationshipRegistry.test.ts`

- [ ] **Step 1: Update tests for Gen3**

In `src/domain/relationshipRegistry.test.ts`, add/update:

```typescript
it("has 150-180 relationship edges", () => {
  expect(relationshipEdges.length).toBeGreaterThanOrEqual(150);
  expect(relationshipEdges.length).toBeLessThanOrEqual(180);
});

it("every edge type is one of the 5 valid types", () => {
  const validTypes = new Set(["industrial-chain", "market-comovement", "heat-correction", "policy-linkage", "capital-flow"]);
  for (const edge of relationshipEdges) {
    expect(validTypes.has(edge.type), `Edge ${edge.sourceSectorId}->${edge.targetSectorId} has invalid type ${edge.type}`).toBe(true);
  }
});

it("every theme pair has at least one cross-theme edge", () => {
  const themeIds = themes.map((t) => t.id);
  const crossThemePairs = new Set<string>();
  for (const e of relationshipEdges) {
    const sourceSector = sectors.find((s) => s.id === e.sourceSectorId);
    const targetSector = sectors.find((s) => s.id === e.targetSectorId);
    if (!sourceSector || !targetSector) continue;
    if (sourceSector.primaryThemeId !== targetSector.primaryThemeId) {
      const pair = [sourceSector.primaryThemeId, targetSector.primaryThemeId].sort().join("<->");
      crossThemePairs.add(pair);
    }
  }
  for (let i = 0; i < themeIds.length; i++) {
    for (let j = i + 1; j < themeIds.length; j++) {
      const pair = [themeIds[i], themeIds[j]].sort().join("<->");
      expect(crossThemePairs.has(pair), `Missing cross-theme edge between ${themeIds[i]} and ${themeIds[j]}`).toBe(true);
    }
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/relationshipRegistry.test.ts`
Expected: FAIL — edge count, cross-theme pair coverage

- [ ] **Step 3: Add new intra-theme edges for new sectors**

Add `industrial-chain` edges for all new sectors within their themes. Each new sector connects to its theme center and to related sectors. Key new edges:

- AI算力 new: ai-chip-design ↔ domestic-computing, aigc ↔ ai-computing, ai-agent ↔ aigc
- 机器人 new: industrial-robotics ↔ actuators, humanoid-robot ↔ reducers
- 低空 new: low-altitude-communication ↔ air-traffic-systems
- 半导体 new: chiplet ↔ advanced-packaging, hbm ↔ chiplet
- 新能源 new: solid-state-batteries ↔ power-batteries
- 军工 new: defense-informatics ↔ defense-electronics
- 新能源汽车: all sectors connected to new-energy-vehicles center, inner-chain edges
- 消费电子: all sectors connected to consumer-electronics center, inner-chain edges
- 数字经济: all sectors connected to digital-economy center, inner-chain edges
- 金融科技: all sectors connected to fintech center, inner-chain edges

- [ ] **Step 4: Add cross-theme edges with policy-linkage and capital-flow**

Add ~60-80 cross-theme edges ensuring every theme pair has at least one connection. Use the 5 relationship types. Key cross-theme edges from the spec:

**policy-linkage examples:**
```typescript
edge("low-altitude-economy", "new-energy-vehicles", "policy-linkage", 0.45, "新能源产业政策"),
edge("data-elements", "brokerage-it", "policy-linkage", 0.4, "数字经济政策"),
edge("energy-storage", "photovoltaics", "policy-linkage", 0.5, "双碳目标驱动"),
edge("xinchuang", "domestic-computing", "policy-linkage", 0.55, "自主可控政策"),
```

**capital-flow examples:**
```typescript
edge("ai-computing", "consumer-electronics", "capital-flow", 0.5, "AI终端叙事切换"),
edge("semiconductors", "defense-electronics", "capital-flow", 0.45, "硬科技资金轮动"),
edge("new-energy-vehicles", "autonomous-driving", "capital-flow", 0.55, "主题内资金溢出"),
edge("innovative-medicine", "fintech", "capital-flow", 0.35, "防御-进攻风格切换"),
```

Also add enough `market-comovement` cross-theme edges to cover all remaining theme pairs not yet connected.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/domain/relationshipRegistry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/relationshipRegistry.ts src/domain/relationshipRegistry.test.ts
git commit -m "feat(gen3): expand to ~170 edges with 5 relationship types, full cross-theme coverage"
```

---

### Task 5: Expand Layout Stages

**Files:**
- Modify: `src/domain/layoutStages.ts`
- Modify: `src/domain/layoutStages.test.ts`

- [ ] **Step 1: Update tests for Gen3**

In `src/domain/layoutStages.test.ts`:

```typescript
it("has 5 layout stages", () => {
  expect(layoutStages.length).toBe(5);
});

it("stages 4 and 5 have correct previousStageId", () => {
  expect(layoutStages[3].previousStageId).toBe(layoutStages[2].id);
  expect(layoutStages[4].previousStageId).toBe(layoutStages[3].id);
});

it("every stage has heat values for all 11 themes", () => {
  const themeIds = new Set(themes.map((t) => t.id));
  for (const stage of layoutStages) {
    for (const themeId of themeIds) {
      expect(stage.themeHeat[themeId], `Stage ${stage.id} missing themeHeat for ${themeId}`).toBeDefined();
    }
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/domain/layoutStages.test.ts`
Expected: FAIL — stage count, missing theme heat

- [ ] **Step 3: Add stages 4 and 5**

Append two new stages to `layoutStages` array in `layoutStages.ts`:

```typescript
stage(
  "consumer-digital-growth",
  "消费电子/数字经济增长",
  "消费电子和数字经济题材走强，VR/AR和数据要素活跃。",
  ["consumer-electronics", "digital-economy"],
  ["fintech", "ai-computing"],
  "new-energy-defense-rotation"
),
stage(
  "nev-autonomous-driving-breakout",
  "新能源汽车/智能驾驶爆发",
  "新能源汽车和智能驾驶主题爆发，半导体芯片需求升温，产业链全面活跃。",
  ["new-energy-vehicles", "semiconductors"],
  ["new-energy", "consumer-electronics", "digital-economy"],
  "consumer-digital-growth"
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/layoutStages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/layoutStages.ts src/domain/layoutStages.test.ts
git commit -m "feat(gen3): add stages 4 and 5, 5 total market stages"
```

---

### Task 6: Update Algorithmic Layout Engine

**Files:**
- Modify: `src/domain/algorithmicLayoutEngine.ts`
- Modify: `src/domain/algorithmicLayoutEngine.test.ts`

This is the largest logic change. The engine gains a SubTheme anchor step and dual-layer relationship pull.

- [ ] **Step 1: Update engine options**

In `algorithmicLayoutEngine.ts`, update `LayoutOptions`:

```typescript
interface LayoutOptions {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly maxStageShift: number;
  readonly centerPullStrength: number;
  readonly baseRadius: number;
  readonly subThemeDistance: number;
  readonly relationPullFactor: number;
}
```

- [ ] **Step 2: Update themeAnchor to use options.baseRadius**

Change `themeAnchor` function — replace hardcoded `baseRadius = 5.2` with `options.baseRadius`:

```typescript
const themeAnchor = (index: number, count: number, stageHeat: number, options: LayoutOptions): Point => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const inwardShift = clamp(stageHeat, 0, 1) * (options.centerPullStrength + options.maxStageShift);
  const radius = Math.max(2.4, options.baseRadius - inwardShift);
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  };
};
```

- [ ] **Step 3: Add SubTheme anchor function**

Add a new function after `themeAnchor`:

```typescript
interface SubThemeAnchor {
  readonly id: string;
  readonly themeId: string;
  readonly point: Point;
}

const subThemeAnchors = (
  themeAnchorPoint: Point,
  themeId: string,
  subThemeCount: number,
  subThemeDistance: number
): SubThemeAnchor[] => {
  // Theme center sector takes position (0,0) relative to theme anchor;
  // SubTheme anchors fan outward from theme center
  const anchors: SubThemeAnchor[] = [];
  // SubThemes indexed 1..N (0 is the theme center itself)
  const actualSubThemes = subThemeCount; // number of SubThemes for this theme
  for (let i = 0; i < actualSubThemes; i++) {
    const angle = (Math.PI * 2 * i) / actualSubThemes - Math.PI / 2;
    anchors.push({
      id: `sub-${themeId}-${i}`,
      themeId,
      point: {
        x: themeAnchorPoint.x + Math.cos(angle) * subThemeDistance,
        z: themeAnchorPoint.z + Math.sin(angle) * subThemeDistance
      }
    });
  }
  return anchors;
};
```

- [ ] **Step 4: Add SubTheme lookup helper**

The engine needs access to SubTheme data. Add an optional `subThemes` field to `AlgorithmicLayoutInput`:

```typescript
interface AlgorithmicLayoutInput {
  readonly themes: readonly Readonly<Theme>[];
  readonly sectors: readonly Readonly<Sector>[];
  readonly relationshipEdges: readonly RelationshipEdge[];
  readonly stage: LayoutStage;
  readonly previousStage?: LayoutStage;
  readonly options: LayoutOptions;
  readonly subThemes?: readonly SubTheme[];
}
```

- [ ] **Step 5: Rewrite sector placement to use SubTheme anchors**

Replace the existing `sectorOffset` function and the `desired` computation in `createAlgorithmicLayout`. The new flow:

1. Compute theme anchors (unchanged, but uses `options.baseRadius`)
2. For each theme, compute SubTheme anchors using the new function
3. Assign each sector to its SubTheme anchor point (using `sector.subThemeId`)
4. Apply dual-layer pull: intra-SubTheme first, then cross-SubTheme/cross-Theme
5. Use `options.relationPullFactor` instead of hardcoded `0.18`

Updated `relationPull` — replace hardcoded `0.18` with a parameter:

```typescript
const relationPull = (
  sector: Readonly<Sector>,
  edges: readonly RelationshipEdge[],
  anchorsByTheme: ReadonlyMap<string, Point>,
  sectorsById: ReadonlyMap<string, Readonly<Sector>>,
  pullFactor: number
): Point => {
  // ... existing logic unchanged except last return:
  return {
    x: (x / total) * pullFactor,
    z: (z / total) * pullFactor
  };
};
```

Updated sector placement in `createAlgorithmicLayout`:

```typescript
// Build SubTheme anchor map: subThemeId -> Point
const subThemeAnchorMap = new Map<string, Point>();
if (input.subThemes) {
  const sectorsByTheme = new Map<string, number>();
  for (const theme of input.themes) {
    const themePoint = anchorsByTheme.get(theme.id)!;
    const themeSubThemes = input.subThemes.filter(st => st.themeId === theme.id);
    const anchors = subThemeAnchors(themePoint, theme.id, themeSubThemes.length, input.options.subThemeDistance);
    for (let i = 0; i < themeSubThemes.length; i++) {
      subThemeAnchorMap.set(themeSubThemes[i].id, anchors[i].point);
    }
  }
}

const desired = input.sectors.map((sector) => {
  // Theme center uses theme anchor directly
  if (sector.isThemeCenter) {
    const themePosition = anchorsByTheme.get(sector.primaryThemeId) ?? { x: 0, z: 0 };
    const heat = input.stage.sectorHeat[sector.id] ?? 0.2;
    return {
      sector,
      point: {
        x: themePosition.x - heat * 0.15,
        z: themePosition.z - heat * 0.15
      },
      strength: 3 as const
    };
  }

  // Non-center: start from SubTheme anchor, then apply offset + pull
  const subThemePoint = subThemeAnchorMap.get(sector.subThemeId) ?? anchorsByTheme.get(sector.primaryThemeId) ?? { x: 0, z: 0 };
  const localIndex = sectorIndexByTheme.get(sector.primaryThemeId) ?? 0;
  sectorIndexByTheme.set(sector.primaryThemeId, localIndex + 1);
  const offset = sectorOffset(localIndex, input.sectors.filter(s => s.subThemeId === sector.subThemeId).length);
  const pull = relationPull(sector, input.relationshipEdges, anchorsByTheme, sectorsById, input.options.relationPullFactor);
  const heat = input.stage.sectorHeat[sector.id] ?? 0.2;

  return {
    sector,
    point: {
      x: subThemePoint.x + offset.x + pull.x - heat * 0.2,
      z: subThemePoint.z + offset.z + pull.z - heat * 0.2
    },
    strength: (heat >= 0.8 ? 3 : heat >= 0.5 ? 2 : 1) as 1 | 2 | 3
  };
});
```

- [ ] **Step 6: Update snapToGrid sorting priority**

In `snapToGrid`, update the sort to include SubTheme centers:

```typescript
const sorted = [...desired].sort((a, b) => {
  // Theme centers first
  if (a.sector.isThemeCenter !== b.sector.isThemeCenter) return a.sector.isThemeCenter ? -1 : 1;
  // Then SubTheme centers
  const aIsSubCenter = input.subThemes?.some(st => st.primarySectorId === a.sector.id) ?? false;
  const bIsSubCenter = input.subThemes?.some(st => st.primarySectorId === b.sector.id) ?? false;
  if (aIsSubCenter !== bIsSubCenter) return aIsSubCenter ? -1 : 1;
  return a.sector.id.localeCompare(b.sector.id);
});
```

- [ ] **Step 7: Update buildExplanations to include SubTheme**

In `buildExplanations`, add SubTheme info to summary:

```typescript
// In the summary string, add subThemeId reference:
const subThemeNote = sector.subThemeId ? `，属于${sector.subThemeId}分题材` : "";
explanations[sector.id] = {
  sectorId: sector.id,
  summary: reasons.length > 0
    ? `靠近 ${reasons[0].relatedSectorId}，主要因为${reasons[0].note}${subThemeNote}。`
    : `主题中心锚定在本阶段的基础位置${subThemeNote}。`,
  reasons
};
```

- [ ] **Step 8: Update tests**

In `src/domain/algorithmicLayoutEngine.test.ts`, update existing tests to pass SubTheme data and new options:

```typescript
// Update options in all test calls:
options: {
  gridWidth: 22,
  gridHeight: 16,
  maxStageShift: 1.6,
  centerPullStrength: 1.2,
  baseRadius: 6.8,
  subThemeDistance: 1.5,
  relationPullFactor: 0.15
}

// Add subThemes to input (from subThemeRegistry):
import { subThemes } from "./subThemeRegistry";
// Pass as: subThemes
```

Add new test cases:

```typescript
it("SubTheme members are spatially closer to each other than to other SubThemes in same theme", () => {
  const result = createAlgorithmicLayout({...input, subThemes});
  for (const theme of themes) {
    const themeSubThemes = subThemes.filter(st => st.themeId === theme.id);
    if (themeSubThemes.length < 2) continue;
    for (const st of themeSubThemes) {
      const stSectors = sectors.filter(s => s.subThemeId === st.id);
      const stCells = stSectors.map(s => result.layout.cells.find(c => c.sectorId === s.id)!).filter(Boolean);
      if (stCells.length < 2) continue;
      const avgIntraDist = averagePairwiseDistance(stCells);
      const otherCells = result.layout.cells.filter(c => {
        const s = sectors.find(sec => sec.id === c.sectorId);
        return s && s.subThemeId !== st.id && s.primaryThemeId === theme.id;
      });
      if (otherCells.length === 0) continue;
      const avgInterDist = averageCrossDistance(stCells, otherCells);
      expect(avgIntraDist).toBeLessThan(avgInterDist);
    }
  }
});
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run src/domain/algorithmicLayoutEngine.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/domain/algorithmicLayoutEngine.ts src/domain/algorithmicLayoutEngine.test.ts
git commit -m "feat(gen3): SubTheme anchors, larger grid, dual-layer pull, 5 relationship types"
```

---

### Task 7: Update Layout Provider

**Files:**
- Modify: `src/domain/layoutProvider.ts`
- Modify: `src/domain/layoutProvider.test.ts`

- [ ] **Step 1: Update createAlgorithmicLayoutProvider options**

In `layoutProvider.ts`, update the options and pass SubThemes:

```typescript
import { subThemes } from "./subThemeRegistry";

export function createAlgorithmicLayoutProvider(): LayoutProvider {
  return {
    getLayout: (stageId) => {
      const stage = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      const previousStage = stage.previousStageId ? getLayoutStageById(stage.previousStageId) : undefined;
      const result = createAlgorithmicLayout({
        themes,
        sectors,
        relationshipEdges,
        stage,
        previousStage,
        options: {
          gridWidth: 22,
          gridHeight: 16,
          maxStageShift: 1.6,
          centerPullStrength: 1.2,
          baseRadius: 6.8,
          subThemeDistance: 1.5,
          relationPullFactor: 0.15
        },
        subThemes
      });

      return {
        ...result.layout,
        cells: result.layout.cells.map((cell) => ({ ...cell }))
      };
    }
  };
}
```

- [ ] **Step 2: Update tests**

In `layoutProvider.test.ts`, update expected grid dimensions and add SubTheme-aware checks.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/domain/layoutProvider.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/layoutProvider.ts src/domain/layoutProvider.test.ts
git commit -m "feat(gen3): update layout provider with Gen3 parameters and SubTheme data"
```

---

### Task 8: Update Render Nodes

**Files:**
- Modify: `src/domain/renderNodes.ts`
- Modify: `src/domain/renderNodes.test.ts`

- [ ] **Step 1: Update buildRenderNodes to include SubTheme info**

In `renderNodes.ts`, import subThemes and enrich each RenderNode:

```typescript
import { subThemes } from "./subThemeRegistry";
```

In the `return` block of `buildRenderNodes`, add SubTheme lookup:

```typescript
const subTheme = subThemes.find((st) => st.id === sector.subThemeId);
const isSubThemeCenter = subTheme?.primarySectorId === sector.id;

return {
  sector,
  theme,
  subTheme,
  cell,
  metric,
  visible,
  dimmed: !visible,
  isSubThemeCenter,
  layoutExplanation: input.layout.explanations?.[cell.sectorId]
};
```

- [ ] **Step 2: Update tests**

In `renderNodes.test.ts`, add assertions:

```typescript
it("every render node has a subTheme if sector has valid subThemeId", () => {
  for (const node of nodes) {
    if (node.sector.subThemeId) {
      expect(node.subTheme, `Node ${node.sector.id} missing subTheme`).toBeDefined();
    }
  }
});

it("isSubThemeCenter is true only for SubTheme primary sectors", () => {
  for (const node of nodes) {
    if (node.isSubThemeCenter) {
      expect(node.subTheme?.primarySectorId).toBe(node.sector.id);
    }
  }
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/domain/renderNodes.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/renderNodes.ts src/domain/renderNodes.test.ts
git commit -m "feat(gen3): pass SubTheme info and isSubThemeCenter to render nodes"
```

---

### Task 9: Update State for Focus Mode

**Files:**
- Modify: `src/state/useHunterState.ts`

- [ ] **Step 1: Add focusSubThemeId state**

Add a new state variable for tracking which SubTheme is focused:

```typescript
const [focusSubThemeId, setFocusSubThemeId] = useState<string | undefined>();

// Clear focus when scenario changes:
function setActiveScenarioId(nextScenarioId: string) {
  setActiveScenarioIdState(nextScenarioId);
  setSelectedSectorId(undefined);
  setFocusSubThemeId(undefined);
}
```

Return from hook:

```typescript
return {
  // ... existing returns ...
  focusSubThemeId,
  setFocusSubThemeId,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/state/useHunterState.ts
git commit -m "feat(gen3): add focusSubThemeId state for SubTheme focus mode"
```

---

### Task 10: Update CapitalMapScene — Country Map Terrain

**Files:**
- Modify: `src/components/CapitalMapScene.tsx`

This is the largest UI change: replace GridHelper with a continuous terrain plane, add label density control, and add focus mode.

- [ ] **Step 1: Add terrain plane component**

Create a `TerrainPlane` component that renders a single large plane with vertex-based theme coloring. The plane uses `PlaneGeometry` with vertex colors to create gradient transitions between theme regions:

```typescript
import * as THREE from "three";

function TerrainPlane({ nodes }: { nodes: RenderNode[] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const size = 22;
    const segments = 44; // 2 segments per grid unit for smooth gradients
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    // For each vertex, find nearest sector's theme color and blend
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      // Collect theme colors weighted by inverse distance
      let r = 0, g = 0, b = 0, totalWeight = 0;
      for (const node of nodes) {
        if (!node.visible) continue;
        const dx = vx - node.cell.x;
        const dz = vz - node.cell.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const weight = 1 / Math.max(dist, 0.5);
        const tc = new THREE.Color(node.theme.color);
        r += tc.r * weight;
        g += tc.g * weight;
        b += tc.b * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        colors[i * 3] = r / totalWeight * 0.25;     // dim factor
        colors[i * 3 + 1] = g / totalWeight * 0.25;
        colors[i * 3 + 2] = b / totalWeight * 0.25;
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [nodes]);

  return (
    <mesh ref={meshRef} geometry={geometry} position={[0, -0.03, 0]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
```

- [ ] **Step 2: Add label visibility logic**

Add a helper function to determine if a sector should show its label:

```typescript
function shouldShowLabel(node: RenderNode, focusSubThemeId?: string): boolean {
  // Always show theme center labels
  if (node.sector.isThemeCenter) return true;
  // Show SubTheme center labels
  if (node.isSubThemeCenter) return true;
  // In focus mode, show all labels in the focused SubTheme
  if (focusSubThemeId && node.sector.subThemeId === focusSubThemeId) return true;
  return false;
}
```

- [ ] **Step 3: Update CapitalMapScene props and rendering**

Update the component to accept `focusSubThemeId` and `onFocusSubTheme`:

```typescript
interface CapitalMapSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  focusSubThemeId?: string;
  onSelectSector: (sectorId: SectorId) => void;
  onFocusSubTheme: (subThemeId: string | undefined) => void;
  orbitControlsRef?: RefObject<SceneOrbitControls | null>;
}
```

Replace the `<gridHelper>` with `<TerrainPlane>`:

```typescript
return (
  <group>
    <TerrainPlane nodes={props.nodes} />
    {/* Subtle grid overlay for spatial reference */}
    <gridHelper args={[22, 22, "#1a2030", "#141a24"]} position={[0, -0.01, 0]} />
    {props.nodes.map((node) => {
      const columnGeometry = getColumnRenderGeometry(node.metric);
      const showLabel = shouldShowLabel(node, props.focusSubThemeId);
      const isInFocus = !props.focusSubThemeId || node.sector.subThemeId === props.focusSubThemeId;
      const dimFactor = props.focusSubThemeId ? (isInFocus ? 1 : 0.2) : 1;

      return (
        <group key={node.sector.id} position={[node.cell.x, 0, node.cell.z]}>
          <mesh
            receiveShadow
            onClick={(event) => handleBaseCellClick(event, node, props.onSelectSector)}
          >
            <boxGeometry args={[
              node.isSubThemeCenter ? CELL_SIZE * 1.2 : CELL_SIZE,
              BASE_CELL_THICKNESS,
              node.isSubThemeCenter ? CELL_SIZE * 1.2 : CELL_SIZE
            ]} />
            <meshStandardMaterial
              color={node.sector.isThemeCenter ? node.theme.color : "#26313d"}
              opacity={node.visible ? 0.95 * dimFactor : 0.18}
              transparent
              roughness={0.72}
            />
          </mesh>
          <mesh
            castShadow
            position={[0, columnGeometry.positionY, 0]}
            visible={node.visible}
          >
            <boxGeometry args={[COLUMN_SIZE, columnGeometry.height, COLUMN_SIZE]} />
            <meshStandardMaterial
              color={node.metric.color}
              opacity={node.metric.intensity * dimFactor}
              transparent
              emissive={node.metric.color}
              emissiveIntensity={props.selectedSectorId === node.sector.id ? 0.22 : 0.04}
            />
          </mesh>
          {showLabel && (
            <Text
              position={[0, 0.08, 0.52]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={node.sector.isThemeCenter ? 0.22 : 0.15}
              color={node.visible ? "#e8eef5" : "#64717f"}
              anchorX="center"
              anchorY="middle"
              maxWidth={1.2}
            >
              {node.sector.shortName}
            </Text>
          )}
        </group>
      );
    })}
  </group>
);
```

- [ ] **Step 4: Update camera positions for larger grid**

```typescript
const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [13, 13, 16],
  top: [0, 22, 0.1],
  side: [18, 7, 0]
};
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CapitalMapScene.tsx
git commit -m "feat(gen3): country-map terrain base, label density control, focus mode"
```

---

### Task 11: Update ControlsPanel

**Files:**
- Modify: `src/components/ControlsPanel.tsx`

- [ ] **Step 1: No code changes needed for theme filter**

The ControlsPanel already dynamically renders theme options from `props.themes`, so the filter automatically shows 11 options when the expanded theme registry is passed in.

- [ ] **Step 2: Verify stage count**

The timeline section also renders dynamically from `props.scenarios`, so 5 stages will appear automatically when the expanded scenario data flows in.

- [ ] **Step 3: Update the "读图规则" section text**

Update the compact-note section to reflect Gen3:

```typescript
<p>二维位置表达关系，柱高表达资金强度，红色为流入，绿色为流出。点击分题材区域展开详细标签。</p>
// ...
<p>第三版：11个主题、~90个板块、5种关系类型、国家地图底座。</p>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ControlsPanel.tsx
git commit -m "feat(gen3): update ControlsPanel notes for Gen3"
```

---

### Task 12: Update InspectorPanel

**Files:**
- Modify: `src/components/InspectorPanel.tsx`

- [ ] **Step 1: Add SubTheme membership display**

After the theme kicker, add SubTheme info:

```typescript
<div className="inspector-kicker">主线：{node.theme.name}</div>
{node.subTheme && (
  <div className="inspector-kicker">分题材：{node.subTheme.name}</div>
)}
```

- [ ] **Step 2: Add relationship type color labels**

Update the layout explanation reasons to show colored type badges:

```typescript
const RELATIONSHIP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "industrial-chain": { label: "产业链", color: "#4a9eff" },
  "market-comovement": { label: "市场共振", color: "#4ecdc4" },
  "heat-correction": { label: "热度修正", color: "#7b8794" },
  "policy-linkage": { label: "政策联动", color: "#ff8c42" },
  "capital-flow": { label: "资金流向", color: "#e64646" },
};
```

In the reasons list, add a type badge:

```typescript
{explanationReasons.map((reason) => {
  const typeInfo = RELATIONSHIP_TYPE_LABELS[reason.relationshipType] ?? { label: reason.relationshipType, color: "#888" };
  return (
    <li key={`${reason.relatedSectorId}-${reason.note}`}>
      <span style={{ color: typeInfo.color, fontSize: "11px", fontWeight: 600 }}>
        [{typeInfo.label}]
      </span>{" "}
      <span>{reason.note}</span>
    </li>
  );
})}
```

- [ ] **Step 3: Group reasons by relationship type**

Sort explanationReasons by type before rendering:

```typescript
const groupedReasons = [...explanationReasons].sort((a, b) =>
  a.relationshipType.localeCompare(b.relationshipType)
);
```

- [ ] **Step 4: Update empty state text**

```typescript
<p>第三版展示资金方向、模拟净流入、算法布局解释和分题材信息。</p>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/InspectorPanel.tsx
git commit -m "feat(gen3): SubTheme display, 5 colored relationship types in inspector"
```

---

### Task 13: Wire Up App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Pass new props to HunterScene / CapitalMapScene**

In `App.tsx`, pass `focusSubThemeId` and `onFocusSubTheme` through:

```typescript
<HunterScene
  nodes={nodes}
  cameraPreset={hunterState.cameraPreset}
  selectedSectorId={hunterState.selectedSectorId}
  focusSubThemeId={hunterState.focusSubThemeId}
  onSelectSector={hunterState.setSelectedSectorId}
  onFocusSubTheme={hunterState.setFocusSubThemeId}
/>
```

- [ ] **Step 2: Update HunterScene to pass through new props**

In `HunterScene.tsx`, update the interface and pass `focusSubThemeId` / `onFocusSubTheme` to `CapitalMapScene`.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 5: Manual verification**

Run: `npm run dev`
Open `http://localhost:5173` and verify:
- 11 themes visible in filter
- 5 stages in timeline
- Country-map terrain base with gradient theme regions
- Click a SubTheme sector → focus mode expands labels
- Inspector shows SubTheme membership and colored relationship types

- [ ] **Step 6: Final commit**

```bash
git add src/App.tsx src/components/HunterScene.tsx
git commit -m "feat(gen3): wire up focus mode and Gen3 props throughout app"
```
