# Gen9: P3 个股视图 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 在P2子题材Voronoi板块内，渲染3-8只代表个股的条形柱，半径小于P2。

**Architecture:** 复用已有P2 SubTheme Voronoi板块作为底座，在其上叠加个股柱体。新增stockLayoutEngine计算个股在板块内的合理位置，新增P3场景模式渲染。

---

### Task 1: 创建 stockLayoutEngine.ts

**Files:**
- Create: `src/domain/stockLayoutEngine.ts`
- Create: `src/domain/stockLayoutEngine.test.ts`

- [ ] **Step 1:** 创建stockLayoutEngine.ts
  - `StockPosition` 类型: `{ stockId, x, z }`
  - `placeStocksInCell(cell: VoronoiCell, cellStocks: readonly Stock[]): StockPosition[]`
  - 算法: 1只→放中心; 2只→中心左右对称; 3+只→首只在中心，其余在环形均匀分布
  - 环形半径 = 根据板块面积动态计算(sqrt(area) * 0.2)，上限0.6
  - 所有位置用clampInside确保在板块多边形内
- [ ] **Step 2:** 编写测试
- [ ] **Step 3:** 运行测试确认通过

### Task 2: 创建 stockRenderNodes.ts (P3专用)

**Files:**
- Create: `src/domain/stockRenderNodes.ts` 
- Create: `src/domain/stockRenderNodes.test.ts`

- [ ] **Step 1:** 创建stockRenderNodes.ts
  - `StockRenderNode3` 类型: `{ stock, subTheme, theme, position, metric, visible, cell }`
  - `buildP3StockRenderNodes(input)`: 遍历VoronoiCell→过滤板块内stocks→调用stockLayoutEngine计算位置→用场景数据计算metric
  - 个股资金流数据: 从SubTheme聚合资金按股票排名分配(头部分多,尾部少)
- [ ] **Step 2:** 编写测试
- [ ] **Step 3:** 运行测试确认通过

### Task 3: 添加P3场景渲染到CapitalMapScene.tsx

**Files:**
- Modify: `src/components/CapitalMapScene.tsx`

- [ ] **Step 1:** 新增 `P3CapitalMapSceneProps` 接口
- [ ] **Step 2:** 新增 `StockCylinderColumn` 组件(半径0.12,比P2的0.25小)
- [ ] **Step 3:** 新增 `P3CapitalMapScene` 组件: P2底座板块 + 个股柱体 + 个股标签
- [ ] **Step 4:** 在 `CapitalMapScene` dispatch中添加 `mode === "stock"` 分支

### Task 4: 接入P3视图到App.tsx和HunterScene.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/HunterScene.tsx`
- Modify: `src/components/ControlsPanel.tsx`

- [ ] **Step 1:** App.tsx ViewMode扩展为 `"P1" | "P2" | "P3"`
- [ ] **Step 2:** App.tsx 计算P3数据: stockLayout + stockRenderNodes
- [ ] **Step 3:** HunterScene.tsx 传递P3 props
- [ ] **Step 4:** ControlsPanel.tsx 添加P3选项

### Task 5: 全量测试与构建验证

- [ ] `npm test` 全部通过
- [ ] `npm run build` 构建成功
- [ ] 启动dev server手动验证
