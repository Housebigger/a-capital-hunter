# A Capital Hunter Third-Generation Design Spec

Date: 2026-06-10

## Product Intent

The third generation of A Capital Hunter expands the sector universe and deepens theme interconnections. The Gen2 algorithmic layout engine proved that a relationship-driven base map works. Gen3 makes the map substantially larger and denser while keeping it legible and explainable.

Gen3 validates two upgrades:

- Grow from 42 sectors across 7 themes to ~90 sectors across 11 themes, introducing a SubTheme intermediate layer for structural clarity.
- Strengthen cross-theme relationships by adding two new relationship types (policy-linkage, capital-flow) and ensuring every theme pair has at least one connecting edge.

## Chosen Direction

**Structured expansion (方案 B):** extend data, add a SubTheme layer, and make targeted engine optimizations. Avoid a full engine rewrite or excessive architectural change.

The approach adds structural depth (SubTheme) rather than just volume. This keeps the 3D scene legible as sector count doubles.

## Scope

Gen3 includes:

- An expanded theme universe of 11 themes with ~30 sub-themes and ~90 sectors.
- A SubTheme intermediate layer between Theme and Sector with its own type, registry, and layout anchoring.
- Two new relationship types: policy-linkage and capital-flow, alongside the existing three.
- ~150–180 total relationship edges, with every theme pair having at least one edge.
- 5 market stages (3 retained + 2 new) covering the expanded theme set.
- Layout engine optimizations: larger grid (22×16), SubTheme anchor points, dual-layer relationship pull, and expanded relationship-type support.
- 3D scene adaptations: country-map continuous terrain base, two-tier label density control.
- UI panel updates: expanded theme filter (11 options), stage selector (5 options), SubTheme info in inspector, 5 relationship-type labels.

Gen3 does not include:

- Full A-share market coverage.
- Real-time quote or fund-flow refresh.
- Force-directed layout algorithm replacement.
- Multi-level collapsible rendering or LOD virtualization.
- User-authored custom sector or relationship editing.
- Public-data adapter implementation.

## Theme And Sector Universe

### Existing Themes (7, retained from Gen2)

Each theme expands its sector roster by 1–3 sectors.

| Theme | Sub-themes | Sectors |
| --- | --- | --- |
| AI算力 | 算力基础设施, 国产替代, AI应用 | AI算力(center), 光模块, CPO, 液冷服务器, 数据中心, 国产算力, AI芯片设计, AIGC, AI Agent |
| 机器人/物理AI | 核心零部件, 感知层, 应用场景 | 机器人(center), 减速器, 伺服系统, 执行器, 传感器, 机器视觉, 工业机器人, 人形机器人 |
| 低空经济 | 航空器与控制, 运营与基础设施 | 低空经济(center), eVTOL, 飞控系统, 无人机, 通航运营, 空管系统, 低空通信 |
| 半导体 | 设计与制造, 设备与材料, 先进封装 | 半导体(center), 芯片设计, 晶圆制造, 半导体设备, 光刻胶, 先进封装, Chiplet, HBM |
| 新能源 | 发电, 储能与电池, 补能设施 | 新能源(center), 光伏, 风电, 储能, 动力电池, 固态电池, 充电桩 |
| 军工/商业航天 | 航天发射与通信, 导航与电子, 材料与装备 | 军工航天(center), 商业航天, 卫星互联网, 导航系统, 军工电子, 航天材料, 军工信息化 |
| 创新药/医药 | 药物研发, 器械与生物, 传统医药 | 医药主线(center), 创新药, CRO/CDMO, 医疗器械, 合成生物, 中药 |

### New Themes (4)

| Theme | Color | Sub-themes | Sectors |
| --- | --- | --- | --- |
| 新能源汽车/智能驾驶 | #4ecdc4 | 整车与三电, 智能驾驶, 车联网 | 新能源汽车(center), 整车制造, 电驱系统, 自动驾驶, 激光雷达, 车载芯片, 智能座舱, 车路协同 |
| 消费电子/VR | #ff8c42 | 终端设备, 核心零部件 | 消费电子(center), 智能手机, VR/AR设备, 显示面板, 声学器件, 光学镜头, 可穿戴设备 |
| 数字经济/数据要素 | #6c5ce7 | 数据要素, 云计算与软件, 信创 | 数字经济(center), 数据要素, 数据安全, 云计算, SaaS/企业软件, 信创, 操作系统/数据库, 网络安全 |
| 金融科技 | #3d9970 | 金融基础设施, 金融应用 | 金融科技(center), 券商IT, 支付系统, 数字货币, 金融AI, 保险科技 |

