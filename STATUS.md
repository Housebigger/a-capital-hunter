# 项目状态记录

> 最后更新：2026-06-22
> 记录人：ZCode agent
> 目的：交接当前进展、卡点、根因分析，方便后续继续。

---

## 一句话总结

JQData/Tushare 真实资金流管线已**全部实现并验证可用**，真实数据已成功入库（2026-06-17，167/168 只股票）。前端卡点（「一直等待真实资金流快照」）的**根因已定位并修复**（见下「✅ 卡点根因与修复」），数据层已端到端验证、**浏览器已确认渲染正常**。在此之上完成一轮 **UI 优化 + 资金流时间档位（P0–P5）**，已合并入 `main`（见下「✅ UI 优化 + 资金流时间档位」）。此后又完成一批**发布前优化**——窗口 bug 修复、仓库清理 + 推送 GitHub、中英文 README、静态站点部署、**SP1 内容深度（子题材 45→74、个股 184→408）**、**SP2 热度驱动动态布局**、**SP3 移动端/响应式**、**SP4 界面/交互打磨**——均已合并入 `main`（见下「✅ 发布前优化 + 静态部署」）。

---

## ✅ 发布前优化 + 静态部署（2026-06-19 ~ 06-22）

承接上轮 UI 优化，完成一批"对外发布前"的工作（均 spec → plan → 子代理逐任务 TDD → 整支评审 → 合并）：

- **窗口 bug 修复** — 近10/近20日曾与近5日显示相同（根因：仅 2 条快照、窗口塌缩，非代码逻辑错）。`server/capital_flow/window.py::select_window_dates` 加交易日**连续性护栏**（相邻交易日间隔 > `MAX_TRADING_GAP_DAYS=14` 即停），并清理陈旧快照；用户随后回补至 20 个交易日。
- **仓库深度清理 + 推送 GitHub** — 清掉无关/冗余文件（含一个 354MB 跨链 codex worktree，确认归属后删除），确认 git 历史无密钥后推送到 `https://github.com/Housebigger/a-capital-hunter`。
- **README** — 补 Quick Start；新增中文版 `README.zh-CN.md`（项目中文名「A主猎人」）；`image_log/` 换最新实际效果图 + 用途说明。
- **静态站点部署** — `scripts/export_static_data.py`（快照导出为静态 JSON）+ `createStaticCapitalFlowDataProvider` + `SiteDisclaimer` + GitHub Actions 定时（`.github/workflows/deploy.yml`）。**待用户**：在 repo 加 `TUSHARE_TOKEN` secret 并开启 GitHub Pages 后才会自动部署。
- **SP1 — 内容深度**（merge `11f299b`）：子题材 **45→74**、个股 **184→408**。混合生成（起草 → 真实 Tushare `daily_basic`/`stock_basic` 核实 → 落地真实名称），按流通市值排序 + 流动性下限，过滤 ST/停牌/次新/低流动 + 去重到单一子题材。**SP1 不支持北交所**，已移除全部非 A 股占位。
- **SP2 — 热度驱动动态布局**（merge `1c4b14c`）：P1/P2 板块底座的**尺寸与位置随当前窗口 |主力净流入| 流动**，切档 **~0.6s 缓动过渡**；冷板块有尺寸下限不消失。P2 核心是**加权 Voronoi 树图（power diagram，迭代权重 → 面积 ∝ 热度）**——热子题材一定比冷的大（全 11 主线 **0/426** 反序）。诚实红线保留：仅真实热度驱动；演示模式静态、不伪造。门禁：前端 **194**、后端 **90**、tsc 0、build OK。**动画视觉已由用户浏览器确认通过（2026-06-22）。**
  - spec：`docs/superpowers/specs/2026-06-22-heat-driven-dynamic-layout-design.md`（含 As-built notes）
  - plan：`docs/superpowers/plans/2026-06-22-heat-driven-dynamic-layout.md`
