# A Capital Hunter Gen2 Layout Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second-generation algorithmic base-map prototype: expanded 7-theme sector universe, relationship-driven deterministic grid layout, market-stage layout versions, and UI explanations.

**Architecture:** Extend the existing v1 provider pipeline instead of replacing the 3D renderer. Add a pure domain layout engine that reads sector metadata, relationship edges, and market-stage heat, then outputs `SectorLayout`-compatible grid cells plus explanations and previous-stage positions for the React app.

**Tech Stack:** Vite, React, TypeScript, Three.js, `@react-three/fiber`, `@react-three/drei`, Vitest, React Testing Library, Playwright.

---

## Scope Check

The approved second-generation spec is one coherent subsystem: algorithmic base-map layout plus the UI needed to demonstrate it. It should not be split into separate plans because each task produces working, testable software on the same path: registry data -> relationship graph -> layout engine -> provider integration -> controls -> inspector -> visual verification.

This plan intentionally does not implement live A-share public data ingestion. It creates the adapter contract and stable local demo path so a future dedicated implementation can connect real public data without destabilizing the prototype.

## File Structure

Modify these existing files:

- `src/domain/types.ts`: widen ids for extensibility; add sector metadata, relationship, layout-stage, layout-mode, explanation, and dataset summary types.
- `src/domain/themeRegistry.ts`: expand to 7 themes and 42 sectors; add `industrialChainRole`.
- `src/domain/themeRegistry.test.ts`: validate expanded registry and id references.
- `src/domain/scenarioDataProvider.ts`: provide stage-aligned demo scenarios for the expanded sector pool.
- `src/domain/scenarioDataProvider.test.ts`: validate every scenario covers every sector.
- `src/domain/layoutProvider.ts`: keep manual provider and add algorithmic provider adapter.
- `src/domain/layoutProvider.test.ts`: validate manual and algorithmic provider behavior.
- `src/domain/renderNodes.ts`: include layout explanation and previous position in render nodes.
- `src/domain/renderNodes.test.ts`: cover explanation propagation and stage comparison metadata.
- `src/state/useHunterState.ts`: add layout mode, layout stage, and compare-previous-stage state.
- `src/state/useHunterState.test.tsx`: cover new state transitions.
- `src/components/ControlsPanel.tsx`: add layout controls and stage controls.
- `src/components/ControlsPanel.test.tsx`: cover layout mode and stage interactions.
- `src/components/InspectorPanel.tsx`: render layout explanation.
- `src/components/InspectorPanel.test.tsx`: cover explanation output.
- `src/components/CapitalMapScene.tsx`: render optional previous-stage markers or movement traces.
- `src/components/CapitalMapScene.test.tsx`: cover helper logic for comparison markers.
- `src/App.tsx`: wire algorithmic layout, stage selection, comparison metadata, and dataset summary.
- `src/App.css`: add compact styles for new controls, explanation rows, summary strip, and previous markers.
- `src/App.test.tsx`: cover shell-level algorithm layout and explanation behavior.
- `tests/e2e/a-capital-hunter.spec.ts`: update smoke test for gen2 controls and explanation panel.

Create these new files:

- `src/domain/relationshipRegistry.ts`: relationship edge config and validation helpers.
- `src/domain/relationshipRegistry.test.ts`: relationship validation and duplicate detection tests.
- `src/domain/layoutStages.ts`: market-stage metadata, theme heat, and stage modifiers.
- `src/domain/layoutStages.test.ts`: stage validation tests.
- `src/domain/algorithmicLayoutEngine.ts`: deterministic layout engine.
- `src/domain/algorithmicLayoutEngine.test.ts`: deterministic, collision-free, distance, heat, and explanation tests.
- `src/domain/publicDataAdapter.ts`: experimental adapter interface and local sample mapper.
- `src/domain/publicDataAdapter.test.ts`: adapter contract tests.
- `src/components/DatasetSummary.tsx`: theme/sector/edge/layout metadata display.
- `src/components/DatasetSummary.test.tsx`: summary rendering tests.

## Shared Data Choices

Use these 7 theme ids:

```ts
export const themeIds = [
  "ai-computing",
  "robotics-physical-ai",
  "low-altitude-economy",
  "semiconductors",
  "new-energy",
  "defense-aerospace",
  "innovative-medicine"
] as const;
```

Use these 42 sector ids, six per theme:

| Theme | Sectors |
| --- | --- |
| AI算力 | `ai-computing`, `optical-modules`, `cpo`, `liquid-cooled-servers`, `domestic-computing`, `data-centers` |
| 机器人 | `robotics-physical-ai`, `reducers`, `servo-systems`, `sensors`, `machine-vision`, `actuators` |
| 低空经济 | `low-altitude-economy`, `evtol`, `flight-control-systems`, `drones`, `general-aviation-operations`, `air-traffic-systems` |
| 半导体 | `semiconductors`, `chip-design`, `wafer-fabrication`, `semiconductor-equipment`, `photoresist`, `advanced-packaging` |
| 新能源 | `new-energy`, `power-batteries`, `energy-storage`, `photovoltaics`, `wind-power`, `charging-infrastructure` |
| 军工/商业航天 | `defense-aerospace`, `commercial-aerospace`, `satellite-internet`, `navigation-systems`, `aerospace-materials`, `defense-electronics` |
| 创新药/医药 | `innovative-medicine`, `innovative-drugs`, `cro-cdmo`, `medical-devices`, `synthetic-biology`, `traditional-chinese-medicine` |

## Task 1: Expand Domain Types

**Files:**

- Modify: `src/domain/types.ts`
- Test: `src/domain/themeRegistry.test.ts`

- [ ] **Step 1: Write failing type/registry tests**

Add these tests to `src/domain/themeRegistry.test.ts`:

```ts
it("supports the second-generation theme universe", () => {
  expect(themes).toHaveLength(7);
  expect(themes.map((theme) => theme.id)).toEqual([
    "ai-computing",
    "robotics-physical-ai",
    "low-altitude-economy",
    "semiconductors",
    "new-energy",
    "defense-aerospace",
    "innovative-medicine"
  ]);
});

it("stores industrial chain roles for every sector", () => {
  expect(sectors).toHaveLength(42);
  expect(sectors.every((sector) => sector.industrialChainRole.length > 0)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/themeRegistry.test.ts`

Expected: FAIL because `industrialChainRole` does not exist and the registry still has 3 themes / 18 sectors.

- [ ] **Step 3: Replace extensibility-sensitive id and domain types**

In `src/domain/types.ts`, replace the fixed `ThemeId` and `SectorId` unions with extensible string ids and add these types:

```ts
export type ThemeId = string;
export type SectorId = string;

export type RelationshipType = "industrial-chain" | "market-comovement" | "heat-correction";
export type LayoutMode = "manual" | "algorithmic";
export type LayoutStageId = string;

export interface Sector {
  readonly id: SectorId;
  readonly name: string;
  readonly shortName: string;
  readonly primaryThemeId: ThemeId;
  readonly relatedThemeIds: readonly ThemeId[];
  readonly aliases: readonly string[];
  readonly industrialChainRole: string;
  readonly isThemeCenter: boolean;
  readonly relationshipNote: string;
}

export interface RelationshipEdge {
  readonly sourceSectorId: SectorId;
  readonly targetSectorId: SectorId;
  readonly type: RelationshipType;
  readonly weight: number;
  readonly note: string;
}

export interface LayoutStage {
  readonly id: LayoutStageId;
  readonly label: string;
  readonly story: string;
  readonly previousStageId?: LayoutStageId;
  readonly themeHeat: Readonly<Record<ThemeId, number>>;
  readonly sectorHeat: Readonly<Record<SectorId, number>>;
}

export interface LayoutExplanationReason {
  readonly relatedSectorId: SectorId;
  readonly relationshipType: RelationshipType;
  readonly weight: number;
  readonly note: string;
  readonly stageInfluenced: boolean;
}

export interface LayoutExplanation {
  readonly sectorId: SectorId;
  readonly summary: string;
  readonly reasons: readonly LayoutExplanationReason[];
}

export interface PreviousLayoutPosition {
  readonly x: number;
  readonly z: number;
}

export interface LayoutCell {
  sectorId: SectorId;
  x: number;
  z: number;
  role: "theme-center" | "related-sector";
  relationshipStrength: 1 | 2 | 3;
  previousPosition?: PreviousLayoutPosition;
}

export interface SectorLayout {
  cells: LayoutCell[];
  version?: string;
  stageId?: LayoutStageId;
  explanations?: Readonly<Record<SectorId, LayoutExplanation>>;
}

export interface LayoutProvider {
  getLayout(stageId?: LayoutStageId): SectorLayout;
}

export interface DatasetSummary {
  readonly themeCount: number;
  readonly sectorCount: number;
  readonly relationshipEdgeCount: number;
  readonly layoutVersion: string;
  readonly activeStageLabel: string;
}

export interface RenderNode {
  sector: Sector;
  theme: Theme;
  cell: LayoutCell;
  metric: NormalizedMetric;
  visible: boolean;
  dimmed: boolean;
  layoutExplanation?: LayoutExplanation;
}
```