### SubTheme Type

```typescript
interface SubTheme {
  readonly id: string;          // e.g. "ai-computing-infra"
  readonly name: string;        // e.g. "算力基础设施"
  readonly shortName: string;   // e.g. "算力基建"
  readonly themeId: ThemeId;    // parent theme
  readonly displayOrder: number; // order within theme
  readonly primarySectorId: SectorId; // SubTheme center for label display
}
```

Sector type gains a new field:

```typescript
interface Sector {
  // ... existing fields ...
  readonly subThemeId: string;  // SubTheme membership
}
```

### Target Counts

- Themes: 11
- Sub-themes: ~30
- Sectors: ~90 (target range 80–100)
- Theme centers: 11 (one per theme, `isThemeCenter: true`)

## Relationship Model

### Relationship Types

The type union expands:

```typescript
type RelationshipType =
  | "industrial-chain"    // upstream/downstream, technical dependency
  | "market-comovement"  // historical resonance, shared narrative
  | "heat-correction"    // stage-based heat adjustment
  | "policy-linkage"     // shared policy driver or regulation
  | "capital-flow";      // main-force capital flow across sectors
```

### New Type Semantics

**policy-linkage:** Two sectors driven by the same policy document or industrial plan. Weight range: 0.3–0.6. This is a supplementary relationship; it does not override the industrial-chain skeleton.

Typical scenarios:
- 低空经济 ↔ 新能源汽车 (新能源产业政策)
- 数据要素 ↔ 金融科技 (数字经济政策)
- 储能 ↔ 光伏 (双碳目标驱动)
- 信创 ↔ 国产算力 (自主可控政策)

**capital-flow:** Main-force capital has observable flow or rotation between two sectors. Weight range: 0.3–0.65. Captures funding behavior that is not explained by industrial-chain proximity.

Typical scenarios:
- AI算力 ↔ 消费电子 (AI终端叙事切换)
- 半导体 ↔ 军工电子 (硬科技资金轮动)
- 新能源汽车 ↔ 智能驾驶 (主题内资金溢出)
- 创新药 ↔ 金融科技 (防御-进攻风格切换)

### Edge Density Target

- Total edges: ~150–180
- Intra-theme edges: ~100 (primarily industrial-chain)
- Cross-theme edges: ~60–80 (ensuring every theme pair has at least one edge)
- Gen2 had ~18 cross-theme edges; Gen3 targets 3–4× that.

### Design Principle

Industrial-chain relationships form the stable layout skeleton. Market-comovement, policy-linkage, capital-flow, and heat-correction relationships provide supplementary pull forces. This preserves user spatial memory while enriching the cross-theme structure.

## Market Stages

Gen3 expands from 3 to 5 layout stages:

| Stage | Label | High Themes | Warm Themes | Story |
| --- | --- | --- | --- | --- |
| 1 | AI/半导体共振 | AI算力, 半导体 | 数字经济, 消费电子 | AI算力与半导体供应链共振，数字经济和消费电子受益。 |
| 2 | 机器人/低空扩散 | 机器人, 低空经济 | AI算力, 军工航天 | 机器人与低空经济扩散，感知、控制、航空器升温。 |
| 3 | 新能源/军工轮动 | 新能源, 军工航天 | 创新药, 新能源汽车 | 新能源与军工航天获资金关注，前期科技主线整理。 |
| 4 | 消费电子/数字经济增长 | 消费电子, 数字经济 | 金融科技, AI算力 | 消费电子和数字经济题材走强，VR/AR和数据要素活跃。 |
| 5 | 新能源汽车/智能驾驶爆发 | 新能源汽车, 半导体 | 新能源, 消费电子, 数字经济 | 新能源汽车和智能驾驶主题爆发，半导体芯片需求升温，产业链全面活跃。 |