- **SP3 — 移动端/响应式**（merge `7019ceb`）：单一 **≤900px「紧凑」断点**驱动全部移动行为，桌面端字节级不变。顶部**常驻控件条** `MobileControlBar`（时段+视图，复用抽出的 `WindowSelector`/`ViewModeSelector`）；触摸：**双指旋转 / 单指滚页 / 轻点选中**（`OrbitControls touches` + `touch-action: pan-y`）；性能：`dpr` 封顶 [1,2]、移动端阴影 256（桌面默认 512）；手机**降低标签密度**（`domain/labelDensity.ts`：P3 个股每子题材 top-1、P2/P3 子题材 top-10）。`useIsMobile` 钩子是紧凑模式唯一真源。门禁：前端 **200**、后端 90、tsc 0、build OK。**移动端触摸/视觉已由用户浏览器确认通过（2026-06-22）。**
  - spec：`docs/superpowers/specs/2026-06-22-mobile-responsive-design.md`
  - plan：`docs/superpowers/plans/2026-06-22-mobile-responsive.md`
- **SP4 — 界面/交互打磨**（merge `9cbf012`）：把**选中变成真正的交互**（此前在 live 路径上点击无反馈）——点主线/子题材/个股 → 选中格子**金色高亮环 + 柱体微亮 + 右侧详情**（纯 `domain/selectionDetail.ts` 视图模型；P1/P2/P3 live 场景均接通点击）。**诚实修正**：真实数据标为「主力净流入」（此前误标「模拟净流入」），演示模式才标「模拟」。另含概览列表/关系标签样式、按钮过渡、加载脉冲、AA 对比度。纯表现层，无数据/热度/布局改动。门禁：前端 **206**、后端 90、tsc 0、build OK。**交互/视觉已由用户浏览器确认通过（2026-06-22）。**
  - spec：`docs/superpowers/specs/2026-06-22-ui-interaction-polish-design.md`（含 area 2 全接通选中的范围扩展）
  - plan：`docs/superpowers/plans/2026-06-22-ui-interaction-polish.md`

**剩余发布前子项目：** SP5 分享/SEO 元信息。

**文档待办（非阻塞）：** `EASE_TAU`（`src/components/CapitalMapScene.tsx` 顶部，=0.6）是动画手感旋钮，如需更快/更慢可调。

---

## ✅ UI 优化 + 资金流时间档位（P0–P5，2026-06-18 合并入 main）

承接卡点修复后，完成一轮界面走查 + 新功能，经 spec → plan → 子代理逐任务 TDD → 整支评审 → 合并（merge commit `ad66c5f`，18 commits）。全门禁绿：后端 **69 passed**、前端 **170 passed**、tsc 0 错误、build OK。

设计/计划文档：
- spec：`docs/superpowers/specs/2026-06-18-ui-polish-and-time-windows-design.md`
- plan：`docs/superpowers/plans/2026-06-18-ui-polish-and-time-windows.md`

**交付项：**

- **P0** — header 与 DataStatus 经共享 `src/data/sourceLabel.ts` 显示真实数据源（不再硬编码「JQData」）。
- **P1** — `.data-status` 改右上角浮层，消除与 `.scene-toolbar` 的重叠乱码。
- **P5（主功能）** — 今日/近5/近10/近20日时间档位：`server/capital_flow/window.py::aggregate_window`（按 stockId 累加 N 个交易日单日净额）→ `repository.get_window_snapshot` → 只读 API `?window=1d|5d|10d|20d`（每个快照响应统一带 `window` 字段）→ `service.sync_backfill` + CLI `--backfill N`（回补历史）→ 前端 `CapitalFlowSnapshot.window` 必填契约 + `parseWindow` → `fetchLatest(window)` → ControlsPanel 4 按钮档位选择器（替换日期下拉）→ App 接线 + 档位标签 header。
- **P2b** — 未选中板块时，InspectorPanel 展示当日概览（Top 净流入/净流出 + 全市场合计），复用 `src/domain/capitalFlowOverview.ts`。
- **P4** — 左栏「读图规则」改为可折叠（默认收起）+ 图例加「红=流入（A股习惯）」注。
- **P3a/P3b/P2a** — 主题底板去饱和（opacity 0.5→0.32）、P3 个股标签加描边/增大、默认相机取景居中（视觉调参，已浏览器确认）。

**评审与回归修复：** 整支代码经一轮独立评审，发现并修复 3 个真实回归（均补回归测试）：
- **I1** — 切换档位时 3D 场景闪烁（`loadInitial` 丢了「加载时保留上一帧快照」逻辑，已恢复）。
- **I2** — `App.tsx` 残留无用的 `status` state + 每次切档冗余 `fetchStatus()`（已移除）。
- **I3** — `sync_backfill` 仅捕获 `SnapshotSyncError`，遇 `CapitalFlowSourceError` 会中断整次回补（已放宽为同时捕获）。
- 驳回评审的 M4（误报：`isString` 本就拒绝空串）。