Keep the existing `CapitalDirection`, `CapitalStateFilter`, `ThemeFilter`, `CameraPreset`, `ReadonlyNonEmptyArray`, `Theme`, `ScenarioPoint`, `MarketScenario`, `DataProvider`, and `NormalizedMetric` exports. Update them only where they reference `ThemeId` or `SectorId`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/domain/themeRegistry.test.ts`

Expected: still FAIL because the registry has not been expanded yet.

- [ ] **Step 5: Commit domain type expansion**

```bash
git add src/domain/types.ts src/domain/themeRegistry.test.ts
git commit -m "feat: add gen2 layout domain types"
```

## Task 2: Expand Theme And Sector Registry

**Files:**

- Modify: `src/domain/themeRegistry.ts`
- Modify: `src/domain/themeRegistry.test.ts`

- [ ] **Step 1: Add failing validation tests**

Add these tests to `src/domain/themeRegistry.test.ts`:

```ts
it("keeps every sector primary theme valid", () => {
  const themeIds = new Set(themes.map((theme) => theme.id));

  for (const sector of sectors) {
    expect(themeIds.has(sector.primaryThemeId)).toBe(true);
    expect(sector.relatedThemeIds.every((themeId) => themeIds.has(themeId))).toBe(true);
  }
});

it("has exactly one center sector per theme", () => {
  for (const theme of themes) {
    const centers = sectors.filter(
      (sector) => sector.primaryThemeId === theme.id && sector.isThemeCenter
    );
    expect(centers.map((sector) => sector.id)).toEqual([theme.id]);
  }
});