Stages form a linked list via `previousStageId`. Stages 1–3 are retained from Gen2 with updated heat values for new themes; stages 4–5 are new.

## Layout Engine Optimization

### Grid

- Gen2: 15×11 (165 cells, 42 sectors, 25% density)
- Gen3: 22×16 (352 cells, ~90 sectors, ~26% density)

### Algorithm (Five Steps)

1. **Theme anchors:** 11 anchors arranged radially. Base radius increases from 5.2 to 6.8. Heat-based inward shift logic unchanged.

2. **SubTheme anchors (new):** Each theme's sub-themes are positioned in a fan pattern around the theme anchor. The fan angle is 360°/N_sub. SubTheme anchors sit at 1.5 grid units from the theme center.

3. **Sector placement:** Sectors are placed relative to their SubTheme anchor, distributed compactly within the sub-theme's fan sector. Relationship pull is now dual-layer: intra-SubTheme pull first, then cross-SubTheme/cross-Theme pull. All 5 relationship types participate in pull calculation.

4. **Grid snapping:** Continuous coordinates snap to the 22×16 integer grid. Priority order: theme center → SubTheme center → ordinary sector. Collision detection logic unchanged.

5. **Layout explanations:** Each sector receives an explanation including SubTheme membership. Relationship reasons display all 5 types.

### Parameter Changes

| Parameter | Gen2 | Gen3 | Notes |
| --- | --- | --- | --- |
| gridWidth | 15 | 22 | accommodate more sectors |
| gridHeight | 11 | 16 | accommodate more sectors |
| baseRadius | 5.2 | 6.8 | more theme anchors need larger radius |
| subThemeDistance | — | 1.5 | new: SubTheme anchor distance from theme center |
| maxStageShift | 1.6 | 1.6 | unchanged |
| centerPullStrength | 1.2 | 1.2 | unchanged |
| relationPullFactor | 0.18 | 0.15 | slightly reduced to avoid over-clustering |

### Engine Requirements (unchanged from Gen2)

- Deterministic: identical input produces identical output.
- Collision-free: no two sectors share the same grid cell.
- Explainable: every rendered sector has a reason payload.
- Bounded: stage heat moves sectors within a controlled limit.
- Compatible: output feeds existing `buildRenderNodes` and 3D scene pipeline.

## 3D Scene Adaptations

### Country Map Base Design

The 3D scene uses a "country map" visual metaphor. Themes are not visually separated islands; instead, the entire ground is a continuous map where theme regions blend into each other like provinces on a country map.

| Map Concept | Data Mapping | Visual |
| --- | --- | --- |
| Province | Theme | Continuous colored region, naturally adjacent to neighboring themes |
| City | SubTheme | Cluster of sector blocks within a theme region |
| Provincial capital | SubTheme center sector | Larger base block with label |
| Adjacency | Relationship strength | Adjacent blocks = closely related; distance = connection degree |

### Continuous Terrain Surface

Replace the Gen2 `GridHelper` with a continuous terrain base:

- **Terrain plane:** A single large `PlaneGeometry` serves as the ground. Colors are applied per-region using Theme identity, with **gradient transitions** at theme boundaries — neighboring themes blend naturally rather than having hard borders.
- **Sector blocks as terrain features:** Sector base blocks sit on top of the terrain plane like city markers on a map. Size varies: SubTheme centers are larger, ordinary sectors are smaller.
- **Relationship-proximity encoding:** Closely related themes have sectors placed adjacently (grid cells touching), creating natural "border" areas. Unrelated themes have gaps between them, like geographic distance between distant provinces.

### Label Density Control

Each SubTheme designates one sector as its "SubTheme center" — the sector whose `id` matches the SubTheme's primary sector. This is a data attribute, not a computed property.

Two-tier label strategy:

- **Default view:** Only theme centers (11) and SubTheme centers (~30) display `shortName` labels. Ordinary sectors render as small unlabeled blocks. Total visible labels: ~41, comparable to Gen2's 42.
- **Focus mode:** When a user clicks a SubTheme region, all sectors within that SubTheme expand their labels. Non-focused SubThemes remain compact. Click elsewhere or another SubTheme to exit focus.

This keeps 90 sectors readable without requiring zoom-dependent logic.

### Camera