**评审待办（已处理，2026-06-18）：**
- **M1（已处理，commit `f7d9ed9`）** — 多日窗口 `status` 改为取窗口内最差（任一天 partial → 窗口 partial）；`coverage` 仍取锚点当天广度（`window.availableDays` 反映窗口时间完整度）。
- **M6（已处理，commit `6f20c44`）** — 删除生产路径已不再调用的 `repository.get_latest_snapshot()` 及其 3 个测试。

> 注：P0 顺带把上一节末尾提到的 `status()` 硬编码 `"jqdata"` 一并修掉了（动态读真实 source，缺省 tushare）。

---

## ✅ 卡点根因与修复（2026-06-18）

**根因（已用真实数据 + 真实校验器双重坐实）：**

后端 `repository.py` 的 `_expand()` 序列化每个 point 时**缺少 `tradeDate` 字段**，而前端契约 `capitalFlowSnapshot.ts` 的 `parsePoint` 把 per-point `tradeDate` 列为必填非空字符串。后果：任何含 point 的真实快照，在 `parseSnapshot` 的 `points.map(parsePoint)` 第一个点即抛 `InvalidSnapshotError` → `App.tsx` 置 `error` 态 → `DataStatus` 显示「没有可用的真实资金流快照」+ 重试/加载演示按钮。

**为何此前所有「验证正常」都没抓到：** curl / Python 端模拟都不执行 TS 校验器；前端单测的 mock fixture 每个 point 都手写了 `tradeDate`，比真实后端输出更「完整」，从未踩到这道坎；后端 `test_api.py` 也未断言 per-point `tradeDate`。契约漏洞在「真实生产形状」与「测试 mock 形状」之间。此前怀疑的 4 个方向（竞态 / CORS / StrictMode / 挂载）均非根因。

**修复（方案 A：后端补字段，保持严格契约）：**

- `server/capital_flow/repository.py::_expand` — 每个 point 补 `d["tradeDate"] = row["trade_date"]`（点的交易日 = 快照交易日）。
- `server/tests/test_api.py` — 新增 `test_latest_snapshot_points_carry_trade_date`（堵生产端洞）。
- `scripts/dump_snapshot_fixture.py` + `src/test/fixtures/backendSnapshot.sample.json` + `src/data/capitalFlowSnapshot.test.ts` — 从**真实 `_expand`** 生成金标准 fixture，用真实 `parseSnapshot` 解析（堵「mock 比真实更完整」这类漂移复发）。后端形状变更后用脚本重新生成 fixture。

**已验证：** 真实 DB 的 167 点快照（2026-06-17）修复后**完整通过 `parseSnapshot`**；后端 54 passed、前端 158 passed、tsc 0 错误。

**待用户确认：** 在浏览器实跑 `npm run dev:full`，确认 P1/P2/P3 峰面真正渲染（数据 / 校验层已证，UI 渲染走的是与 demo / 单测同一套 render-node 逻辑，预期可正常显示）。

> 顺带发现（非卡点，未在本次改动）：`repository.py::status()` 把 `source` 硬编码成 `"jqdata"`，而真实快照 source 是 `"tushare"`，属轻微不诚实瑕疵，可单独修。

---

## 已完成且已提交的工作

### 1. 完整的 JQData 数据管线（10 个 Task 全部完成）

| Task | 内容 | 提交 |
|---|---|---|
| 1 | 注册表迁到共享 JSON（stockRegistry/subThemeRegistry） | ✅ |
| 2 | 后端 models + registry 标准化 | ✅ |
| 3 | JQData 适配器（CapitalFlowSource Protocol） | ✅ |
| 4 | SQLite 原子快照存储 | ✅ |
| 5 | 同步编排 + CLI（service.py / sync.py） | ✅ |
| 6 | 只读快照 API（Flask Blueprint） | ✅ |
| 7 | 前端快照 Provider + 严格校验 | ✅ |
| 8 | 从真实个股聚合 P1/P2/P3 | ✅ |
| 9 | App 显式数据状态（loading/ready/partial/error/demo） | ✅ |
| 10 | 文档 + E2E + 最终验证 | ✅ |

### 2. 数据源切换：JQData → Tushare（关键）

**原因**：JQData 的资金流（`get_money_flow`）是**付费模块**，免费账号认证能通过但调不了数据。

