# A Capital Hunter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop-first React/Three.js concept prototype that renders a configuration-driven A-share theme period table as a 3D discrete capital-column map with manual time-slice rotation and filters.

**Architecture:** Use a Vite React TypeScript app with a strict domain layer for themes, sectors, layout, mock data, normalization, and render-node composition. Keep the 3D scene dumb: it receives normalized render nodes and interaction state from the app shell, so future real data and algorithmic layout can replace the mock providers without changing the renderer.

**Tech Stack:** Vite, React, TypeScript, Three.js, `@react-three/fiber`, `@react-three/drei`, Vitest, React Testing Library, Playwright.

---

## Scope Check

The approved design covers one coherent prototype: a single web app with static configuration, mock scenario data, a 3D view, controls, and smoke tests. It does not need to be split into multiple independent implementation plans.

## File Structure

Create these files:

- `package.json`: scripts and dependencies.
- `index.html`: Vite entry document.
- `tsconfig.json`: strict TypeScript project config.
- `tsconfig.node.json`: TypeScript config for Vite and Vitest config files.
- `vite.config.ts`: Vite + React + Vitest setup.
- `playwright.config.ts`: Playwright smoke-test config.
- `src/main.tsx`: React entry point.
- `src/App.tsx`: app composition, filters, timeline, inspector, and scene container.
- `src/App.css`: dashboard layout and visual styling.
- `src/vite-env.d.ts`: Vite type declarations.
- `src/test/setup.ts`: Testing Library setup.
- `src/domain/types.ts`: shared domain and render types.
- `src/domain/themeRegistry.ts`: approved theme and sector metadata.
- `src/domain/layoutProvider.ts`: manual layout provider implementing the future-compatible layout interface.
- `src/domain/scenarioDataProvider.ts`: mock time-slice market stories and values.
- `src/domain/metricNormalizer.ts`: raw capital value to render-state conversion.
- `src/domain/renderNodes.ts`: composition layer joining registry, layout, scenario data, filters, and normalization.
- `src/state/useHunterState.ts`: typed React state hook for time slice, filters, camera preset, and selection.
- `src/components/ControlsPanel.tsx`: timeline, filters, and camera preset controls.
- `src/components/InspectorPanel.tsx`: minimal sector information.
- `src/components/HunterScene.tsx`: React Three Fiber canvas wrapper.
- `src/components/CapitalMapScene.tsx`: 3D base cells, labels, columns, and camera preset behavior.
- `src/components/SceneLegend.tsx`: compact financial color legend.
- `src/domain/*.test.ts`: domain tests.
- `src/state/useHunterState.test.tsx`: state-hook tests.
- `src/components/ControlsPanel.test.tsx`: control behavior tests.
- `tests/e2e/a-capital-hunter.spec.ts`: Playwright smoke test.

Modify these files:

- `.gitignore`: add dependency, build, test, and Playwright artifact ignores.

## Task 1: Project Scaffold

**Files:**

- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `playwright.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/test/setup.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "name": "a-capital-hunter",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@react-three/drei": "^10.0.0",
    "@react-three/fiber": "^9.0.0",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.171.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "^0.171.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>A Capital Hunter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "playwright.config.ts"]
}
```

Create `vite.config.ts`:

```ts
/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } }
    }
  ]
});
```

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Update `.gitignore` to contain:

```gitignore
.DS_Store
.superpowers/
node_modules/
dist/
coverage/
test-results/
playwright-report/
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 3: Verify empty project scripts fail for missing entry**

Run:

```bash
npm run build
```

Expected: FAIL because `src/main.tsx` does not exist yet.

- [ ] **Step 4: Commit scaffold**

Run:

```bash
git add .gitignore package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts playwright.config.ts src/vite-env.d.ts src/test/setup.ts
git commit -m "chore: scaffold frontend project"
```

Expected: commit succeeds.

## Task 2: Domain Types, Theme Registry, And Layout Provider

**Files:**

- Create: `src/domain/types.ts`
- Create: `src/domain/themeRegistry.ts`
- Create: `src/domain/layoutProvider.ts`
- Create: `src/domain/themeRegistry.test.ts`
- Create: `src/domain/layoutProvider.test.ts`

- [ ] **Step 1: Write failing registry and layout tests**

Create `src/domain/themeRegistry.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { sectors, themes } from "./themeRegistry";