it("uses unique sector ids", () => {
  const ids = sectors.map((sector) => sector.id);
  expect(new Set(ids).size).toBe(ids.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/themeRegistry.test.ts`

Expected: FAIL because the registry still contains 18 sectors and no `industrialChainRole`.

- [ ] **Step 3: Expand `themeConfig`**

Replace `themeConfig` in `src/domain/themeRegistry.ts` with:

```ts
const themeConfig = [
  { id: "ai-computing", name: "AI算力", shortName: "AI算力", color: "#d94a45" },
  { id: "robotics-physical-ai", name: "机器人（物理AI）", shortName: "机器人", color: "#d89a38" },
  { id: "low-altitude-economy", name: "低空经济", shortName: "低空经济", color: "#3b82c4" },
  { id: "semiconductors", name: "半导体", shortName: "半导体", color: "#b86adf" },
  { id: "new-energy", name: "新能源", shortName: "新能源", color: "#3aa66a" },
  { id: "defense-aerospace", name: "军工/商业航天", shortName: "军工航天", color: "#7f91a6" },
  { id: "innovative-medicine", name: "创新药/医药", shortName: "创新药", color: "#d86f8d" }
] satisfies readonly Theme[];
```

- [ ] **Step 4: Expand `sectorConfig`**

Update every existing sector with `industrialChainRole`, then append the new sectors listed in "Shared Data Choices". Use these roles:

| Sector id | Role |
| --- | --- |
| `ai-computing` | 主线中心 |
| `optical-modules` | 算力互联 |
| `cpo` | 光互联技术 |
| `liquid-cooled-servers` | 算力基础设施 |
| `domestic-computing` | 国产替代 |
| `data-centers` | 算力载体 |
| `robotics-physical-ai` | 主线中心 |
| `reducers` | 运动控制 |
| `servo-systems` | 运动控制 |
| `sensors` | 感知层 |
| `machine-vision` | 感知算法 |
| `actuators` | 执行层 |
| `low-altitude-economy` | 主线中心 |
| `evtol` | 航空器 |
| `flight-control-systems` | 控制系统 |
| `drones` | 应用载体 |
| `general-aviation-operations` | 运营场景 |
| `air-traffic-systems` | 基础设施 |
| `semiconductors` | 主线中心 |
| `chip-design` | 上游设计 |
| `wafer-fabrication` | 制造环节 |
| `semiconductor-equipment` | 制造装备 |
| `photoresist` | 材料 |
| `advanced-packaging` | 后道封装 |
| `new-energy` | 主线中心 |
| `power-batteries` | 储能部件 |
| `energy-storage` | 储能系统 |
| `photovoltaics` | 发电设备 |
| `wind-power` | 发电设备 |
| `charging-infrastructure` | 终端设施 |
| `defense-aerospace` | 主线中心 |
| `commercial-aerospace` | 航天发射 |
| `satellite-internet` | 通信网络 |
| `navigation-systems` | 导航定位 |
| `aerospace-materials` | 高端材料 |
| `defense-electronics` | 军工电子 |
| `innovative-medicine` | 主线中心 |
| `innovative-drugs` | 药物研发 |
| `cro-cdmo` | 研发外包 |
| `medical-devices` | 医疗器械 |
| `synthetic-biology` | 生物制造 |
| `traditional-chinese-medicine` | 防御医药 |

For each new sector, set `isThemeCenter: true` only when the sector id equals its primary theme id. Give each new sector one or two aliases and a concrete `relationshipNote` explaining its theme relationship.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/domain/themeRegistry.test.ts`

Expected: PASS.

- [ ] **Step 6: Run full tests**

Run: `npm test`

Expected: some downstream tests may fail because scenarios and layouts still cover only 18 sectors. Record failures and continue to Task 3.

- [ ] **Step 7: Commit registry expansion**

```bash
git add src/domain/themeRegistry.ts src/domain/themeRegistry.test.ts
git commit -m "feat: expand gen2 theme registry"
```

## Task 3: Add Relationship Registry

**Files:**

- Create: `src/domain/relationshipRegistry.ts`
- Create: `src/domain/relationshipRegistry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/domain/relationshipRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sectors } from "./themeRegistry";
import { relationshipEdges, validateRelationshipEdges } from "./relationshipRegistry";

describe("relationshipRegistry", () => {
  it("defines a medium-density relationship graph", () => {
    expect(relationshipEdges.length).toBeGreaterThanOrEqual(60);
  });

  it("references valid sector ids", () => {
    const result = validateRelationshipEdges(relationshipEdges, sectors);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects duplicate directed edges", () => {
    const duplicate = relationshipEdges[0];
    const result = validateRelationshipEdges([...relationshipEdges, duplicate], sectors);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(`${duplicate.sourceSectorId}->${duplicate.targetSectorId}`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/relationshipRegistry.test.ts`

Expected: FAIL because `relationshipRegistry.ts` does not exist.

- [ ] **Step 3: Create relationship registry module**

Create `src/domain/relationshipRegistry.ts`:

```ts
import type { RelationshipEdge, Sector } from "./types";

const edge = (
  sourceSectorId: string,
  targetSectorId: string,
  type: RelationshipEdge["type"],
  weight: number,
  note: string
): RelationshipEdge => ({ sourceSectorId, targetSectorId, type, weight, note });

export const relationshipEdges: readonly RelationshipEdge[] = Object.freeze([
  edge("ai-computing", "optical-modules", "industrial-chain", 0.95, "AI数据中心高速互联"),
  edge("ai-computing", "cpo", "industrial-chain", 0.9, "光互联技术共振"),
  edge("ai-computing", "liquid-cooled-servers", "industrial-chain", 0.82, "高功耗算力散热"),
  edge("ai-computing", "domestic-computing", "industrial-chain", 0.78, "国产算力替代"),
  edge("ai-computing", "data-centers", "industrial-chain", 0.8, "算力基础设施"),
  edge("optical-modules", "cpo", "market-comovement", 0.88, "光通信分支联动"),
  edge("data-centers", "liquid-cooled-servers", "industrial-chain", 0.76, "数据中心和液冷配套"),
  edge("ai-computing", "semiconductors", "market-comovement", 0.72, "AI拉动半导体景气"),
  edge("domestic-computing", "chip-design", "industrial-chain", 0.74, "国产芯片设计支撑算力"),
  edge("cpo", "advanced-packaging", "market-comovement", 0.56, "高速封装叙事交叉"),

  edge("robotics-physical-ai", "reducers", "industrial-chain", 0.9, "机器人关节核心部件"),
  edge("robotics-physical-ai", "servo-systems", "industrial-chain", 0.88, "机器人运动控制"),
  edge("robotics-physical-ai", "sensors", "industrial-chain", 0.82, "机器人感知层"),
  edge("robotics-physical-ai", "machine-vision", "industrial-chain", 0.8, "视觉感知"),
  edge("robotics-physical-ai", "actuators", "industrial-chain", 0.86, "执行层"),
  edge("sensors", "machine-vision", "market-comovement", 0.62, "感知链共振"),
  edge("servo-systems", "actuators", "industrial-chain", 0.7, "控制到执行"),
  edge("robotics-physical-ai", "ai-computing", "market-comovement", 0.66, "物理AI承接AI能力"),
  edge("sensors", "flight-control-systems", "industrial-chain", 0.55, "低空与机器人共用感知控制"),
  edge("machine-vision", "chip-design", "market-comovement", 0.48, "AI识别和芯片设计交叉"),

  edge("low-altitude-economy", "evtol", "industrial-chain", 0.95, "低空航空器核心载体"),
  edge("low-altitude-economy", "flight-control-systems", "industrial-chain", 0.9, "飞行控制系统"),
  edge("low-altitude-economy", "drones", "industrial-chain", 0.86, "成熟低空应用"),
  edge("low-altitude-economy", "general-aviation-operations", "industrial-chain", 0.76, "运营场景"),
  edge("low-altitude-economy", "air-traffic-systems", "industrial-chain", 0.78, "空域基础设施"),
  edge("evtol", "flight-control-systems", "industrial-chain", 0.82, "航空器控制系统"),
  edge("drones", "flight-control-systems", "industrial-chain", 0.72, "无人机飞控"),
  edge("air-traffic-systems", "satellite-internet", "market-comovement", 0.52, "低空通信和空管"),
  edge("evtol", "power-batteries", "industrial-chain", 0.58, "eVTOL电池需求"),
  edge("drones", "navigation-systems", "industrial-chain", 0.54, "无人机导航定位"),

  edge("semiconductors", "chip-design", "industrial-chain", 0.9, "半导体设计"),
  edge("semiconductors", "wafer-fabrication", "industrial-chain", 0.9, "晶圆制造"),
  edge("semiconductors", "semiconductor-equipment", "industrial-chain", 0.88, "制造装备"),
  edge("semiconductors", "photoresist", "industrial-chain", 0.82, "关键材料"),
  edge("semiconductors", "advanced-packaging", "industrial-chain", 0.78, "先进封装"),
  edge("wafer-fabrication", "semiconductor-equipment", "industrial-chain", 0.82, "设备驱动制造"),
  edge("photoresist", "wafer-fabrication", "industrial-chain", 0.72, "材料进入制造"),
  edge("advanced-packaging", "chip-design", "market-comovement", 0.55, "设计和封装协同"),
  edge("semiconductor-equipment", "defense-electronics", "market-comovement", 0.46, "自主可控硬科技"),

  edge("new-energy", "power-batteries", "industrial-chain", 0.9, "新能源核心储能部件"),
  edge("new-energy", "energy-storage", "industrial-chain", 0.86, "储能系统"),
  edge("new-energy", "photovoltaics", "industrial-chain", 0.84, "光伏发电"),
  edge("new-energy", "wind-power", "industrial-chain", 0.76, "风电发电"),
  edge("new-energy", "charging-infrastructure", "industrial-chain", 0.7, "补能基础设施"),
  edge("power-batteries", "energy-storage", "market-comovement", 0.78, "电池和储能联动"),
  edge("photovoltaics", "energy-storage", "industrial-chain", 0.68, "光储配套"),
  edge("wind-power", "energy-storage", "industrial-chain", 0.6, "风储配套"),
  edge("charging-infrastructure", "power-batteries", "market-comovement", 0.48, "新能源车链条"),

  edge("defense-aerospace", "commercial-aerospace", "industrial-chain", 0.9, "航天发射应用"),
  edge("defense-aerospace", "satellite-internet", "industrial-chain", 0.86, "卫星通信"),
  edge("defense-aerospace", "navigation-systems", "industrial-chain", 0.82, "导航定位"),
  edge("defense-aerospace", "aerospace-materials", "industrial-chain", 0.78, "高端材料"),
  edge("defense-aerospace", "defense-electronics", "industrial-chain", 0.84, "军工电子"),
  edge("commercial-aerospace", "satellite-internet", "industrial-chain", 0.76, "发射和卫星互联网"),
  edge("navigation-systems", "satellite-internet", "market-comovement", 0.62, "空间信息链"),
  edge("aerospace-materials", "advanced-packaging", "market-comovement", 0.42, "高端制造交叉"),

  edge("innovative-medicine", "innovative-drugs", "industrial-chain", 0.92, "创新药研发"),
  edge("innovative-medicine", "cro-cdmo", "industrial-chain", 0.86, "研发生产外包"),
  edge("innovative-medicine", "medical-devices", "industrial-chain", 0.72, "医疗科技"),
  edge("innovative-medicine", "synthetic-biology", "industrial-chain", 0.74, "生物制造"),
  edge("innovative-medicine", "traditional-chinese-medicine", "market-comovement", 0.5, "医药防御属性"),
  edge("innovative-drugs", "cro-cdmo", "industrial-chain", 0.82, "药物研发服务链"),
  edge("synthetic-biology", "innovative-drugs", "market-comovement", 0.58, "生物技术创新"),
  edge("medical-devices", "sensors", "market-comovement", 0.38, "精密感知器件交叉")
]);

export function validateRelationshipEdges(
  edges: readonly RelationshipEdge[],
  sectorList: readonly Pick<Sector, "id">[]
): { valid: boolean; errors: string[] } {
  const validSectorIds = new Set(sectorList.map((sector) => sector.id));
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const candidate of edges) {
    const key = `${candidate.sourceSectorId}->${candidate.targetSectorId}`;
    if (seen.has(key)) {
      errors.push(`Duplicate relationship edge ${key}`);
    }
    seen.add(key);

    if (!validSectorIds.has(candidate.sourceSectorId)) {
      errors.push(`Unknown source sector ${candidate.sourceSectorId}`);
    }
    if (!validSectorIds.has(candidate.targetSectorId)) {
      errors.push(`Unknown target sector ${candidate.targetSectorId}`);
    }
    if (candidate.weight <= 0 || candidate.weight > 1) {
      errors.push(`Invalid relationship weight ${candidate.weight} for ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/domain/relationshipRegistry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit relationship registry**

```bash
git add src/domain/relationshipRegistry.ts src/domain/relationshipRegistry.test.ts
git commit -m "feat: add gen2 relationship registry"
```

## Task 4: Add Layout Stages And Expanded Demo Scenarios

**Files:**

- Create: `src/domain/layoutStages.ts`
- Create: `src/domain/layoutStages.test.ts`
- Modify: `src/domain/scenarioDataProvider.ts`
- Modify: `src/domain/scenarioDataProvider.test.ts`

- [ ] **Step 1: Write failing stage tests**

Create `src/domain/layoutStages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { layoutStages, getLayoutStageById } from "./layoutStages";
import { sectors, themes } from "./themeRegistry";

describe("layoutStages", () => {
  it("defines three market-stage layout versions", () => {
    expect(layoutStages.map((stage) => stage.id)).toEqual([
      "ai-semiconductor-resonance",
      "robotics-low-altitude-diffusion",
      "new-energy-defense-rotation"
    ]);
  });

  it("provides theme heat and sector heat for every renderable item", () => {
    for (const stage of layoutStages) {
      for (const theme of themes) {
        expect(stage.themeHeat[theme.id]).toEqual(expect.any(Number));
      }
      for (const sector of sectors) {
        expect(stage.sectorHeat[sector.id]).toEqual(expect.any(Number));
      }
    }
  });

  it("looks up stages by id", () => {
    expect(getLayoutStageById("robotics-low-altitude-diffusion").label).toBe("机器人/低空扩散");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/layoutStages.test.ts`

Expected: FAIL because `layoutStages.ts` does not exist.

- [ ] **Step 3: Create layout stages**

Create `src/domain/layoutStages.ts`:

```ts
import { sectors, themes } from "./themeRegistry";
import type { LayoutStage, LayoutStageId, SectorId, ThemeId } from "./types";

const heat = (
  highThemes: readonly ThemeId[],
  warmThemes: readonly ThemeId[]
): { themeHeat: Record<ThemeId, number>; sectorHeat: Record<SectorId, number> } => {
  const themeHeat: Record<ThemeId, number> = {};
  const sectorHeat: Record<SectorId, number> = {};

  for (const theme of themes) {
    themeHeat[theme.id] = highThemes.includes(theme.id)
      ? 1
      : warmThemes.includes(theme.id)
        ? 0.62
        : 0.28;
  }

  for (const sector of sectors) {
    const base = themeHeat[sector.primaryThemeId] ?? 0.2;
    sectorHeat[sector.id] = Number((sector.isThemeCenter ? base : Math.max(0.12, base - 0.08)).toFixed(2));
  }

  return { themeHeat, sectorHeat };
};

const stage = (
  id: LayoutStageId,
  label: string,
  story: string,
  highThemes: readonly ThemeId[],
  warmThemes: readonly ThemeId[],
  previousStageId?: LayoutStageId
): LayoutStage => ({
  id,
  label,
  story,
  previousStageId,
  ...heat(highThemes, warmThemes)
});

export const layoutStages: readonly LayoutStage[] = Object.freeze([
  stage(
    "ai-semiconductor-resonance",
    "AI/半导体共振",
    "AI算力与半导体供应链共振，硬科技主线靠近视觉中心。",
    ["ai-computing", "semiconductors"],
    ["robotics-physical-ai"]
  ),
  stage(
    "robotics-low-altitude-diffusion",
    "机器人/低空扩散",
    "机器人与低空经济扩散，感知、控制、航空器相关板块升温。",
    ["robotics-physical-ai", "low-altitude-economy"],
    ["ai-computing", "defense-aerospace"],
    "ai-semiconductor-resonance"
  ),
  stage(
    "new-energy-defense-rotation",
    "新能源/军工轮动",
    "新能源与军工航天获得资金关注，前期科技主线进入整理。",
    ["new-energy", "defense-aerospace"],
    ["innovative-medicine"],
    "robotics-low-altitude-diffusion"
  )
]);

export function getLayoutStageById(stageId: LayoutStageId): LayoutStage {
  const stage = layoutStages.find((candidate) => candidate.id === stageId);
  if (!stage) {
    throw new Error(`Unknown layout stage ${stageId}`);
  }
  return stage;
}
```

- [ ] **Step 4: Update scenario provider tests**

In `src/domain/scenarioDataProvider.test.ts`, update the scenario coverage test to assert every scenario point covers every sector:

```ts
it("provides a value for every sector in every scenario", () => {
  const provider = createScenarioDataProvider();

  for (const scenario of provider.getScenarios()) {
    expect(scenario.points).toHaveLength(sectors.length);
    expect(new Set(scenario.points.map((point) => point.sectorId)).size).toBe(sectors.length);
  }
});
```

- [ ] **Step 5: Update scenario provider implementation**

In `src/domain/scenarioDataProvider.ts`, generate points from `layoutStages` and `sectors`:

```ts
import { layoutStages } from "./layoutStages";
import { sectors } from "./themeRegistry";
import type { DataProvider, MarketScenario, ReadonlyNonEmptyArray } from "./types";

const heatToInflow = (heat: number, isThemeCenter: boolean): number => {
  const base = heat >= 0.9 ? 96 : heat >= 0.55 ? 42 : -18;
  return isThemeCenter ? base * 1.35 : base;
};

const scenarios = layoutStages.map((stage, index) => ({
  id: `S${index + 1}`,
  label: stage.label,
  story: stage.story,
  points: sectors.map((sector) => ({
    sectorId: sector.id,
    netInflow: Number(heatToInflow(stage.sectorHeat[sector.id] ?? 0.2, sector.isThemeCenter).toFixed(1))
  }))
})) as ReadonlyNonEmptyArray<MarketScenario>;

export function createScenarioDataProvider(): DataProvider {
  return {
    getScenarios: () => scenarios
  };
}
```

Keep any existing `getScenarioIds` export if it already lives in `useHunterState.ts`; do not move it in this task.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/domain/layoutStages.test.ts src/domain/scenarioDataProvider.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit stages and expanded scenarios**

```bash
git add src/domain/layoutStages.ts src/domain/layoutStages.test.ts src/domain/scenarioDataProvider.ts src/domain/scenarioDataProvider.test.ts
git commit -m "feat: add gen2 layout stages"
```

## Task 5: Implement Algorithmic Layout Engine

**Files:**

- Create: `src/domain/algorithmicLayoutEngine.ts`
- Create: `src/domain/algorithmicLayoutEngine.test.ts`

- [ ] **Step 1: Write failing algorithm tests**

Create `src/domain/algorithmicLayoutEngine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAlgorithmicLayout } from "./algorithmicLayoutEngine";
import { layoutStages } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { sectors, themes } from "./themeRegistry";

const runLayout = (stageId = "ai-semiconductor-resonance") =>
  createAlgorithmicLayout({
    themes,
    sectors,
    relationshipEdges,
    stage: layoutStages.find((stage) => stage.id === stageId)!,
    previousStage:
      stageId === "ai-semiconductor-resonance"
        ? undefined
        : layoutStages.find((stage) => stage.id === "ai-semiconductor-resonance"),
    options: {
      gridWidth: 15,
      gridHeight: 11,
      maxStageShift: 1.6,
      centerPullStrength: 1.2
    }
  });

describe("createAlgorithmicLayout", () => {
  it("is deterministic", () => {
    expect(runLayout().layout.cells).toEqual(runLayout().layout.cells);
  });

  it("assigns exactly one non-overlapping grid cell per sector", () => {
    const result = runLayout();
    const keys = result.layout.cells.map((cell) => `${cell.x},${cell.z}`);

    expect(result.layout.cells).toHaveLength(sectors.length);
    expect(new Set(result.layout.cells.map((cell) => cell.sectorId)).size).toBe(sectors.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("places strongly related sectors closer than unrelated sectors", () => {
    const result = runLayout();
    const byId = new Map(result.layout.cells.map((cell) => [cell.sectorId, cell]));
    const distance = (a: string, b: string) => {
      const first = byId.get(a)!;
      const second = byId.get(b)!;
      return Math.abs(first.x - second.x) + Math.abs(first.z - second.z);
    };

    expect(distance("ai-computing", "optical-modules")).toBeLessThan(
      distance("ai-computing", "traditional-chinese-medicine")
    );
  });

  it("moves hot themes closer to center across stages with previous positions", () => {
    const result = runLayout("robotics-low-altitude-diffusion");
    const robotics = result.layout.cells.find((cell) => cell.sectorId === "robotics-physical-ai")!;

    expect(robotics.previousPosition).toBeDefined();
    expect(Math.abs(robotics.x) + Math.abs(robotics.z)).toBeLessThanOrEqual(4);
  });

  it("generates explanations for every sector", () => {
    const result = runLayout();
    expect(Object.keys(result.explanations)).toHaveLength(sectors.length);
    expect(result.explanations["ai-computing"].reasons.length).toBeGreaterThanOrEqual(3);
    expect(result.explanations["optical-modules"].reasons[0].relatedSectorId).toBe("ai-computing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/algorithmicLayoutEngine.test.ts`

Expected: FAIL because `algorithmicLayoutEngine.ts` does not exist.

- [ ] **Step 3: Implement deterministic hybrid layout**

Create `src/domain/algorithmicLayoutEngine.ts`:

```ts
import type {
  LayoutExplanation,
  LayoutStage,
  RelationshipEdge,
  Sector,
  SectorLayout,
  Theme
} from "./types";

interface LayoutOptions {
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly maxStageShift: number;
  readonly centerPullStrength: number;
}

interface AlgorithmicLayoutInput {
  readonly themes: readonly Readonly<Theme>[];
  readonly sectors: readonly Readonly<Sector>[];
  readonly relationshipEdges: readonly RelationshipEdge[];
  readonly stage: LayoutStage;
  readonly previousStage?: LayoutStage;
  readonly options: LayoutOptions;
}

interface AlgorithmicLayoutResult {
  readonly layout: SectorLayout;
  readonly explanations: Readonly<Record<string, LayoutExplanation>>;
}

interface Point {
  readonly x: number;
  readonly z: number;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

const themeAnchor = (index: number, count: number, stageHeat: number, options: LayoutOptions): Point => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const baseRadius = 5.2;
  const inwardShift = clamp(stageHeat, 0, 1) * options.centerPullStrength;
  const radius = Math.max(2.4, baseRadius - inwardShift);
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  };
};

const sectorOffset = (index: number, count: number): Point => {
  if (index === 0) return { x: 0, z: 0 };
  const ring = Math.ceil(index / 6);
  const angle = (Math.PI * 2 * (index - 1)) / Math.max(1, count - 1);
  return {
    x: Math.cos(angle) * ring * 1.1,
    z: Math.sin(angle) * ring * 1.1
  };
};

const relationPull = (
  sector: Readonly<Sector>,
  edges: readonly RelationshipEdge[],
  anchorsByTheme: ReadonlyMap<string, Point>,
  sectorsById: ReadonlyMap<string, Readonly<Sector>>
): Point => {
  const related = edges
    .filter((edge) => edge.sourceSectorId === sector.id || edge.targetSectorId === sector.id)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  if (related.length === 0) return { x: 0, z: 0 };

  let x = 0;
  let z = 0;
  let total = 0;

  for (const edge of related) {
    const otherId = edge.sourceSectorId === sector.id ? edge.targetSectorId : edge.sourceSectorId;
    const other = sectorsById.get(otherId);
    if (!other) continue;
    const anchor = anchorsByTheme.get(other.primaryThemeId);
    if (!anchor) continue;
    x += anchor.x * edge.weight;
    z += anchor.z * edge.weight;
    total += edge.weight;
  }

  if (total === 0) return { x: 0, z: 0 };

  return {
    x: (x / total) * 0.18,
    z: (z / total) * 0.18
  };
};

const snapToGrid = (
  desired: readonly { sector: Readonly<Sector>; point: Point; strength: 1 | 2 | 3 }[],
  options: LayoutOptions
) => {
  const occupied = new Set<string>();
  const sorted = [...desired].sort((a, b) => {
    if (a.sector.isThemeCenter !== b.sector.isThemeCenter) return a.sector.isThemeCenter ? -1 : 1;
    return a.sector.id.localeCompare(b.sector.id);
  });

  return sorted.map(({ sector, point, strength }) => {
    let best: Point | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    const halfWidth = Math.floor(options.gridWidth / 2);
    const halfHeight = Math.floor(options.gridHeight / 2);

    for (let x = -halfWidth; x <= halfWidth; x += 1) {
      for (let z = -halfHeight; z <= halfHeight; z += 1) {
        const key = `${x},${z}`;
        if (occupied.has(key)) continue;
        const candidate = { x, z };
        const distance = manhattan(candidate, point);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }

    if (!best) {
      throw new Error(`No grid cell available for ${sector.id}`);
    }

    occupied.add(`${best.x},${best.z}`);
    return {
      sectorId: sector.id,
      x: best.x,
      z: best.z,
      role: sector.isThemeCenter ? "theme-center" : "related-sector",
      relationshipStrength: strength
    } as const;
  });
};

const buildExplanations = (
  sectors: readonly Readonly<Sector>[],
  edges: readonly RelationshipEdge[],
  stage: LayoutStage
): Record<string, LayoutExplanation> => {
  const explanations: Record<string, LayoutExplanation> = {};

  for (const sector of sectors) {
    const reasons = edges
      .filter((edge) => edge.sourceSectorId === sector.id || edge.targetSectorId === sector.id)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((edge) => ({
        relatedSectorId: edge.sourceSectorId === sector.id ? edge.targetSectorId : edge.sourceSectorId,
        relationshipType: edge.type,
        weight: edge.weight,
        note: edge.note,
        stageInfluenced: (stage.sectorHeat[sector.id] ?? 0) >= 0.55
      }));

    explanations[sector.id] = {
      sectorId: sector.id,
      summary:
        reasons.length > 0
          ? `靠近 ${reasons[0].relatedSectorId}，主要因为${reasons[0].note}。`
          : "主题中心锚定在本阶段的基础位置。",
      reasons
    };
  }

  return explanations;
};

export function createAlgorithmicLayout(input: AlgorithmicLayoutInput): AlgorithmicLayoutResult {
  const anchorsByTheme = new Map(
    input.themes.map((theme, index) => [
      theme.id,
      themeAnchor(index, input.themes.length, input.stage.themeHeat[theme.id] ?? 0.2, input.options)
    ])
  );
  const sectorsById = new Map(input.sectors.map((sector) => [sector.id, sector]));
  const sectorIndexByTheme = new Map<string, number>();

  const desired = input.sectors.map((sector) => {
    const themePosition = anchorsByTheme.get(sector.primaryThemeId) ?? { x: 0, z: 0 };
    const localIndex = sectorIndexByTheme.get(sector.primaryThemeId) ?? 0;
    sectorIndexByTheme.set(sector.primaryThemeId, localIndex + 1);
    const offset = sectorOffset(localIndex, input.sectors.filter((candidate) => candidate.primaryThemeId === sector.primaryThemeId).length);
    const pull = relationPull(sector, input.relationshipEdges, anchorsByTheme, sectorsById);
    const heat = input.stage.sectorHeat[sector.id] ?? 0.2;

    return {
      sector,
      point: {
        x: themePosition.x + offset.x + pull.x - heat * 0.25,
        z: themePosition.z + offset.z + pull.z - heat * 0.25
      },
      strength: (heat >= 0.8 ? 3 : heat >= 0.5 ? 2 : 1) as 1 | 2 | 3
    };
  });

  const cells = snapToGrid(desired, input.options);
  const previousCells = input.previousStage
    ? createAlgorithmicLayout({ ...input, stage: input.previousStage, previousStage: undefined }).layout.cells
    : [];
  const previousById = new Map(previousCells.map((cell) => [cell.sectorId, cell]));
  const cellsWithPrevious = cells.map((cell) => {
    const previous = previousById.get(cell.sectorId);
    return previous ? { ...cell, previousPosition: { x: previous.x, z: previous.z } } : cell;
  });
  const explanations = buildExplanations(input.sectors, input.relationshipEdges, input.stage);

  return {
    layout: {
      cells: cellsWithPrevious,
      version: `algorithmic-${input.stage.id}`,
      stageId: input.stage.id,
      explanations
    },
    explanations
  };
}
```

Keep all helpers private except `createAlgorithmicLayout`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/domain/algorithmicLayoutEngine.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit algorithm engine**

```bash
git add src/domain/algorithmicLayoutEngine.ts src/domain/algorithmicLayoutEngine.test.ts
git commit -m "feat: add algorithmic layout engine"
```

## Task 6: Add Algorithmic Layout Provider

**Files:**

- Modify: `src/domain/layoutProvider.ts`
- Modify: `src/domain/layoutProvider.test.ts`

- [ ] **Step 1: Write failing provider tests**

Add these tests to `src/domain/layoutProvider.test.ts`:

```ts
it("creates an algorithmic layout provider with stage metadata", () => {
  const provider = createAlgorithmicLayoutProvider();
  const layout = provider.getLayout("robotics-low-altitude-diffusion");

  expect(layout.stageId).toBe("robotics-low-altitude-diffusion");
  expect(layout.version).toBe("algorithmic-robotics-low-altitude-diffusion");
  expect(layout.cells).toHaveLength(42);
  expect(layout.explanations?.["robotics-physical-ai"].reasons.length).toBeGreaterThanOrEqual(3);
});

it("falls back to the first layout stage when no stage id is passed", () => {
  const provider = createAlgorithmicLayoutProvider();

  expect(provider.getLayout().stageId).toBe("ai-semiconductor-resonance");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/layoutProvider.test.ts`

Expected: FAIL because `createAlgorithmicLayoutProvider` does not exist.

- [ ] **Step 3: Add provider adapter**

In `src/domain/layoutProvider.ts`, import the algorithm engine, relationship edges, registry, and stages. Keep `createManualLayoutProvider` intact, then add:

```ts
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
          gridWidth: 15,
          gridHeight: 11,
          maxStageShift: 1.6,
          centerPullStrength: 1.2
        }
      });

      return {
        ...result.layout,
        cells: result.layout.cells.map((cell) => ({ ...cell }))
      };
    }
  };
}
```

Also update `manualLayout` to include the 18 original cells only and return `version: "manual-v1"` and `stageId: "manual"`. This preserves manual layout as a v1 comparison mode; it does not need to cover all 42 sectors.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/domain/layoutProvider.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit provider integration**

```bash
git add src/domain/layoutProvider.ts src/domain/layoutProvider.test.ts
git commit -m "feat: expose algorithmic layout provider"
```

## Task 7: Propagate Layout Explanations Through Render Nodes

**Files:**

- Modify: `src/domain/renderNodes.ts`
- Modify: `src/domain/renderNodes.test.ts`

- [ ] **Step 1: Write failing render-node tests**

Add this test to `src/domain/renderNodes.test.ts`:

```ts
it("attaches layout explanations to render nodes", () => {
  const provider = createAlgorithmicLayoutProvider();
  const layout = provider.getLayout("ai-semiconductor-resonance");
  const scenario = createScenarioDataProvider().getScenarios()[0];

  const nodes = buildRenderNodes({
    layout,
    scenario,
    themeFilter: "all",
    capitalStateFilter: "all",
    showCentersOnly: false
  });

  const aiNode = nodes.find((node) => node.sector.id === "ai-computing");
  expect(aiNode?.layoutExplanation?.reasons.length).toBeGreaterThanOrEqual(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/renderNodes.test.ts`

Expected: FAIL until `RenderNode` construction reads `layout.explanations`.

- [ ] **Step 3: Attach explanation metadata**

In `src/domain/renderNodes.ts`, inside the object returned for each node, add:

```ts
layoutExplanation: input.layout.explanations?.[cell.sectorId]
```

Do not change filter behavior in this task.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/domain/renderNodes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit render-node explanation propagation**

```bash
git add src/domain/renderNodes.ts src/domain/renderNodes.test.ts
git commit -m "feat: attach layout explanations to render nodes"
```

## Task 8: Add UI State For Layout Mode And Stages

**Files:**

- Modify: `src/state/useHunterState.ts`
- Modify: `src/state/useHunterState.test.tsx`

- [ ] **Step 1: Write failing state tests**

Add this test to `src/state/useHunterState.test.tsx`:

```ts
it("tracks layout mode, layout stage, and previous-stage comparison", () => {
  const { result } = renderHook(() =>
    useHunterState(["S1", "S2", "S3"], ["ai-semiconductor-resonance", "robotics-low-altitude-diffusion"])
  );

  expect(result.current.layoutMode).toBe("algorithmic");
  expect(result.current.activeLayoutStageId).toBe("ai-semiconductor-resonance");
  expect(result.current.comparePreviousStage).toBe(false);

  act(() => result.current.setLayoutMode("manual"));
  act(() => result.current.setActiveLayoutStageId("robotics-low-altitude-diffusion"));
  act(() => result.current.setComparePreviousStage(true));

  expect(result.current.layoutMode).toBe("manual");
  expect(result.current.activeLayoutStageId).toBe("robotics-low-altitude-diffusion");
  expect(result.current.comparePreviousStage).toBe(true);
});
```

Update existing test calls to pass the second argument: `useHunterState(["S1", "S2"], ["ai-semiconductor-resonance"])`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/state/useHunterState.test.tsx`

Expected: FAIL because `useHunterState` accepts only scenario ids and does not expose layout fields.

- [ ] **Step 3: Extend state hook**

Update `useHunterState` signature:

```ts
export function useHunterState(
  scenarioIds: ReadonlyNonEmptyArray<string>,
  layoutStageIds: ReadonlyNonEmptyArray<string>
) {
```

Add state:

```ts
const [layoutMode, setLayoutMode] = useState<LayoutMode>("algorithmic");
const [activeLayoutStageId, setActiveLayoutStageId] = useState(layoutStageIds[0]);
const [comparePreviousStage, setComparePreviousStage] = useState(false);
```

Return these values and setters from the hook:

```ts
layoutMode,
setLayoutMode,
activeLayoutStageId,
setActiveLayoutStageId,
comparePreviousStage,
setComparePreviousStage
```

Keep existing scenario, filter, camera, and selected-sector behavior unchanged.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/state/useHunterState.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit state expansion**

```bash
git add src/state/useHunterState.ts src/state/useHunterState.test.tsx
git commit -m "feat: add gen2 layout state"
```

## Task 9: Add Controls And Dataset Summary Components

**Files:**

- Modify: `src/components/ControlsPanel.tsx`
- Modify: `src/components/ControlsPanel.test.tsx`
- Create: `src/components/DatasetSummary.tsx`
- Create: `src/components/DatasetSummary.test.tsx`

- [ ] **Step 1: Write failing controls tests**

Add to `src/components/ControlsPanel.test.tsx`:

```ts
it("changes layout mode, layout stage, and comparison mode", async () => {
  const user = userEvent.setup();
  const onLayoutModeChange = vi.fn();
  const onLayoutStageChange = vi.fn();
  const onComparePreviousStageChange = vi.fn();

  render(
    <ControlsPanel
      scenarios={scenarios}
      themes={themes}
      layoutStages={[
        { id: "ai-semiconductor-resonance", label: "AI/半导体共振" },
        { id: "robotics-low-altitude-diffusion", label: "机器人/低空扩散" }
      ]}
      activeScenarioId="S1"
      activeLayoutStageId="ai-semiconductor-resonance"
      layoutMode="algorithmic"
      comparePreviousStage={false}
      themeFilter="all"
      capitalStateFilter="all"
      cameraPreset="angled"
      showCentersOnly={false}
      onScenarioChange={vi.fn()}
      onLayoutModeChange={onLayoutModeChange}
      onLayoutStageChange={onLayoutStageChange}
      onComparePreviousStageChange={onComparePreviousStageChange}
      onThemeFilterChange={vi.fn()}
      onCapitalStateFilterChange={vi.fn()}
      onCameraPresetChange={vi.fn()}
      onShowCentersOnlyChange={vi.fn()}
    />
  );

  await user.selectOptions(screen.getByLabelText("布局模式"), "manual");
  await user.selectOptions(screen.getByLabelText("布局阶段"), "robotics-low-altitude-diffusion");
  await user.click(screen.getByLabelText("对比上一阶段"));

  expect(onLayoutModeChange).toHaveBeenCalledWith("manual");
  expect(onLayoutStageChange).toHaveBeenCalledWith("robotics-low-altitude-diffusion");
  expect(onComparePreviousStageChange).toHaveBeenCalledWith(true);
});
```

Create `src/components/DatasetSummary.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DatasetSummary } from "./DatasetSummary";

describe("DatasetSummary", () => {
  it("renders dataset and layout metadata", () => {
    render(
      <DatasetSummary
        summary={{
          themeCount: 7,
          sectorCount: 42,
          relationshipEdgeCount: 68,
          layoutVersion: "algorithmic-ai-semiconductor-resonance",
          activeStageLabel: "AI/半导体共振"
        }}
      />
    );

    expect(screen.getByText("7 条主线")).toBeVisible();
    expect(screen.getByText("42 个板块")).toBeVisible();
    expect(screen.getByText("68 条关系")).toBeVisible();
    expect(screen.getByText("AI/半导体共振")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/components/ControlsPanel.test.tsx src/components/DatasetSummary.test.tsx`

Expected: FAIL because props and component do not exist yet.

- [ ] **Step 3: Extend controls props and UI**

In `ControlsPanel.tsx`, add props:

```ts
layoutStages: readonly { id: string; label: string }[];
activeLayoutStageId: string;
layoutMode: LayoutMode;
comparePreviousStage: boolean;
onLayoutModeChange: (mode: LayoutMode) => void;
onLayoutStageChange: (stageId: string) => void;
onComparePreviousStageChange: (compare: boolean) => void;
```

Add a new control section before filters:

```tsx
<section className="control-section">
  <div className="section-title">
    <Layers3 size={16} aria-hidden="true" />
    <span>底座布局</span>
  </div>
  <label>
    <span>布局模式</span>
    <select
      aria-label="布局模式"
      value={props.layoutMode}
      onChange={(event) => props.onLayoutModeChange(event.target.value as LayoutMode)}
    >
      <option value="algorithmic">算法布局</option>
      <option value="manual">手工布局</option>
    </select>
  </label>
  <label>
    <span>布局阶段</span>
    <select
      aria-label="布局阶段"
      value={props.activeLayoutStageId}
      onChange={(event) => props.onLayoutStageChange(event.target.value)}
      disabled={props.layoutMode === "manual"}
    >
      {props.layoutStages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.label}
        </option>
      ))}
    </select>
  </label>
  <label className="checkbox-row">
    <input
      type="checkbox"
      aria-label="对比上一阶段"
      checked={props.comparePreviousStage}
      disabled={props.layoutMode === "manual"}
      onChange={(event) => props.onComparePreviousStageChange(event.target.checked)}
    />
    <span>对比上一阶段</span>
  </label>
</section>
```

- [ ] **Step 4: Create dataset summary component**

Create `src/components/DatasetSummary.tsx`:

```tsx
import type { DatasetSummary as DatasetSummaryModel } from "../domain/types";

interface DatasetSummaryProps {
  summary: DatasetSummaryModel;
}

export function DatasetSummary({ summary }: DatasetSummaryProps) {
  return (
    <section className="dataset-summary" aria-label="题材池规模">
      <span>{summary.themeCount} 条主线</span>
      <span>{summary.sectorCount} 个板块</span>
      <span>{summary.relationshipEdgeCount} 条关系</span>
      <span>{summary.activeStageLabel}</span>
      <span>{summary.layoutVersion}</span>
    </section>
  );
}
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/components/ControlsPanel.test.tsx src/components/DatasetSummary.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit controls and summary**

```bash
git add src/components/ControlsPanel.tsx src/components/ControlsPanel.test.tsx src/components/DatasetSummary.tsx src/components/DatasetSummary.test.tsx
git commit -m "feat: add gen2 layout controls"
```

## Task 10: Render Layout Explanations In Inspector

**Files:**

- Modify: `src/components/InspectorPanel.tsx`
- Modify: `src/components/InspectorPanel.test.tsx`

- [ ] **Step 1: Write failing inspector test**

Add to `src/components/InspectorPanel.test.tsx`:

```ts
it("renders layout explanation reasons", () => {
  render(
    <InspectorPanel
      node={{
        ...buildRenderNode(),
        layoutExplanation: {
          sectorId: "ai-computing",
          summary: "靠近 optical-modules，主要因为AI数据中心高速互联。",
          reasons: [
            {
              relatedSectorId: "optical-modules",
              relationshipType: "industrial-chain",
              weight: 0.95,
              note: "AI数据中心高速互联",
              stageInfluenced: true
            }
          ]
        }
      }}
    />
  );

  expect(screen.getByText("布局解释")).toBeVisible();
  expect(screen.getByText("AI数据中心高速互联")).toBeVisible();
  expect(screen.getByText("产业链")).toBeVisible();
  expect(screen.getByText("0.95")).toBeVisible();
});
```

If the test helper is not named `buildRenderNode`, add a local helper in the test file that returns a minimal `RenderNode`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/InspectorPanel.test.tsx`

Expected: FAIL because `InspectorPanel` does not render explanation details.

- [ ] **Step 3: Add explanation section**

In `InspectorPanel.tsx`, add this mapping helper:

```ts
const relationshipTypeLabel = {
  "industrial-chain": "产业链",
  "market-comovement": "市场联动",
  "heat-correction": "热度修正"
} as const;
```

Inside the selected-node branch, render:

```tsx
{props.node.layoutExplanation ? (
  <section className="layout-explanation">
    <h3>布局解释</h3>
    <p>{props.node.layoutExplanation.summary}</p>
    {props.node.layoutExplanation.reasons.map((reason) => (
      <div className="reason-row" key={`${reason.relatedSectorId}-${reason.relationshipType}`}>
        <span>{relationshipTypeLabel[reason.relationshipType]}</span>
        <strong>{reason.weight.toFixed(2)}</strong>
        <p>{reason.note}</p>
      </div>
    ))}
  </section>
) : null}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/components/InspectorPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit inspector explanation**

```bash
git add src/components/InspectorPanel.tsx src/components/InspectorPanel.test.tsx
git commit -m "feat: show layout explanations"
```

## Task 11: Wire Gen2 App Composition

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing app tests**

Add to `src/App.test.tsx`:

```ts
it("renders gen2 dataset summary and layout controls", () => {
  render(<App />);

  expect(screen.getByText("7 条主线")).toBeVisible();
  expect(screen.getByText("42 个板块")).toBeVisible();
  expect(screen.getByLabelText("布局模式")).toBeVisible();
  expect(screen.getByLabelText("布局阶段")).toBeVisible();
});

it("switches layout stages and shows explanation when selecting a sector", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.selectOptions(screen.getByLabelText("布局阶段"), "robotics-low-altitude-diffusion");
  expect(screen.getByText("机器人/低空扩散")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because `App` has not wired gen2 controls and summary.

- [ ] **Step 3: Wire providers and state in `App.tsx`**

Use both providers:

```ts
const manualLayoutProvider = createManualLayoutProvider();
const algorithmicLayoutProvider = createAlgorithmicLayoutProvider();
```

Pass both scenario ids and stage ids to state:

```ts
const scenarios = scenarioDataProvider.getScenarios();
const scenarioIds = getScenarioIds(scenarios);
const layoutStageIds = layoutStages.map((stage) => stage.id) as ReadonlyNonEmptyArray<string>;
const hunterState = useHunterState(scenarioIds, layoutStageIds);
```

Select layout:

```ts
const layout =
  hunterState.layoutMode === "manual"
    ? manualLayoutProvider.getLayout()
    : algorithmicLayoutProvider.getLayout(hunterState.activeLayoutStageId);
```

Build summary:

```ts
const activeStage = getLayoutStageById(hunterState.activeLayoutStageId);
const datasetSummary = {
  themeCount: themes.length,
  sectorCount: sectors.length,
  relationshipEdgeCount: relationshipEdges.length,
  layoutVersion: layout.version ?? "manual-v1",
  activeStageLabel: hunterState.layoutMode === "manual" ? "手工布局" : activeStage.label
};
```

Render `<DatasetSummary summary={datasetSummary} />` near the top of the workspace. Pass all new control props to `ControlsPanel`.

When `comparePreviousStage` is false, strip `previousPosition` before passing render nodes to the scene:

```ts
const sceneNodes = hunterState.comparePreviousStage
  ? nodes
  : nodes.map((node) => ({ ...node, cell: { ...node.cell, previousPosition: undefined } }));
```

- [ ] **Step 4: Add compact styles**

In `src/App.css`, add:

```css
.dataset-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  color: #aeb8b5;
  font-size: 12px;
}

.dataset-summary span {
  border: 1px solid #334045;
  border-radius: 999px;
  background: rgba(16, 21, 20, 0.72);
  padding: 5px 9px;
}

.layout-explanation h3 {
  margin: 18px 0 8px;
  font-size: 16px;
}

.reason-row {
  border-top: 1px solid #2e3838;
  padding: 10px 0;
}

.reason-row span {
  color: #d7dfdc;
  font-size: 12px;
}

.reason-row strong {
  float: right;
}
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit app wiring**

```bash
git add src/App.tsx src/App.css src/App.test.tsx
git commit -m "feat: wire gen2 layout experience"
```

## Task 12: Add Previous-Stage Markers In 3D Scene

**Files:**

- Modify: `src/components/CapitalMapScene.tsx`
- Modify: `src/components/CapitalMapScene.test.tsx`

- [ ] **Step 1: Write failing helper test**

Add helper export and test in `src/components/CapitalMapScene.test.tsx`:

```ts
it("detects nodes with previous layout positions", () => {
  expect(
    hasPreviousLayoutPosition({
      ...buildNode(true),
      cell: {
        sectorId: "ai-computing",
        x: 1,
        z: 1,
        role: "theme-center",
        relationshipStrength: 3,
        previousPosition: { x: -1, z: 0 }
      }
    })
  ).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/CapitalMapScene.test.tsx`

Expected: FAIL because `hasPreviousLayoutPosition` does not exist.

- [ ] **Step 3: Add marker helper and marker mesh**

In `CapitalMapScene.tsx`, export:

```ts
export function hasPreviousLayoutPosition(node: RenderNode): boolean {
  return Boolean(node.cell.previousPosition);
}
```

Inside each node group, render a previous marker before the base cell when present:

```tsx
{node.cell.previousPosition ? (
  <mesh
    position={[
      node.cell.previousPosition.x - node.cell.x,
      0.015,
      node.cell.previousPosition.z - node.cell.z
    ]}
    visible={node.visible}
  >
    <boxGeometry args={[CELL_SIZE * 0.72, BASE_CELL_THICKNESS * 0.5, CELL_SIZE * 0.72]} />
    <meshStandardMaterial color="#ffffff" opacity={0.16} transparent />
  </mesh>
) : null}
```

This marker is relative to the current node group and appears as a ghost of the previous stage.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/components/CapitalMapScene.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit previous-stage markers**

```bash
git add src/components/CapitalMapScene.tsx src/components/CapitalMapScene.test.tsx
git commit -m "feat: show previous layout markers"
```

## Task 13: Add Experimental Public Data Adapter Contract

**Files:**

- Create: `src/domain/publicDataAdapter.ts`
- Create: `src/domain/publicDataAdapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `src/domain/publicDataAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapPublicSnapshotToStageSignals } from "./publicDataAdapter";

describe("publicDataAdapter", () => {
  it("normalizes a public-data snapshot into stage signals", () => {
    const result = mapPublicSnapshotToStageSignals({
      source: "sample-public-source",
      timestamp: "2026-06-08T09:30:00+08:00",
      sectorFundFlow: [
        { sectorId: "ai-computing", netInflow: 128 },
        { sectorId: "semiconductors", netInflow: 86 },
        { sectorId: "traditional-chinese-medicine", netInflow: -22 }
      ]
    });

    expect(result.source).toBe("sample-public-source");
    expect(result.timestamp).toBe("2026-06-08T09:30:00+08:00");
    expect(result.sectorHeat["ai-computing"]).toBe(1);
    expect(result.sectorHeat["traditional-chinese-medicine"]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/publicDataAdapter.test.ts`

Expected: FAIL because `publicDataAdapter.ts` does not exist.

- [ ] **Step 3: Create adapter contract**

Create `src/domain/publicDataAdapter.ts`:

```ts
import type { SectorId } from "./types";

export interface PublicSectorFundFlowPoint {
  readonly sectorId: SectorId;
  readonly netInflow: number;
}

export interface PublicMarketSnapshot {
  readonly source: string;
  readonly timestamp: string;
  readonly sectorFundFlow: readonly PublicSectorFundFlowPoint[];
}

export interface StageSignalSnapshot {
  readonly source: string;
  readonly timestamp: string;
  readonly sectorHeat: Readonly<Record<SectorId, number>>;
}

export function mapPublicSnapshotToStageSignals(snapshot: PublicMarketSnapshot): StageSignalSnapshot {
  const maxAbs = Math.max(...snapshot.sectorFundFlow.map((point) => Math.abs(point.netInflow)), 1);
  const sectorHeat: Record<SectorId, number> = {};

  for (const point of snapshot.sectorFundFlow) {
    const normalized = point.netInflow <= 0 ? 0 : point.netInflow / maxAbs;
    sectorHeat[point.sectorId] = Number(Math.min(1, normalized).toFixed(2));
  }

  return {
    source: snapshot.source,
    timestamp: snapshot.timestamp,
    sectorHeat
  };
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/domain/publicDataAdapter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit adapter contract**

```bash
git add src/domain/publicDataAdapter.ts src/domain/publicDataAdapter.test.ts
git commit -m "feat: add public data adapter contract"
```

## Task 14: Update E2E And Full Verification

**Files:**

- Modify: `tests/e2e/a-capital-hunter.spec.ts`

- [ ] **Step 1: Update Playwright smoke test**

Replace `tests/e2e/a-capital-hunter.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";

test("renders the gen2 algorithmic capital hunter prototype", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "A Capital Hunter" })).toBeVisible();
  await expect(page.getByText("7 条主线")).toBeVisible();
  await expect(page.getByText("42 个板块")).toBeVisible();
  await expect(page.getByLabel("A Capital Hunter 3D资金峰面")).toBeVisible();

  await page.getByLabel("布局阶段").selectOption("robotics-low-altitude-diffusion");
  await expect(page.getByText("机器人/低空扩散")).toBeVisible();

  await page.getByLabel("对比上一阶段").check();
  await expect(page.getByLabel("对比上一阶段")).toBeChecked();

  await page.getByLabel("布局模式").selectOption("manual");
  await expect(page.getByLabel("布局模式")).toHaveValue("manual");
});
```

- [ ] **Step 2: Run full unit test suite**

Run: `npm test`

Expected: PASS with all domain, state, component, and app tests.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS. The existing Three.js large chunk warning may remain and is acceptable for this prototype.

- [ ] **Step 4: Run e2e smoke test**

Run: `npm run e2e`

Expected: PASS with one Chromium smoke test.

- [ ] **Step 5: Browser visual QA**

Start the dev server if it is not already running:

```bash
npm run dev -- --host 127.0.0.1
```

Use browser or Playwright visual QA to verify:

- Desktop page is not blank.
- 3D canvas renders nonblank pixels.
- Algorithmic layout shows expanded sector count.
- Stage switch changes the view without console errors.
- Compare previous stage shows ghost markers or movement hints.
- Mobile viewport does not horizontally overflow.

Save screenshots under `/private/tmp/a-capital-hunter-gen2-qa/` for final review.

- [ ] **Step 6: Check git status**

Run: `git status --short`

Expected: only the e2e file is modified before commit.

- [ ] **Step 7: Commit verification updates**

```bash
git add tests/e2e/a-capital-hunter.spec.ts
git commit -m "test: cover gen2 algorithmic prototype smoke"
```

## Final Verification Checklist

Before claiming implementation is complete, run these commands on the implementation branch:

```bash
npm test
npm run build
npm run e2e
git status --short
```

Expected results:

- `npm test`: all tests pass.
- `npm run build`: TypeScript and Vite build pass.
- `npm run e2e`: Chromium smoke passes.
- `git status --short`: clean.

Also perform visual QA on desktop and mobile, including canvas nonblank checks and a screenshot review of algorithmic layout, stage switching, and previous-stage comparison.

## Implementation Notes

- Keep the algorithm engine deterministic. Do not use `Math.random()`.
- Keep the 3D scene data-driven. It should receive render nodes; it should not import the relationship graph.
- Keep manual layout as a comparison mode. It is acceptable for manual mode to show only the first-generation sector subset.
- Do not introduce a real market-data dependency into the default app path.
- Do not expose algorithm tuning controls in the UI.
- Prefer focused commits after every task.

## Spec Coverage Review

- Expanded 7-theme / 40-60 sector universe: Tasks 1-2.
- Relationship graph and mixed weights: Task 3.
- Market-stage layout versions: Task 4.
- Deterministic hybrid layout engine: Task 5.
- Provider compatibility with v1 render pipeline: Tasks 6-7.
- Layout mode, stage selection, previous comparison: Tasks 8-12.
- Layout explanation in inspector: Tasks 7 and 10.
- Stable demo data plus experimental public-data adapter: Tasks 4 and 13.
- Tests and visual acceptance: Task 14.

No spec requirement is intentionally deferred from this implementation plan.