**方案**：实现 `TushareCapitalFlowSource`，默认数据源改为 Tushare（无地域限制）。

- **积分要求**：`moneyflow_dc`（5000 分，直接主力净流入）/ `moneyflow`（2000 分，自己算主力）
- **自动降级**：账号缺 5000 分权限时，自动降级到 `moneyflow`（2000 分）并自己算 `主力 = (buy_elg-sell_elg)+(buy_lg-sell_lg)`
- **用户已充值到 2000 积分**，降级路径可用
- **真实数据已验证**：新易盛 +16.14 亿领跑，符合市场记忆

### 3. 已修复的 bug

| Bug | 根因 | 修复 |
|---|---|---|
| JQData 资金流付费 | `get_money_flow` 是付费模块 | 切换到 Tushare |
| Tushare latest 同步失败 | 盘前/盘中当天数据未生成 | 自动回退前 5 个交易日 |
| 错误消息误导 | 写着 "JQData points" 实际是 Tushare | 消息中性化 |
| source 字段不诚实 | 硬编码 "jqdata" | 从 source.name 动态读取 |
| Flask SIGSEGV（35秒崩溃）| SQLite 连接跨线程并发访问内存损坏 | RLock 保护所有 DB 操作 |
| `env -u` 段错误 | macOS 上清除代理环境变量触发崩溃 | 改用 `CLEAR_PROXY_ON_STARTUP`（现默认） |

---

## ✅（已解决）原卡点记录：前端看不到数据

> 根因与修复见上方「✅ 卡点根因与修复」。以下为定位过程中的历史排查记录,保留备查。

### 症状

用户在浏览器（Safari）打开 http://localhost:5173，页面一直显示：
- 「**没有可用的真实资金流快照**」或「**等待真实资金流快照**」
- 「重试」/「加载演示数据」按钮
- 即使服务端 API 返回 200 + 真实数据，前端也不渲染

### 已验证「正常」的部分

- ✅ 后端 API 直连正常：`curl http://localhost:5001/api/capital-flow/snapshot/latest` 返回 167 个真实数据点
- ✅ Vite 代理正常：`curl http://localhost:5173/api/capital-flow/snapshot/latest` 也返回真实数据
- ✅ 数据库有真实数据：2026-06-17（167/168 ready）+ 2026-03-13
- ✅ Tushare token 有效，moneyflow 接口解锁
- ✅ Flask 压测稳定：30+20 并发请求全 200，RLock 修复后无 SIGSEGV

### 已尝试但未解决的排查

1. **端口冲突**：发现 5173 被旧 Vite 占用，新 Vite 跑到 5174。已清理。当前 5173 是正确的项目 Vite。
2. **浏览器缓存**：尝试无痕窗口（Cmd+Shift+N），仍然失败。
3. **前端 JS 加载**：`/src/main.tsx` 和 `/src/App.tsx` 都返回 200。
4. **服务端模拟前端请求流程**：`fetchStatus()` + `fetchLatest()` 都返回正确 JSON。

### 怀疑方向（待排查）

以下方向**尚未验证**，是下一步排查的重点：

1. **App.tsx 的状态机逻辑**：`useEffect` 里的 `loadInitial` 可能有竞态条件。状态 `loading` → `ready` 的流转可能在某些时序下卡住。需要：
   - 检查 `viewState` 状态机的所有分支
   - 特别是 `fetchStatus` 失败（非 `fetchLatest`）时是否会阻塞流程
   - App.test.tsx 里 `shows a hard error when no snapshot exists` 等测试虽然通过，但真实浏览器行为可能不同

2. **浏览器端 fetch 的实际行为**：服务端 curl 能通，不代表浏览器 fetch 能通。可能问题：
   - CORS 问题（Vite 代理和直连行为不同）
   - 浏览器对 `localhost` vs `127.0.0.1` 的处理差异
   - Safari 特有的 fetch 缓存行为
   - **需要在浏览器开发者工具的 Network 面板看请求实际状态**（用户报告 Safari 打不开开发者工具）

3. **DataStatus 组件的渲染逻辑**：当 `viewState` 是 `loading` 且 `activeSnapshot === null` 时，显示"正在读取"。如果 `fetchLatest` 成功了但状态没更新到 `ready`，就会卡在 loading。需要检查：
   - `setViewState(snapshot.status === "partial" ? {status:"partial"...} : {status:"ready"...})` 是否真的执行
   - React 19 的 StrictMode 双调用是否干扰

