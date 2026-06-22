# A Capital Hunter · A主猎人

[English](./README.md) · **简体中文**

一个基于 React + Three.js 的三维可视化工具，把 A 股各板块的资金流动映射到可
交互的 3D 曲面上。板块的平面位置由**产业链 / 市场联动**关系决定，柱体高度编码
**主力净流入**的强度。界面为中文，代码标识符为英文。

## 界面预览

![A主猎人 — P1 主线全景](image_log/Screenshot%202026-06-19%20at%2007.56.35.png)

> **P1（主线）**——11 条主线以 Voronoi 蜂窝图布局；柱体高度与颜色编码主力净
> 流入（红=流入，绿=流出），右栏给出净流入 / 净流出 Top 榜。

![下钻到子题材与个股](image_log/Screenshot%202026-06-19%20at%2007.57.50.png)

> **P2（子题材）/ P3（个股）**——子题材与个股的单元格嵌套在各自所属的主线单
> 元格内。

[`image_log/`](./image_log) 文件夹是本项目的**可视化变更日志**：它按版本归档
*实际渲染效果*的全分辨率截图（上方两张即为最新一版的真实效果图）。该文件夹仅
作文档用途——应用与构建流程都不会读取其中内容。

## 快速开始

环境要求：**Node 18+** 与 **Python 3.9+**。

```bash
# 1. 克隆仓库
git clone https://github.com/Housebigger/a-capital-hunter.git
cd a-capital-hunter

# 2. 安装依赖（JS + Python）
npm install
python3 -m pip install -r server/requirements.txt

# 3. 配置数据源
cp .env.example .env
#   填写 TUSHARE_TOKEN —— 在 https://tushare.pro/register 免费注册，
#   再从 https://tushare.pro/user/token 复制你的 token。

# 4. 采集快照入 SQLite（同步脚本从环境变量读取 .env）
set -a; source .env; set +a
npm run sync:capital-flow                     # 仅同步最新交易日
npm run sync:capital-flow -- --backfill 20    # 推荐：回补 20 个交易日，
                                              # 让 今日 / 近5日 / 近10日 / 近20日
                                              # 各档位呈现不同的资金流地图

# 5. 启动全栈（Vite :5173 + Flask :5001）
npm run dev:full
```

随后打开 **http://localhost:5173**。

> 全新克隆**不含**任何快照数据——`server/data/*.sqlite3` 属于本地状态（已被
> gitignore）。第 4 步会生成它；在此之前界面会显式提示「无快照」错误（这是刻
> 意设计：它绝不伪造数据）。

> **后端启动须知：** 务必从**项目根目录**以 `python3 -m server.app` 启动后端，
> 这样只读快照 Blueprint 才会注册。遗留的 `cd server && python3 app.py` 仅提供
> AkShare 诊断路由（会打印一条警告）。长驻服务请在你自己的终端中运行。

## 数据管道

地图消费的是**真实的收盘快照**——绝不把模拟数字当作真实数据呈现。管道采用
**离线采集、在线读取快照**的架构：

```
Tushare moneyflow_dc  (源单位: 万元)
        │  日终采集器 (认证 → 代码标准化 → 去重 → ≥90% 覆盖判 ready/partial)
        ▼
本地 SQLite 快照库  (入库单位: 人民币元 CNY)
        │  Flask 只读 API（浏览器永不触发上游调用）
        ▼
React 异步 DataProvider
        │  buildCapitalFlowAggregates (去重 P3 个股 → P2 子题材 → P1 主线)
        ▼
HunterScene → CapitalMapScene (R3F Canvas)
```

- **指标：** 主力净流入（主力净流入 = 超大单净额 + 大单净额）。
- **单位：** Tushare/JQData 以「万元」上报；适配器在入库时统一换算为人民币元
  （CNY）。
- **节奏：** 收盘后。两个数据源都在收市后更新资金流。
- **诚实红线：** 前端在任何拉取失败时都会抛错——绝不静默替换为 mock 数据。当
  没有快照时，界面显示明确的错误并提供 **重试** 按钮，以及一个需主动点击的
  **加载演示数据** 按钮（优雅降级；演示模式始终带有标注）。

### 数据源：Tushare Pro（默认）对比 JQData

`CapitalFlowSource` 协议把管道与任何具体供应商解耦。仓库内置两种实现：

| 数据源 | 地区限制 | Token | 主力字段 | 成本 |
|---|---|---|---|---|
| **Tushare Pro**（默认） | ✅ 无 | tushare.pro 免费 | `moneyflow_dc.net_amount`（直接） | 5000 积分（免费，可累积） |
| Tushare（降级） | ✅ 无 | tushare.pro 免费 | 由 `moneyflow` 买卖额计算 | **2000 积分**（免费，可累积） |
| JQData | ❌ 仅限中国大陆 | joinquant.com | `net_amount_main`（直接） | 资金流模块**需付费** |

**Tushare 为默认数据源。** 它无地区限制，且 `moneyflow` 接口用免费 2000 积分账
号即可访问（新账号约从 120 积分起步，通过社区贡献逐步累积）。适配器优先尝试
`moneyflow_dc`（5000 积分，直接给出主力净额）；若账号无此权限，则**自动降级**
到 `moneyflow`（2000 积分），并按
`(buy_elg − sell_elg) + (buy_lg − sell_lg)` 计算主力净流入。

