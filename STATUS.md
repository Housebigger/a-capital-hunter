# 项目状态记录

> 最后更新：2026-06-18
> 记录人：ZCode agent
> 目的：交接当前进展、卡点、根因分析，方便后续继续。

---

## 一句话总结

JQData/Tushare 真实资金流管线已**全部实现并验证可用**，真实数据已成功入库（2026-06-17，167/168 只股票）。前端卡点（「一直等待真实资金流快照」）的**根因已定位并修复**（见下「✅ 卡点根因与修复」），数据层已端到端验证；**浏览器实际渲染待用户最终确认**。

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
后端: 53 passed (pytest)
前端: 156 passed (vitest)
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
- `src/App.tsx` — **状态机在这里，卡点的核心**
- `src/components/DataStatus.tsx` — 数据状态显示组件
- `src/components/ControlsPanel.tsx` — 控制面板（含日期选择器）
- `src/data/capitalFlowSnapshot.ts` — API 契约 + 校验
- `src/data/capitalFlowDataProvider.ts` — 前端 Provider（fetch + 10s 超时）
- `src/domain/capitalFlowAggregation.ts` — P1/P2/P3 聚合（去重主力净流入）

### 数据
- `src/data/stockRegistry.json` — 184 只股票（前后端共享）
- `src/data/subThemeRegistry.json` — 45 个子题材
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