describe("themeRegistry", () => {
  it("defines the three approved theme centers", () => {
    expect(themes.map((theme) => theme.id)).toEqual([
      "ai-computing",
      "robotics-physical-ai",
      "low-altitude-economy"
    ]);
  });

  it("defines five sectors for each theme including the center", () => {
    for (const theme of themes) {
      const themeSectors = sectors.filter((sector) => sector.primaryThemeId === theme.id);
      expect(themeSectors).toHaveLength(6);
      expect(themeSectors.filter((sector) => sector.isThemeCenter)).toHaveLength(1);
    }
  });

  it("keeps sector ids unique", () => {
    const ids = sectors.map((sector) => sector.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

Create `src/domain/layoutProvider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "./layoutProvider";
import { sectors } from "./themeRegistry";

describe("createManualLayoutProvider", () => {
  it("returns a layout cell for every sector", () => {
    const layout = createManualLayoutProvider().getLayout();
    expect(layout.cells).toHaveLength(sectors.length);
    expect(layout.cells.map((cell) => cell.sectorId).sort()).toEqual(
      sectors.map((sector) => sector.id).sort()
    );
  });

  it("places each theme center in the center of its local cluster", () => {
    const layout = createManualLayoutProvider().getLayout();
    const centers = layout.cells.filter((cell) => cell.role === "theme-center");
    expect(centers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectorId: "ai-computing", x: -5, z: 0 }),
        expect.objectContaining({ sectorId: "robotics-physical-ai", x: 0, z: 0 }),
        expect.objectContaining({ sectorId: "low-altitude-economy", x: 5, z: 0 })
      ])
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/themeRegistry.test.ts src/domain/layoutProvider.test.ts
```

Expected: FAIL with module-not-found errors for the new domain modules.

- [ ] **Step 3: Implement domain types and providers**

Create `src/domain/types.ts`:

```ts
export type ThemeId = "ai-computing" | "robotics-physical-ai" | "low-altitude-economy";

export type SectorId =
  | "ai-computing"
  | "optical-modules"
  | "cpo"
  | "liquid-cooled-servers"
  | "domestic-computing"
  | "data-centers"
  | "robotics-physical-ai"
  | "reducers"
  | "servo-systems"
  | "sensors"
  | "machine-vision"
  | "actuators"
  | "low-altitude-economy"
  | "evtol"
  | "flight-control-systems"
  | "drones"
  | "general-aviation-operations"
  | "air-traffic-systems";

export type CapitalDirection = "inflow" | "outflow" | "flat";
export type CapitalStateFilter = "all" | CapitalDirection;
export type ThemeFilter = "all" | ThemeId;
export type CameraPreset = "angled" | "top" | "side";

export interface Theme {
  id: ThemeId;
  name: string;
  shortName: string;
  color: string;
}

export interface Sector {
  id: SectorId;
  name: string;
  shortName: string;
  primaryThemeId: ThemeId;
  relatedThemeIds: ThemeId[];
  aliases: string[];
  isThemeCenter: boolean;
  relationshipNote: string;
}

export interface LayoutCell {
  sectorId: SectorId;
  x: number;
  z: number;
  role: "theme-center" | "related-sector";
  relationshipStrength: 1 | 2 | 3;
}

export interface SectorLayout {
  cells: LayoutCell[];
}

export interface LayoutProvider {
  getLayout(): SectorLayout;
}

export interface ScenarioPoint {
  sectorId: SectorId;
  netInflow: number;
}

export interface MarketScenario {
  id: string;
  label: string;
  story: string;
  points: ScenarioPoint[];
}

export interface DataProvider {
  getScenarios(): MarketScenario[];
}

export interface NormalizedMetric {
  rawValue: number;
  height: number;
  direction: CapitalDirection;
  color: string;
  intensity: number;
  labelValue: string;
}

export interface RenderNode {
  sector: Sector;
  theme: Theme;
  cell: LayoutCell;
  metric: NormalizedMetric;
  visible: boolean;
  dimmed: boolean;
}
```

Create `src/domain/themeRegistry.ts`:

```ts
import type { Sector, Theme } from "./types";

export const themes: Theme[] = [
  { id: "ai-computing", name: "AI算力", shortName: "AI算力", color: "#d94a45" },
  { id: "robotics-physical-ai", name: "机器人（物理AI）", shortName: "机器人", color: "#d89a38" },
  { id: "low-altitude-economy", name: "低空经济", shortName: "低空经济", color: "#3b82c4" }
];

export const sectors: Sector[] = [
  {
    id: "ai-computing",
    name: "AI算力",
    shortName: "AI算力",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["人工智能算力", "算力主线"],
    isThemeCenter: true,
    relationshipNote: "AI主线核心，承接大模型训练和推理需求。"
  },
  {
    id: "optical-modules",
    name: "光模块",
    shortName: "光模块",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["高速光模块"],
    isThemeCenter: false,
    relationshipNote: "AI数据中心高速互联的核心环节，常与算力主线共振。"
  },
  {
    id: "cpo",
    name: "CPO",
    shortName: "CPO",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["共封装光学"],
    isThemeCenter: false,
    relationshipNote: "光互联技术分支，靠近光模块和AI算力。"
  },
  {
    id: "liquid-cooled-servers",
    name: "液冷服务器",
    shortName: "液冷",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["服务器液冷"],
    isThemeCenter: false,
    relationshipNote: "高功耗算力基础设施的散热分支。"
  },
  {
    id: "domestic-computing",
    name: "国产算力",
    shortName: "国产算力",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["国产AI芯片", "信创算力"],
    isThemeCenter: false,
    relationshipNote: "国产替代与AI算力需求叠加。"
  },
  {
    id: "data-centers",
    name: "数据中心",
    shortName: "数据中心",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["IDC"],
    isThemeCenter: false,
    relationshipNote: "AI算力落地的基础设施载体。"
  },
  {
    id: "robotics-physical-ai",
    name: "机器人（物理AI）",
    shortName: "机器人",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai", "ai-computing"],
    aliases: ["物理AI", "人形机器人"],
    isThemeCenter: true,
    relationshipNote: "AI能力向物理世界延伸的核心主线。"
  },
  {
    id: "reducers",
    name: "减速器",
    shortName: "减速器",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai"],
    aliases: ["谐波减速器"],
    isThemeCenter: false,
    relationshipNote: "机器人运动控制核心零部件。"
  },
  {
    id: "servo-systems",
    name: "伺服系统",
    shortName: "伺服",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai"],
    aliases: ["伺服电机"],
    isThemeCenter: false,
    relationshipNote: "机器人执行控制的重要分支。"
  },
  {
    id: "sensors",
    name: "传感器",
    shortName: "传感器",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai", "low-altitude-economy"],
    aliases: ["感知硬件"],
    isThemeCenter: false,
    relationshipNote: "机器人和低空设备感知层的共用环节。"
  },
  {
    id: "machine-vision",
    name: "机器视觉",
    shortName: "机器视觉",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai", "ai-computing"],
    aliases: ["工业视觉"],
    isThemeCenter: false,
    relationshipNote: "AI识别能力和机器人感知能力的交叉分支。"
  },
  {
    id: "actuators",
    name: "执行器",
    shortName: "执行器",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai"],
    aliases: ["线性执行器"],
    isThemeCenter: false,
    relationshipNote: "机器人末端动作和关节控制的关键部件。"
  },
  {
    id: "low-altitude-economy",
    name: "低空经济",
    shortName: "低空经济",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["低空主线"],
    isThemeCenter: true,
    relationshipNote: "政策、航空器、运营和空域基础设施共同构成的主题中心。"
  },
  {
    id: "evtol",
    name: "eVTOL",
    shortName: "eVTOL",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["电动垂直起降"],
    isThemeCenter: false,
    relationshipNote: "低空经济最具辨识度的航空器分支。"
  },
  {
    id: "flight-control-systems",
    name: "飞控系统",
    shortName: "飞控",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy", "robotics-physical-ai"],
    aliases: ["飞行控制"],
    isThemeCenter: false,
    relationshipNote: "低空航空器控制核心，也与机器人控制逻辑相近。"
  },
  {
    id: "drones",
    name: "无人机",
    shortName: "无人机",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["工业无人机"],
    isThemeCenter: false,
    relationshipNote: "低空应用落地最成熟的载体。"
  },
  {
    id: "general-aviation-operations",
    name: "通航运营",
    shortName: "通航",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["低空运营"],
    isThemeCenter: false,
    relationshipNote: "低空商业化场景和运营网络。"
  },
  {
    id: "air-traffic-systems",
    name: "空管系统",
    shortName: "空管",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["低空空管"],
    isThemeCenter: false,
    relationshipNote: "低空飞行秩序和基础设施分支。"
  }
];
```

Create `src/domain/layoutProvider.ts`:

```ts
import type { LayoutProvider, SectorLayout } from "./types";

const manualLayout: SectorLayout = {
  cells: [
    { sectorId: "ai-computing", x: -5, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "optical-modules", x: -6, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "cpo", x: -4, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "liquid-cooled-servers", x: -6, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "domestic-computing", x: -4, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "data-centers", x: -5, z: 2, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "robotics-physical-ai", x: 0, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "reducers", x: -1, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "servo-systems", x: 1, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "sensors", x: -1, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "machine-vision", x: 1, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "actuators", x: 0, z: 2, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "low-altitude-economy", x: 5, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "evtol", x: 4, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "flight-control-systems", x: 6, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "drones", x: 4, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "general-aviation-operations", x: 6, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "air-traffic-systems", x: 5, z: 2, role: "related-sector", relationshipStrength: 2 }
  ]
};

export function createManualLayoutProvider(): LayoutProvider {
  return {
    getLayout: () => manualLayout
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/domain/themeRegistry.test.ts src/domain/layoutProvider.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit domain registry and layout**

Run:

```bash
git add src/domain/types.ts src/domain/themeRegistry.ts src/domain/layoutProvider.ts src/domain/themeRegistry.test.ts src/domain/layoutProvider.test.ts
git commit -m "feat: add sector registry and manual layout"
```

Expected: commit succeeds.

## Task 3: Mock Scenario Data, Normalization, And Render Nodes

**Files:**

- Create: `src/domain/scenarioDataProvider.ts`
- Create: `src/domain/metricNormalizer.ts`
- Create: `src/domain/renderNodes.ts`
- Create: `src/domain/scenarioDataProvider.test.ts`
- Create: `src/domain/metricNormalizer.test.ts`
- Create: `src/domain/renderNodes.test.ts`

- [ ] **Step 1: Write failing scenario and normalizer tests**

Create `src/domain/scenarioDataProvider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMockScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";

describe("createMockScenarioDataProvider", () => {
  it("returns four story-driven time slices", () => {
    const scenarios = createMockScenarioDataProvider().getScenarios();
    expect(scenarios.map((scenario) => scenario.id)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("provides one value for every sector in every time slice", () => {
    const sectorIds = sectors.map((sector) => sector.id).sort();
    for (const scenario of createMockScenarioDataProvider().getScenarios()) {
      expect(scenario.points.map((point) => point.sectorId).sort()).toEqual(sectorIds);
    }
  });
});
```

Create `src/domain/metricNormalizer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeCapitalValue } from "./metricNormalizer";

describe("normalizeCapitalValue", () => {
  it("maps positive values to upward red inflow columns", () => {
    expect(normalizeCapitalValue(120, 160)).toMatchObject({
      rawValue: 120,
      direction: "inflow",
      color: "#e64646",
      labelValue: "+120.0亿"
    });
    expect(normalizeCapitalValue(120, 160).height).toBeGreaterThan(0);
  });

  it("maps negative values to downward green outflow columns", () => {
    expect(normalizeCapitalValue(-80, 160)).toMatchObject({
      rawValue: -80,
      direction: "outflow",
      color: "#2fa66a",
      labelValue: "-80.0亿"
    });
    expect(normalizeCapitalValue(-80, 160).height).toBeLessThan(0);
  });

  it("maps near-zero values to flat neutral columns", () => {
    expect(normalizeCapitalValue(0.4, 160)).toMatchObject({
      direction: "flat",
      color: "#7b8794",
      labelValue: "+0.4亿"
    });
  });
});
```

Create `src/domain/renderNodes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "./layoutProvider";
import { buildRenderNodes } from "./renderNodes";
import { createMockScenarioDataProvider } from "./scenarioDataProvider";
import { sectors } from "./themeRegistry";

describe("buildRenderNodes", () => {
  it("joins sector metadata, layout, and scenario data", () => {
    const nodes = buildRenderNodes({
      layout: createManualLayoutProvider().getLayout(),
      scenario: createMockScenarioDataProvider().getScenarios()[0],
      themeFilter: "all",
      capitalStateFilter: "all",
      showCentersOnly: false
    });
    expect(nodes).toHaveLength(sectors.length);
    expect(nodes.every((node) => node.visible)).toBe(true);
    expect(nodes.find((node) => node.sector.id === "ai-computing")).toMatchObject({
      sector: expect.objectContaining({ name: "AI算力" }),
      metric: expect.objectContaining({ direction: "inflow" })
    });
  });

  it("filters by theme and dims non-matching sectors", () => {
    const nodes = buildRenderNodes({
      layout: createManualLayoutProvider().getLayout(),
      scenario: createMockScenarioDataProvider().getScenarios()[0],
      themeFilter: "ai-computing",
      capitalStateFilter: "all",
      showCentersOnly: false
    });
    expect(nodes.filter((node) => node.visible)).toHaveLength(6);
    expect(nodes.find((node) => node.sector.id === "robotics-physical-ai")?.dimmed).toBe(true);
  });

  it("can show only theme centers", () => {
    const nodes = buildRenderNodes({
      layout: createManualLayoutProvider().getLayout(),
      scenario: createMockScenarioDataProvider().getScenarios()[0],
      themeFilter: "all",
      capitalStateFilter: "all",
      showCentersOnly: true
    });
    expect(nodes.filter((node) => node.visible).map((node) => node.sector.id)).toEqual([
      "ai-computing",
      "robotics-physical-ai",
      "low-altitude-economy"
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/domain/scenarioDataProvider.test.ts src/domain/metricNormalizer.test.ts src/domain/renderNodes.test.ts
```

Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement mock scenarios, normalizer, and render-node builder**

Create `src/domain/scenarioDataProvider.ts`:

```ts
import type { DataProvider, MarketScenario, SectorId } from "./types";

const valuesByScenario: Array<{
  id: string;
  label: string;
  story: string;
  values: Record<SectorId, number>;
}> = [
  {
    id: "t1",
    label: "T1 AI算力主升",
    story: "AI算力领涨，光模块、CPO、液冷服务器共振。",
    values: {
      "ai-computing": 160,
      "optical-modules": 138,
      cpo: 126,
      "liquid-cooled-servers": 88,
      "domestic-computing": 74,
      "data-centers": 58,
      "robotics-physical-ai": 36,
      reducers: 18,
      "servo-systems": 16,
      sensors: 12,
      "machine-vision": 30,
      actuators: 8,
      "low-altitude-economy": -22,
      evtol: -16,
      "flight-control-systems": -12,
      drones: -20,
      "general-aviation-operations": -18,
      "air-traffic-systems": -10
    }
  },
  {
    id: "t2",
    label: "T2 机器人接力",
    story: "AI高位分歧，机器人（物理AI）开始成为新主峰。",
    values: {
      "ai-computing": 42,
      "optical-modules": -18,
      cpo: -26,
      "liquid-cooled-servers": 12,
      "domestic-computing": 24,
      "data-centers": 8,
      "robotics-physical-ai": 145,
      reducers: 118,
      "servo-systems": 104,
      sensors: 76,
      "machine-vision": 92,
      actuators: 64,
      "low-altitude-economy": 18,
      evtol: 22,
      "flight-control-systems": 26,
      drones: 10,
      "general-aviation-operations": 6,
      "air-traffic-systems": 4
    }
  },
  {
    id: "t3",
    label: "T3 机器人扩散",
    story: "机器人扩散到传感器和机器视觉，低空经济开始回流。",
    values: {
      "ai-computing": -34,
      "optical-modules": -46,
      cpo: -38,
      "liquid-cooled-servers": -12,
      "domestic-computing": 8,
      "data-centers": -18,
      "robotics-physical-ai": 98,
      reducers: 72,
      "servo-systems": 84,
      sensors: 112,
      "machine-vision": 126,
      actuators: 68,
      "low-altitude-economy": 70,
      evtol: 64,
      "flight-control-systems": 58,
      drones: 46,
      "general-aviation-operations": 34,
      "air-traffic-systems": 28
    }
  },
  {
    id: "t4",
    label: "T4 低空经济主升",
    story: "低空经济成为主峰，AI与机器人部分流出或震荡。",
    values: {
      "ai-computing": -58,
      "optical-modules": -62,
      cpo: -50,
      "liquid-cooled-servers": -24,
      "domestic-computing": -18,
      "data-centers": -30,
      "robotics-physical-ai": 16,
      reducers: -14,
      "servo-systems": 8,
      sensors: 22,
      "machine-vision": 18,
      actuators: -8,
      "low-altitude-economy": 152,
      evtol: 132,
      "flight-control-systems": 118,
      drones: 104,
      "general-aviation-operations": 82,
      "air-traffic-systems": 76
    }
  }
];

const scenarios: MarketScenario[] = valuesByScenario.map((scenario) => ({
  id: scenario.id,
  label: scenario.label,
  story: scenario.story,
  points: Object.entries(scenario.values).map(([sectorId, netInflow]) => ({
    sectorId: sectorId as SectorId,
    netInflow
  }))
}));

export function createMockScenarioDataProvider(): DataProvider {
  return {
    getScenarios: () => scenarios
  };
}
```

Create `src/domain/metricNormalizer.ts`:

```ts
import type { CapitalDirection, NormalizedMetric } from "./types";

const MAX_COLUMN_HEIGHT = 4.8;
const FLAT_THRESHOLD = 1;

export function normalizeCapitalValue(value: number, maxAbsValue: number): NormalizedMetric {
  const direction: CapitalDirection =
    Math.abs(value) < FLAT_THRESHOLD ? "flat" : value > 0 ? "inflow" : "outflow";
  const safeMax = maxAbsValue <= 0 ? 1 : maxAbsValue;
  const magnitude = Math.min(Math.abs(value) / safeMax, 1);
  const height = direction === "flat" ? 0.08 : magnitude * MAX_COLUMN_HEIGHT * Math.sign(value);

  return {
    rawValue: value,
    height,
    direction,
    color: direction === "inflow" ? "#e64646" : direction === "outflow" ? "#2fa66a" : "#7b8794",
    intensity: direction === "flat" ? 0.35 : 0.45 + magnitude * 0.55,
    labelValue: `${value >= 0 ? "+" : ""}${value.toFixed(1)}亿`
  };
}
```

Create `src/domain/renderNodes.ts`:

```ts
import { normalizeCapitalValue } from "./metricNormalizer";
import { sectors, themes } from "./themeRegistry";
import type {
  CapitalStateFilter,
  MarketScenario,
  RenderNode,
  SectorLayout,
  ThemeFilter
} from "./types";

interface BuildRenderNodesInput {
  layout: SectorLayout;
  scenario: MarketScenario;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  showCentersOnly: boolean;
}

export function buildRenderNodes(input: BuildRenderNodesInput): RenderNode[] {
  const maxAbsValue = Math.max(...input.scenario.points.map((point) => Math.abs(point.netInflow)), 1);

  return input.layout.cells.map((cell) => {
    const sector = sectors.find((candidate) => candidate.id === cell.sectorId);
    const point = input.scenario.points.find((candidate) => candidate.sectorId === cell.sectorId);

    if (!sector || !point) {
      throw new Error(`Missing sector or scenario point for ${cell.sectorId}`);
    }

    const theme = themes.find((candidate) => candidate.id === sector.primaryThemeId);
    if (!theme) {
      throw new Error(`Missing theme for ${sector.primaryThemeId}`);
    }

    const metric = normalizeCapitalValue(point.netInflow, maxAbsValue);
    const matchesTheme = input.themeFilter === "all" || sector.relatedThemeIds.includes(input.themeFilter);
    const matchesState =
      input.capitalStateFilter === "all" || metric.direction === input.capitalStateFilter;
    const matchesCenterMode = !input.showCentersOnly || sector.isThemeCenter;
    const visible = matchesTheme && matchesState && matchesCenterMode;

    return {
      sector,
      theme,
      cell,
      metric,
      visible,
      dimmed: !visible
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/domain/scenarioDataProvider.test.ts src/domain/metricNormalizer.test.ts src/domain/renderNodes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit data and normalization layer**

Run:

```bash
git add src/domain/scenarioDataProvider.ts src/domain/metricNormalizer.ts src/domain/renderNodes.ts src/domain/scenarioDataProvider.test.ts src/domain/metricNormalizer.test.ts src/domain/renderNodes.test.ts
git commit -m "feat: add mock scenarios and render node adapter"
```

Expected: commit succeeds.

## Task 4: Interaction State And Control Panel

**Files:**

- Create: `src/state/useHunterState.ts`
- Create: `src/state/useHunterState.test.tsx`
- Create: `src/components/ControlsPanel.tsx`
- Create: `src/components/ControlsPanel.test.tsx`

- [ ] **Step 1: Write failing state and control tests**

Create `src/state/useHunterState.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHunterState } from "./useHunterState";

describe("useHunterState", () => {
  it("starts with all filters enabled and the first time slice", () => {
    const { result } = renderHook(() => useHunterState(["t1", "t2"]));
    expect(result.current.activeScenarioId).toBe("t1");
    expect(result.current.themeFilter).toBe("all");
    expect(result.current.capitalStateFilter).toBe("all");
    expect(result.current.cameraPreset).toBe("angled");
  });

  it("updates filters and clears selection when scenario changes", () => {
    const { result } = renderHook(() => useHunterState(["t1", "t2"]));
    act(() => result.current.setSelectedSectorId("ai-computing"));
    act(() => result.current.setActiveScenarioId("t2"));
    expect(result.current.activeScenarioId).toBe("t2");
    expect(result.current.selectedSectorId).toBeUndefined();
  });
});
```

Create `src/components/ControlsPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createMockScenarioDataProvider } from "../domain/scenarioDataProvider";
import { themes } from "../domain/themeRegistry";
import { ControlsPanel } from "./ControlsPanel";

describe("ControlsPanel", () => {
  it("calls change handlers for timeline and filters", async () => {
    const user = userEvent.setup();
    const scenarios = createMockScenarioDataProvider().getScenarios();
    const onScenarioChange = vi.fn();
    const onThemeFilterChange = vi.fn();

    render(
      <ControlsPanel
        scenarios={scenarios}
        themes={themes}
        activeScenarioId="t1"
        themeFilter="all"
        capitalStateFilter="all"
        cameraPreset="angled"
        showCentersOnly={false}
        onScenarioChange={onScenarioChange}
        onThemeFilterChange={onThemeFilterChange}
        onCapitalStateFilterChange={vi.fn()}
        onCameraPresetChange={vi.fn()}
        onShowCentersOnlyChange={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "T2 机器人接力" }));
    await user.selectOptions(screen.getByLabelText("主题筛选"), "ai-computing");

    expect(onScenarioChange).toHaveBeenCalledWith("t2");
    expect(onThemeFilterChange).toHaveBeenCalledWith("ai-computing");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/state/useHunterState.test.tsx src/components/ControlsPanel.test.tsx
```

Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement state hook and controls**

Create `src/state/useHunterState.ts`:

```ts
import { useState } from "react";
import type { CameraPreset, CapitalStateFilter, SectorId, ThemeFilter } from "../domain/types";

export function useHunterState(scenarioIds: string[]) {
  const [activeScenarioId, setActiveScenarioIdState] = useState(scenarioIds[0]);
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>("all");
  const [capitalStateFilter, setCapitalStateFilter] = useState<CapitalStateFilter>("all");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("angled");
  const [showCentersOnly, setShowCentersOnly] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId | undefined>();

  function setActiveScenarioId(nextScenarioId: string) {
    setActiveScenarioIdState(nextScenarioId);
    setSelectedSectorId(undefined);
  }

  return {
    activeScenarioId,
    setActiveScenarioId,
    themeFilter,
    setThemeFilter,
    capitalStateFilter,
    setCapitalStateFilter,
    cameraPreset,
    setCameraPreset,
    showCentersOnly,
    setShowCentersOnly,
    selectedSectorId,
    setSelectedSectorId
  };
}
```

Create `src/components/ControlsPanel.tsx`:

```tsx
import { Activity, Eye, Filter, Layers3, Rotate3D } from "lucide-react";
import type {
  CameraPreset,
  CapitalStateFilter,
  MarketScenario,
  Theme,
  ThemeFilter
} from "../domain/types";

interface ControlsPanelProps {
  scenarios: MarketScenario[];
  themes: Theme[];
  activeScenarioId: string;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  cameraPreset: CameraPreset;
  showCentersOnly: boolean;
  onScenarioChange: (scenarioId: string) => void;
  onThemeFilterChange: (themeFilter: ThemeFilter) => void;
  onCapitalStateFilterChange: (filter: CapitalStateFilter) => void;
  onCameraPresetChange: (preset: CameraPreset) => void;
  onShowCentersOnlyChange: (show: boolean) => void;
}

export function ControlsPanel(props: ControlsPanelProps) {
  return (
    <aside className="controls-panel" aria-label="A Capital Hunter 控制面板">
      <section className="control-section">
        <div className="section-title">
          <Activity size={16} aria-hidden="true" />
          <span>资金轮动时间片</span>
        </div>
        <div className="timeline-buttons" role="group" aria-label="时间片">
          {props.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              className={scenario.id === props.activeScenarioId ? "active" : ""}
              type="button"
              onClick={() => props.onScenarioChange(scenario.id)}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section">
        <div className="section-title">
          <Filter size={16} aria-hidden="true" />
          <span>筛选</span>
        </div>
        <label>
          <span>主题筛选</span>
          <select
            aria-label="主题筛选"
            value={props.themeFilter}
            onChange={(event) => props.onThemeFilterChange(event.target.value as ThemeFilter)}
          >
            <option value="all">全部主线</option>
            {props.themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>资金状态</span>
          <select
            aria-label="资金状态"
            value={props.capitalStateFilter}
            onChange={(event) =>
              props.onCapitalStateFilterChange(event.target.value as CapitalStateFilter)
            }
          >
            <option value="all">全部状态</option>
            <option value="inflow">只看流入</option>
            <option value="outflow">只看流出</option>
            <option value="flat">只看平盘</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={props.showCentersOnly}
            onChange={(event) => props.onShowCentersOnlyChange(event.target.checked)}
          />
          <span>只看主线中心</span>
        </label>
      </section>

      <section className="control-section">
        <div className="section-title">
          <Rotate3D size={16} aria-hidden="true" />
          <span>视角</span>
        </div>
        <div className="segmented" role="group" aria-label="视角预设">
          {[
            ["angled", "斜视"],
            ["top", "俯视"],
            ["side", "侧视"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={props.cameraPreset === value ? "active" : ""}
              onClick={() => props.onCameraPresetChange(value as CameraPreset)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section compact-note">
        <div className="section-title">
          <Layers3 size={16} aria-hidden="true" />
          <span>读图规则</span>
        </div>
        <p>二维位置表达关系，柱高表达资金强度，红色为流入，绿色为流出。</p>
        <div className="section-title">
          <Eye size={16} aria-hidden="true" />
          <span>第一版策略</span>
        </div>
        <p>使用模拟时间片和手工布局，接口保留给真实数据源和算法布局。</p>
      </section>
    </aside>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- src/state/useHunterState.test.tsx src/components/ControlsPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit state and controls**

Run:

```bash
git add src/state/useHunterState.ts src/state/useHunterState.test.tsx src/components/ControlsPanel.tsx src/components/ControlsPanel.test.tsx
git commit -m "feat: add hunter state and controls"
```

Expected: commit succeeds.

## Task 5: 3D Scene Components

**Files:**

- Create: `src/components/HunterScene.tsx`
- Create: `src/components/CapitalMapScene.tsx`
- Create: `src/components/SceneLegend.tsx`
- Create: `src/components/InspectorPanel.tsx`
- Create: `src/components/InspectorPanel.test.tsx`

- [ ] **Step 1: Write failing inspector test**

Create `src/components/InspectorPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createManualLayoutProvider } from "../domain/layoutProvider";
import { buildRenderNodes } from "../domain/renderNodes";
import { createMockScenarioDataProvider } from "../domain/scenarioDataProvider";
import { InspectorPanel } from "./InspectorPanel";

const nodes = buildRenderNodes({
  layout: createManualLayoutProvider().getLayout(),
  scenario: createMockScenarioDataProvider().getScenarios()[0],
  themeFilter: "all",
  capitalStateFilter: "all",
  showCentersOnly: false
});

describe("InspectorPanel", () => {
  it("renders selected sector details", () => {
    render(<InspectorPanel node={nodes.find((node) => node.sector.id === "ai-computing")} />);
    expect(screen.getByText("AI算力")).toBeInTheDocument();
    expect(screen.getByText("+160.0亿")).toBeInTheDocument();
    expect(screen.getByText("AI主线核心，承接大模型训练和推理需求。")).toBeInTheDocument();
  });

  it("renders an empty state without a selection", () => {
    render(<InspectorPanel node={undefined} />);
    expect(screen.getByText("点击板块查看资金状态")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/InspectorPanel.test.tsx
```

Expected: FAIL with module-not-found error for `InspectorPanel`.

- [ ] **Step 3: Implement inspector, legend, and 3D scene components**

Create `src/components/InspectorPanel.tsx`:

```tsx
import type { RenderNode } from "../domain/types";

interface InspectorPanelProps {
  node?: RenderNode;
}

export function InspectorPanel({ node }: InspectorPanelProps) {
  if (!node) {
    return (
      <section className="inspector-panel" aria-label="板块详情">
        <h2>点击板块查看资金状态</h2>
        <p>第一版展示板块名、主线、资金方向和模拟净流入值。</p>
      </section>
    );
  }

  return (
    <section className="inspector-panel" aria-label="板块详情">
      <div className="inspector-kicker">{node.theme.name}</div>
      <h2>{node.sector.name}</h2>
      <div className="metric-row">
        <span>模拟净流入</span>
        <strong style={{ color: node.metric.color }}>{node.metric.labelValue}</strong>
      </div>
      <div className="metric-row">
        <span>状态</span>
        <strong>{node.metric.direction === "inflow" ? "流入" : node.metric.direction === "outflow" ? "流出" : "平盘"}</strong>
      </div>
      <p>{node.sector.relationshipNote}</p>
    </section>
  );
}
```

Create `src/components/SceneLegend.tsx`:

```tsx
export function SceneLegend() {
  return (
    <div className="scene-legend" aria-label="图例">
      <span><i className="legend-dot inflow" />资金流入</span>
      <span><i className="legend-dot outflow" />资金流出</span>
      <span><i className="legend-dot flat" />弱/平</span>
    </div>
  );
}
```

Create `src/components/HunterScene.tsx`:

```tsx
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { CameraPreset, RenderNode, SectorId } from "../domain/types";
import { CapitalMapScene } from "./CapitalMapScene";

interface HunterSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
}

export function HunterScene(props: HunterSceneProps) {
  return (
    <Canvas
      className="hunter-canvas"
      camera={{ position: [7, 8, 9], fov: 42 }}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#10151b"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 12, 8]} intensity={1.2} castShadow />
      <CapitalMapScene
        nodes={props.nodes}
        cameraPreset={props.cameraPreset}
        selectedSectorId={props.selectedSectorId}
        onSelectSector={props.onSelectSector}
      />
      <OrbitControls enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.15} />
    </Canvas>
  );
}
```

Create `src/components/CapitalMapScene.tsx`:

```tsx
import { Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { CameraPreset, RenderNode, SectorId } from "../domain/types";

const CELL_SIZE = 0.86;
const COLUMN_SIZE = 0.42;

interface CapitalMapSceneProps {
  nodes: RenderNode[];
  cameraPreset: CameraPreset;
  selectedSectorId?: SectorId;
  onSelectSector: (sectorId: SectorId) => void;
}

const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  angled: [7, 8, 9],
  top: [0, 13, 0.1],
  side: [10, 4, 0]
};

export function CapitalMapScene(props: CapitalMapSceneProps) {
  const { camera } = useThree();

  useEffect(() => {
    const [x, y, z] = cameraPositions[props.cameraPreset];
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, props.cameraPreset]);

  return (
    <group>
      <gridHelper args={[14, 14, "#2d3640", "#1d2630"]} position={[0, -0.02, 0]} />
      {props.nodes.map((node) => (
        <group key={node.sector.id} position={[node.cell.x, 0, node.cell.z]}>
          <mesh
            receiveShadow
            onClick={(event) => {
              event.stopPropagation();
              props.onSelectSector(node.sector.id);
            }}
          >
            <boxGeometry args={[CELL_SIZE, 0.06, CELL_SIZE]} />
            <meshStandardMaterial
              color={node.sector.isThemeCenter ? node.theme.color : "#26313d"}
              opacity={node.visible ? 0.95 : 0.18}
              transparent
              roughness={0.72}
            />
          </mesh>
          <mesh
            castShadow
            position={[
              0,
              node.metric.height === 0 ? 0.08 : node.metric.height / 2,
              0
            ]}
            visible={node.visible}
          >
            <boxGeometry args={[COLUMN_SIZE, Math.max(Math.abs(node.metric.height), 0.08), COLUMN_SIZE]} />
            <meshStandardMaterial
              color={node.metric.color}
              opacity={node.metric.intensity}
              transparent
              emissive={node.metric.color}
              emissiveIntensity={props.selectedSectorId === node.sector.id ? 0.22 : 0.04}
            />
          </mesh>
          <Text
            position={[0, 0.08, 0.52]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.18}
            color={node.visible ? "#e8eef5" : "#64717f"}
            anchorX="center"
            anchorY="middle"
            maxWidth={1.2}
          >
            {node.sector.shortName}
          </Text>
        </group>
      ))}
    </group>
  );
}
```

- [ ] **Step 4: Run inspector test**

Run:

```bash
npm test -- src/components/InspectorPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit 3D scene components**

Run:

```bash
git add src/components/HunterScene.tsx src/components/CapitalMapScene.tsx src/components/SceneLegend.tsx src/components/InspectorPanel.tsx src/components/InspectorPanel.test.tsx
git commit -m "feat: add 3d capital map scene"
```

Expected: commit succeeds.

## Task 6: App Composition And Styling

**Files:**

- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/App.test.tsx`

- [ ] **Step 1: Write failing app integration test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/HunterScene", () => ({
  HunterScene: () => <div data-testid="mock-hunter-scene" />
}));

describe("App", () => {
  it("renders the product shell and scenario story", () => {
    render(<App />);
    expect(screen.getByText("A Capital Hunter")).toBeInTheDocument();
    expect(screen.getByText("AI算力领涨，光模块、CPO、液冷服务器共振。")).toBeInTheDocument();
    expect(screen.getByLabelText("A Capital Hunter 3D资金峰面")).toBeInTheDocument();
  });

  it("switches the active time slice story", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "T4 低空经济主升" }));
    expect(screen.getByText("低空经济成为主峰，AI与机器人部分流出或震荡。")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `src/App.tsx` and `src/main.tsx` do not exist.

- [ ] **Step 3: Implement app shell**

Create `src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create `src/App.tsx`:

```tsx
import { useMemo } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { HunterScene } from "./components/HunterScene";
import { InspectorPanel } from "./components/InspectorPanel";
import { SceneLegend } from "./components/SceneLegend";
import { createManualLayoutProvider } from "./domain/layoutProvider";
import { buildRenderNodes } from "./domain/renderNodes";
import { createMockScenarioDataProvider } from "./domain/scenarioDataProvider";
import { themes } from "./domain/themeRegistry";
import { useHunterState } from "./state/useHunterState";

const layoutProvider = createManualLayoutProvider();
const dataProvider = createMockScenarioDataProvider();
const scenarios = dataProvider.getScenarios();

export default function App() {
  const hunterState = useHunterState(scenarios.map((scenario) => scenario.id));
  const activeScenario =
    scenarios.find((scenario) => scenario.id === hunterState.activeScenarioId) || scenarios[0];

  const nodes = useMemo(
    () =>
      buildRenderNodes({
        layout: layoutProvider.getLayout(),
        scenario: activeScenario,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
        showCentersOnly: hunterState.showCentersOnly
      }),
    [
      activeScenario,
      hunterState.capitalStateFilter,
      hunterState.showCentersOnly,
      hunterState.themeFilter
    ]
  );

  const selectedNode = nodes.find((node) => node.sector.id === hunterState.selectedSectorId);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">A股主力资金动向捕捉神器</p>
          <h1>A Capital Hunter</h1>
        </div>
        <div className="scenario-story" aria-live="polite">
          <span>{activeScenario.label}</span>
          <p>{activeScenario.story}</p>
        </div>
      </header>

      <section className="workspace">
        <ControlsPanel
          scenarios={scenarios}
          themes={themes}
          activeScenarioId={hunterState.activeScenarioId}
          themeFilter={hunterState.themeFilter}
          capitalStateFilter={hunterState.capitalStateFilter}
          cameraPreset={hunterState.cameraPreset}
          showCentersOnly={hunterState.showCentersOnly}
          onScenarioChange={hunterState.setActiveScenarioId}
          onThemeFilterChange={hunterState.setThemeFilter}
          onCapitalStateFilterChange={hunterState.setCapitalStateFilter}
          onCameraPresetChange={hunterState.setCameraPreset}
          onShowCentersOnlyChange={hunterState.setShowCentersOnly}
        />

        <section className="scene-panel" aria-label="A Capital Hunter 3D资金峰面">
          <div className="scene-toolbar">
            <span>二维位置 = 关系</span>
            <span>柱高 = 强度</span>
            <span>时间片 = 轮动</span>
          </div>
          <HunterScene
            nodes={nodes}
            cameraPreset={hunterState.cameraPreset}
            selectedSectorId={hunterState.selectedSectorId}
            onSelectSector={hunterState.setSelectedSectorId}
          />
          <SceneLegend />
        </section>

        <InspectorPanel node={selectedNode} />
      </section>
    </main>
  );
}
```

Create `src/App.css`:

```css
:root {
  color: #e8eef5;
  background: #0f1419;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1180px;
  min-height: 100vh;
  background: #0f1419;
}

button,
select,
input {
  font: inherit;
}

button {
  border: 1px solid #344352;
  background: #1b2530;
  color: #dce6ef;
  cursor: pointer;
}

button:hover {
  border-color: #6b7f92;
}

button.active {
  border-color: #d94a45;
  background: #362023;
  color: #ffffff;
}

.app-shell {
  min-height: 100vh;
  padding: 20px;
  background:
    linear-gradient(180deg, rgba(28, 36, 44, 0.9), rgba(15, 20, 25, 1) 36%),
    #0f1419;
}

.top-bar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  height: 92px;
  padding: 0 2px 18px;
}

.eyebrow {
  margin: 0 0 4px;
  color: #94a3b8;
  font-size: 13px;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: 34px;
  line-height: 1.05;
  letter-spacing: 0;
}

.scenario-story {
  max-width: 520px;
  color: #cbd5df;
  text-align: right;
}

.scenario-story span {
  display: block;
  margin-bottom: 6px;
  color: #ffffff;
  font-weight: 700;
}

.scenario-story p {
  margin-bottom: 0;
  font-size: 14px;
  line-height: 1.5;
}

.workspace {
  display: grid;
  grid-template-columns: 280px minmax(640px, 1fr) 280px;
  gap: 16px;
  height: calc(100vh - 132px);
  min-height: 680px;
}

.controls-panel,
.inspector-panel {
  overflow: auto;
  border: 1px solid #26313d;
  border-radius: 8px;
  background: #141b22;
  padding: 16px;
}

.control-section + .control-section {
  margin-top: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #f2f5f8;
  font-size: 14px;
  font-weight: 700;
}

.timeline-buttons,
.segmented {
  display: grid;
  gap: 8px;
}

.timeline-buttons button,
.segmented button {
  min-height: 38px;
  border-radius: 6px;
  padding: 8px 10px;
  text-align: left;
}

.segmented {
  grid-template-columns: repeat(3, 1fr);
}

.segmented button {
  text-align: center;
}

label {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  color: #aab7c4;
  font-size: 13px;
}

select {
  width: 100%;
  border: 1px solid #344352;
  border-radius: 6px;
  background: #101820;
  color: #e8eef5;
  padding: 8px 10px;
}

.checkbox-row {
  grid-template-columns: auto 1fr;
  align-items: center;
}

.compact-note p {
  color: #9eacba;
  font-size: 13px;
  line-height: 1.55;
}

.scene-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid #26313d;
  border-radius: 8px;
  background: #10151b;
}

.scene-toolbar {
  position: absolute;
  z-index: 2;
  top: 14px;
  left: 14px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scene-toolbar span,
.scene-legend span {
  border: 1px solid #2f3b46;
  border-radius: 999px;
  background: rgba(16, 21, 27, 0.78);
  color: #d9e2eb;
  padding: 6px 10px;
  font-size: 12px;
}

.hunter-canvas {
  width: 100%;
  height: 100%;
}

.scene-legend {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  gap: 8px;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}

.legend-dot.inflow {
  background: #e64646;
}

.legend-dot.outflow {
  background: #2fa66a;
}

.legend-dot.flat {
  background: #7b8794;
}

.inspector-panel h2 {
  margin-bottom: 12px;
  font-size: 20px;
  letter-spacing: 0;
}

.inspector-kicker {
  margin-bottom: 8px;
  color: #94a3b8;
  font-size: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #26313d;
  padding: 10px 0;
  color: #b7c3cf;
}

.metric-row strong {
  color: #ffffff;
}

.inspector-panel p {
  color: #aab7c4;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 1250px) {
  body {
    min-width: 1024px;
  }

  .workspace {
    grid-template-columns: 250px minmax(520px, 1fr) 250px;
  }
}
```

- [ ] **Step 4: Run app test**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full unit test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit app composition**

Run:

```bash
git add src/main.tsx src/App.tsx src/App.css src/App.test.tsx
git commit -m "feat: compose capital hunter app shell"
```

Expected: commit succeeds.

## Task 7: Build, Browser Smoke Test, And Final Verification

**Files:**

- Create: `tests/e2e/a-capital-hunter.spec.ts`

- [ ] **Step 1: Write Playwright smoke test**

Create `tests/e2e/a-capital-hunter.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders the desktop 3D capital hunter prototype", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A Capital Hunter" })).toBeVisible();
  await expect(page.getByLabel("A Capital Hunter 3D资金峰面")).toBeVisible();
  await expect(page.getByText("二维位置 = 关系")).toBeVisible();

  await page.getByRole("button", { name: "T4 低空经济主升" }).click();
  await expect(page.getByText("低空经济成为主峰，AI与机器人部分流出或震荡。")).toBeVisible();

  await page.getByLabel("主题筛选").selectOption("low-altitude-economy");
  await expect(page.getByText("只看主线中心")).toBeVisible();
});
```

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `dist/` is created.

- [ ] **Step 3: Run Playwright smoke test**

Run:

```bash
npm run e2e
```

Expected: PASS in Chromium.

- [ ] **Step 4: Start local dev server for manual review**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 5: Verify browser behavior manually**

Open the local URL and verify:

- Three theme clusters are visible.
- Columns render above and below the base map.
- Time-slice buttons change the story and column heights.
- Theme filter changes visible emphasis.
- Capital-state filter changes visible emphasis.
- Camera preset buttons reposition the scene.
- The scene is not blank on a 1440px desktop viewport.
- The scene remains usable around 1280px width.

- [ ] **Step 6: Commit e2e test and final verification artifacts**

Run:

```bash
git add tests/e2e/a-capital-hunter.spec.ts
git commit -m "test: add prototype smoke coverage"
```

Expected: commit succeeds.

## Final Completion Checklist

Run these commands before claiming implementation is complete:

```bash
npm test
npm run build
npm run e2e
git status --short
```

Expected:

- Unit tests pass.
- Production build passes.
- Playwright smoke test passes.
- `git status --short` shows no uncommitted implementation changes.

## Spec Coverage Map

- Desktop large-screen web experience: Task 6 CSS layout and Task 7 manual viewport checks.
- Relationship-aware sector period table: Task 2 registry and layout provider.
- Three major theme centers: Task 2 registry tests.
- Four to five related sectors around each center: Task 2 registry and layout tests.
- Discrete 3D capital columns: Task 5 scene components.
- Manual time-slice switching: Task 3 scenario data and Task 4 controls.
- Camera controls and preset views: Task 4 controls and Task 5 camera behavior.
- State filters: Task 3 render nodes and Task 4 controls.
- Minimal inspection: Task 5 inspector.
- Extensible provider interfaces: Task 2 and Task 3 domain interfaces.
- Stable demonstration verification: Task 7 build and browser smoke test.