4. **main.tsx / index.html 的挂载**：可能页面根本没挂载 React。需要确认浏览器收到的 HTML 和执行情况。

### 推荐的下一步排查（给后续接手者）

**最关键**：拿到浏览器开发者工具的 Console 和 Network 信息。如果 Safari 难用，建议换 Chrome。

具体步骤：
1. 打开 http://localhost:5173
2. 打开开发者工具（Chrome: Cmd+Option+I）
3. Console 标签：看有没有红色报错（JS 异常、React 错误边界）
4. Network 标签：刷新页面，看 `/api/capital-flow/status` 和 `/api/capital-flow/snapshot/latest` 两个请求的状态码和响应体
5. 如果请求是 200 但前端仍 loading，问题在前端状态机
6. 如果请求失败（0 或 4xx/5xx），问题在网络层

**临时绕过方案**：如果短期内排查不出，可以在 App.tsx 里加个 fallback——当 fetchStatus 失败时，直接用 fetchLatest 的结果（不依赖 status 接口），这样至少能看到数据。

---

## 如何启动服务

```bash
# 1. 同步数据（需要 .env 里的 TUSHARE_TOKEN，已配置）
set -a; source .env; set +a
npm run sync:capital-flow          # 或 npm run sync:capital-flow -- --trade-date 2026-06-17

# 2. 启动服务（在你的终端，不要用 agent 后台启动——会崩溃/被回收）
npm run dev:full
# → Vite: http://localhost:5173
# → Flask: http://localhost:5001

# 3. 端口冲突时清理
lsof -ti :5001 | xargs kill -9
lsof -ti :5173 | xargs kill -9
```

### 重要：服务必须由用户终端维持

agent（ZCode）通过工具后台启动的进程，会被 harness 的 task 管理机制在对话间隙回收/杀死。所以**长期运行的服务必须由用户的终端维持**，agent 只适合做短时验证。

---

## 测试状态

```
后端: 90 passed (pytest)
前端: 206 passed (vitest)
e2e:  1 passed (playwright, 用 fixture mock)
tsc:  0 errors
build: OK
```

所有自动化测试通过。前端看不到数据的问题**没有被单元测试覆盖到**（因为 App.test.tsx 用 mock provider，绕过了真实网络层）。

---

## 关键文件索引

### 数据管线（后端）
- `server/capital_flow/source.py` — CapitalFlowSource Protocol + JQData/Tushare 两个实现
- `server/capital_flow/service.py` — 同步编排（latest 回退逻辑在这里）
- `server/capital_flow/repository.py` — SQLite 存储（RLock 在这里）
- `server/capital_flow/sync.py` — CLI 入口 + 数据源选择工厂
- `server/capital_flow/api.py` — Flask Blueprint（3 个只读路由）
- `server/app.py` — Flask 主应用（代理清理 + Blueprint 注册）

### 前端
- `src/App.tsx` — **快照状态机 + 热度→布局接线（SP2）在这里**
- `src/components/DataStatus.tsx` — 数据状态显示组件
- `src/components/ControlsPanel.tsx` — 控制面板（含日期选择器）
- `src/data/capitalFlowSnapshot.ts` — API 契约 + 校验
- `src/data/capitalFlowDataProvider.ts` — 前端 Provider（fetch + 10s 超时）
- `src/domain/capitalFlowAggregation.ts` — P1/P2/P3 聚合（去重主力净流入）

### 数据
- `src/data/stockRegistry.json` — 408 只股票（前后端共享）
- `src/data/subThemeRegistry.json` — 74 个子题材
- `server/data/capital_flow.sqlite3` — 快照库（已含真实数据）

### 配置
- `.env` — **用户凭据，已 gitignore**（含 TUSHARE_TOKEN，已配置有效）
- `.env.example` — 模板

---

## 凭据安全提醒

过程中 agent 曾误读 `.env`，导致 JQData 密码暴露在对话中。**建议用户改掉该密码**（虽然 JQData 资金流付费用不上，但密码可能在别处复用）。`.env` 已被 `.gitignore` 排除，密码不会进 git。

---

## Tushare 积分情况

- 当前用户积分：≥2000（已充值）
- `moneyflow`（2000 分）：✅ 可用（降级路径，自己算主力）
- `moneyflow_dc`（5000 分）：❌ 不可用（直接路径，需 5000 分）
- 代码会自动降级，用户无感知