JQData 作为备选，面向**已购买**其资金流模块的账号——基础/免费 JQData 账号能完
成认证，但无法调用 `get_money_flow`（它是付费模块）。

通过 `.env` 中的 `CAPITAL_FLOW_SOURCE=tushare|jqdata` 切换数据源。

### 覆盖率与状态

当 ≥ 90% 的受支持去重证券拥有真实数据点时，快照标记为 `ready`；否则为
`partial`（仍会展示，并带警告）。`failed` 快照（0 个可用数据点）永不写入，因此
一个坏交易日无法覆盖掉一个好的快照。

## 常用命令

```bash
npm run dev                # Vite 开发服务器 (localhost:5173)
npm run build              # tsc 校验 + Vite 生产构建
npm test                   # Vitest 前端单元测试
npm run test:backend       # pytest（server/tests）
npm run e2e                # Playwright 端到端测试（需先启动开发服务器）
npm run sync:capital-flow  # 每日「数据源 → SQLite」同步
npm run dev:full           # 同时启动 Vite + Flask
```

## 权限说明

Tushare Pro 的 `moneyflow_dc`（直接主力净额）需要 **5000 积分**。适配器在检测到
权限拒绝时会自动回退到 `moneyflow`（**2000 积分**），由委托量级分项计算主力——
因此即使账号只满足较低档位，管道也能正常工作。新账号约从 120 积分起步；在
tushare.pro 上通过分享文章或邀请用户达到 2000 积分可解锁回退路径，达到 5000 积
分可解锁直接路径。

## 部署（GitHub Pages）

线上站点是**全静态**的：一个 GitHub Action 回补最近 20 个交易日、导出为静态
JSON、构建 SPA 并部署到 GitHub Pages。Tushare token 只在 Action 内部使用（仓库
密钥），绝不下发到浏览器。本地开发不受影响（`npm run dev:full` 仍走 Flask +
SQLite）。

流水线（`.github/workflows/deploy.yml`，在工作日定时、手动触发、push 到 `main`
时运行）：

```
sync --backfill 20  →  export_static_data.py  →  build:pages  →  deploy-pages
```

### 一次性配置（在 GitHub 网页端各做一次）

**1. 添加 `TUSHARE_TOKEN` 仓库密钥** —— 让 Action 能取数据，又不暴露你的 token。

- 在 GitHub 打开仓库 → **Settings** → 左侧 **Secrets and variables** → **Actions**。
- 在 **Secrets** 标签页点 **New repository secret**。
- **Name（名称）：** `TUSHARE_TOKEN`（必须完全一致——工作流按这个名字读取）。
- **Secret（值）：** 粘贴你在 <https://tushare.pro/user/token> 的 token。
- 点 **Add secret**。它加密存储，仅在 Action 运行时可见，绝不下发到浏览器。

**2. 以 GitHub Actions 为源启用 Pages** —— 让构建产物得以发布。

- 仓库 → **Settings** → 左侧 **Pages**。
- 在 **Build and deployment → Source** 选 **GitHub Actions**（不是 "Deploy from a
  branch"）。无需选择分支或 `/docs` 目录。
- 权限无需手动改——`deploy.yml` 已声明 `pages: write` + `id-token: write`。

**3. 触发首次部署。**

- 仓库 → **Actions** 标签页 → **Deploy to GitHub Pages** 工作流 → **Run workflow**
  （或直接推送到 `main`，或等工作日定时任务）。
- 在 **Actions** 页看运行状态；变绿后站点上线于
  **`https://housebigger.github.io/a-capital-hunter/`**。
- 随后把该网址粘到分享卡片调试器（如 <https://www.opengraph.xyz/>）确认 Open
  Graph 预览正常。

> 若运行在同步步骤失败，最常见的原因是 `TUSHARE_TOKEN` 缺失/错误或 Tushare 积分
> 不足（见上文「权限说明」）——Action 日志会指出具体原因。

本地自行构建：

```bash
set -a; source .env; set +a
npm run sync:capital-flow -- --backfill 20
npm run export:data        # 生成 public/data/snapshot-*.json
npm run build:pages        # 静态产物在 dist/
```

**免责声明：** 线上站点展示「数据来源 Tushare · 仅供学习与展示，非投资建议」。
公开转发 Tushare 衍生数据可能受其服务条款约束——发布前请先确认。

## 架构

完整的领域层 / 组件图见 [`AGENTS.md`](./AGENTS.md)。要点：

- **领域层（`src/domain/`）** 是纯函数 + 冻结的不可变数据，零 React 引入，完全
  可单元测试。
- **共享注册表（`src/data/*.json`）** 是个股 / 子题材映射的唯一事实来源，由
  TypeScript 与 Python 共同消费。
- **`CapitalFlowSource` 协议** 把管道与具体数据源解耦；新增一个数据源适配器只
  需实现四个方法。
- **聚合不变量：** P1（主线）== P2（子题材）== 去重后 P3 合计，误差在 0.01 CNY
  以内，由 Python 服务与 TS 聚合器双侧共同强制。

## 遗留诊断接口

Flask 路由 `/api/capital-flow/rank`、`/api/capital-flow/history` 与
`/api/health` 封装的是 **AkShare**（抓取东方财富）。它们仅保留用于本地探测该链
路，**不是**产品主路径——前端只消费快照接口（`/api/capital-flow/snapshot/*`、
`/status`）。