Default camera position pulls back to accommodate the larger 22×16 map. `OrbitControls` min/max distance range adjusts proportionally.

## UI Panel Updates

### ControlsPanel (Left Sidebar)

- Theme filter: 7 → 11 options (including 4 new themes).
- Stage selector: 3 → 5 options.
- Optional: SubTheme sub-filter appears when a theme is selected, showing that theme's sub-themes.

### InspectorPanel (Right Sidebar)

- Sector detail section adds SubTheme membership display.
- Layout explanation section shows all 5 relationship types with distinct color labels:
  - `industrial-chain` — 产业链 (blue)
  - `market-comovement` — 市场共振 (green)
  - `heat-correction` — 热度修正 (gray)
  - `policy-linkage` — 政策联动 (orange)
  - `capital-flow` — 资金流向 (red)
- Relationship list grouped by type.

### DatasetSummary

- Theme count: 11
- Sector count: ~90
- Relationship edge count: ~150–180
- Stage count: 5

## Architecture Fit With Gen2

Gen3 extends Gen2 boundaries without replacing the visualization stack:

| Gen2 Module | Gen3 Change |
| --- | --- |
| `types.ts` | Add `SubTheme` interface, `subThemeId` on `Sector`, expand `RelationshipType` union |
| `themeRegistry.ts` | Expand to 11 themes, ~90 sectors. Add `subThemeRegistry` data |
| `relationshipRegistry.ts` | Expand to ~150–180 edges with 5 relationship types |
| `layoutStages.ts` | Expand to 5 stages with new theme heat values |
| `algorithmicLayoutEngine.ts` | Add SubTheme anchor step, adjust grid/pull parameters, support new relationship types |
| `renderNodes.ts` | Pass SubTheme info through to render nodes |
| `CapitalMapScene.tsx` | Country-map terrain base, sector blocks as terrain features, label density control |
| `ControlsPanel.tsx` | More theme filter options, more stage options |
| `InspectorPanel.tsx` | SubTheme info, 5 relationship types with color labels |

New files:
- `src/domain/subThemeRegistry.ts` — SubTheme definitions

No changes to:
- Data flow architecture (unidirectional)
- `LayoutProvider` / `DataProvider` interfaces
- Domain layer purity (zero React imports)
- Testing strategy

## Testing And Acceptance Criteria

### Data Tests

- Theme count is 11.
- Sector count is in the range 80–100.
- Every sector references a valid primary theme.
- Every sector references a valid SubTheme.
- SubTheme references a valid theme.
- Every theme has at least one SubTheme.
- Every SubTheme has at least one sector.
- Relationship edges reference valid sector ids.
- Relationship edge types are one of the 5 valid types.
- Every theme pair has at least one cross-theme edge.
- Relationship edge count is in the range 150–180.

### Algorithm Tests

- Same input produces the same coordinates every run (determinism).
- Every sector receives exactly one grid cell.
- No two sectors share the same grid cell.
- SubTheme members are spatially closer to each other than to sectors in other SubThemes of the same theme.
- Strong relationship pairs have lower average grid distance than weak or unrelated pairs.
- Hot themes move closer to the visual center in relevant stages.
- Stage movement stays within configured maximum distance.
- Each sector receives at least one explanation.
- New relationship types appear in explanations when applicable.

### UI Tests

- Theme filter shows 11 options.
- Stage selector shows 5 options.
- Selecting a sector shows SubTheme membership.
- Inspector shows all 5 relationship types with color labels.
- Dataset summary reflects updated counts.

### Visual Tests

- 3D scene is non-blank on desktop.
- Country-map terrain base renders as a continuous colored surface with gradient theme transitions.
- Label density control works: default view shows fewer labels, focus mode expands labels on click.
- Multi-theme peaks remain distinguishable at the larger scale.
- Closely related themes have adjacent sectors (visible border areas).

## Success Definition

Gen3 is successful when a user opens the website and sees a substantially larger market cognition map that looks like a country map — with theme regions as provinces blending into each other, SubTheme clusters as cities, and sector blocks sized by importance. The user switches between 5 market stages and understands why any sector is placed where it is — including cross-theme relationships explained by policy or capital-flow dynamics.

The result should feel like navigating a geographic market landscape rather than reading an isolated chart.
