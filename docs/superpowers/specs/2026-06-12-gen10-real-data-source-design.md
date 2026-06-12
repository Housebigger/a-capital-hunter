# Gen10: 接入真实数据源 (AkShare) 设计文档

## 概述

将 A Capital Hunter 从纯 mock 数据切换到真实 A 股市场资金流向数据。使用 AkShare（Python）作为数据源，Flask 微服务作为 API 层，Vite Dev Proxy 转发请求。前端 `DataProvider` 接口不变，新增 `createAkShareDataProvider()` 实现。

## 架构

```
AkShare (Python 库)
  ak.stock_sector_fund_flow_rank(indicator, sector_type)
       ↓
Flask API (localhost:5001)
  GET /api/capital-flow/realtime
  GET /api/capital-flow/history?days=5
  GET /api/capital-flow/concepts
       ↓
Vite Dev Proxy (localhost:5173/api/* → localhost:5001/*)
       ↓
前端 fetch → AkShareDataProvider → MarketScenario[]
```

关键原则：
- `DataProvider` 接口不变，下游组件零改动
- mock provider 保留作为 fallback
- 请求失败自动降级到 mock 数据

## 后端：Flask API

### 文件结构

```
server/
  app.py              — Flask 主入口（3 个端点 + 健康检查）
  sector_map.py       — 行业名称 → sectorId 映射规则
  requirements.txt    — flask, akshare, flask-cors
```

### 端点

#### `GET /api/capital-flow/realtime`

- 调用 `ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")`
- 返回当日行业板块主力资金净流入
- 响应格式：
  ```json
  {
    "date": "2026-06-12",
    "source": "eastmoney",
    "points": [
      { "sectorName": "光伏设备", "sectorId": "power-generation", "netInflow": 45.2, "pctChange": 2.11 }
    ]
  }
  ```

#### `GET /api/capital-flow/history?days=5`

- 调用 `ak.stock_sector_fund_flow_rank(indicator="5日", sector_type="行业资金流")` 获取近 5 日累计
- 或使用 `ak.stock_sector_hist_fund_flow()` 获取逐日数据
- 响应格式：
  ```json
  {
    "scenarios": [
      { "id": "2026-06-12", "label": "2026-06-12", "points": [...] },
      { "id": "2026-06-11", "label": "2026-06-11", "points": [...] }
    ]
  }
  ```

#### `GET /api/capital-flow/concepts`

- 调用 `ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="概念资金流")`
- 获取概念板块（人工智能、机器人概念等）资金流
- 响应格式同 realtime

#### `GET /api/health`

- 返回 `{ "status": "ok", "akshare_version": "x.y.z" }`
- 前端用于检测后端可用性

### 名称映射 (sector_map.py)

AkShare 返回东方财富行业名，需要映射到我们的 sectorId。映射规则：

- 精确匹配：`"半导体"` → `semiconductors` 主题下多个 sector
- 关键词匹配：`"光伏"` → `power-generation`
- 概念板块匹配：`"人工智能"` → `ai-computing` 主题下 sector
- 未匹配的行业数据丢弃

映射优先使用概念板块（更贴合我们的题材分类），行业板块作为补充。

### 缓存策略

- Flask 端内存缓存，使用 `flask-caching`
- 盘中（9:30-15:00）TTL 5 分钟
- 盘后 TTL 30 分钟
- 避免被东方财富限流

### 错误处理

- AkShare 调用失败 → 返回 `{ "error": "...", "fallback": true }`
- 前端检测 `fallback` 字段，自动降级到 mock 数据
- 请求超时 10 秒

## 前端集成

### 新增文件

**`src/data/akShareDataProvider.ts`**

- 实现 `DataProvider` 接口
- `createAkShareDataProvider(): DataProvider`
- 内部 fetch Flask API 端点
- 响应数据经过 `sector_map` 反向映射，转换为 `MarketScenario[]`
- 请求失败返回 mock 数据（降级）

### 数据映射流程

```
Flask 返回: [{ sectorName: "光伏设备", netInflow: 45.2 }]
       ↓
前端映射: sectorName → sectorId（使用后端已映射好的 sectorId）
       ↓
聚合为 MarketScenario: { id: "realtime-2026-06-12", label: "实时", story: "东方财富实时数据", points: [...] }
```

### App.tsx 修改

- 新增 `dataProviderMode` 状态：`"akshare" | "mock"`
- 默认 `"akshare"`
- `useEffect` 首次加载 ping `/api/health`，失败则降级 `"mock"`
- 用 `createAkShareDataProvider()` 替换 `createScenarioDataProvider()`
- ControlsPanel 可增加数据源状态指示器（当前连接 mock/实时）

### Vite 配置

```typescript
// vite.config.ts 添加
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5001',
      changeOrigin: true,
    }
  }
}
```

### 测试策略

- `akShareDataProvider.ts`：用 `vi.fn()` mock fetch，测试映射逻辑和降级逻辑
- Flask 端：单独 pytest 测试（不在前端 vitest 范围内）
- 现有 129 个前端测试不受影响（mock provider 保留）

## 启动命令

```bash
# 一条命令启动前后端（添加到 package.json scripts）
"dev:full": "concurrently \"npm run dev\" \"cd server && python app.py\""

# 仅前端（无后端时自动降级 mock）
"dev": "vite"
```

## 范围限定 (Gen10)

Gen10 只做：
1. Flask 后端 + AkShare 数据抓取
2. 行业板块级别资金流（P1/P2 视图）
3. 实时快照 + 近 5 日历史
4. 前端 DataProvider 集成 + 自动降级

不在 Gen10 范围：
- 个股级别资金流（留给 Gen11，P3 视图）
- 数据库持久化
- 用户认证
- 部署自动化
