# JQData 日终真实资金流设计

## 1. 背景与目标

A Capital Hunter 已有 AkShare + Flask 的实验性真实数据链路，但当前实现依赖东方财富非官方抓取接口。该接口在代理和直连环境中均可能返回连接中断，且上游字段和占位值变化频繁。现有前端还会在请求失败时静默切换到模拟场景，使用户无法判断所见数据是否真实。

本阶段面向个人本地研究，使用可注册且优先免费额度的数据平台。首版采用 JQData 的日度个股资金流作为唯一真实数据原子层，以 `net_amount_main` 表示主力净流入，并从 P3 精选个股向上聚合生成 P2 子题材和 P1 主线数据。

目标：

- 覆盖当前 `stockRegistry` 中可识别、可查询的精选 A 股。
- 每日收盘后手动同步最近交易日数据。
- 页面只展示有明确来源、日期和覆盖率的真实数据。
- 数据获取失败时保留旧快照，不以模拟数据伪装真实数据。
- 为后续增加 Tushare 等备用数据源保留稳定接口。

首版不包含：

- 盘中实时或分钟级刷新。
- 全市场股票和动态题材成分维护。
- 港股、美股等多市场资金流。
- 操作系统级定时任务。
- 多数据源自动切换与跨源口径校准。

## 2. 数据源与指标口径

主数据源为 JQData，采集接口为 `get_money_flow`。

统一指标：

- 字段：`net_amount_main`
- 含义：主力净流入额，即超大单净额与大单净额之和，以 JQData 当期接口定义为准。
- 入库单位：人民币元（CNY）。
- UI 展示单位：由现有指标归一化层换算为亿元。
- 时间粒度：交易日。

每份快照必须记录数据源、指标名、交易日和采集时间。任何模拟、推算或缺失填充值都不能写入真实快照点表。

## 3. 总体架构

采用“离线采集、在线读快照”：

```text
JQData get_money_flow
        |
        v
日终采集器（认证、代码标准化、校验、去重）
        |
        v
本地 SQLite 快照库
        |
        v
Flask 只读 API
        |
        v
React Async DataProvider
        |
        v
P3 个股 -> P2 子题材 -> P1 主线
```

采集和展示必须解耦。浏览器请求不得触发 JQData 调用，避免网络、额度、认证和响应时延影响页面可用性。

后端定义数据源边界：

```python
class CapitalFlowSource(Protocol):
    def latest_trade_date(self) -> date: ...
    def fetch_daily(self, trade_date: date, securities: list[str]) -> list[SourcePoint]: ...
```

首版实现 `JqDataCapitalFlowSource`。Flask API 和 SQLite 仓储不依赖 JQData SDK 的具体返回类型。

## 4. 股票范围与代码标准化

当前采集候选来自 `src/domain/stockRegistry.ts`，约有 184 条展示记录。实施时新增机器可读的共享股票清单 JSON，并让 TypeScript 注册表与 Python 采集器共同读取它；JSON 成为股票代码、名称和子题材映射的唯一事实源，禁止在 Python 中解析 TypeScript 源码或复制维护第二份清单。该清单包含同一证券在多个子题材重复出现的情况，也包含占位代码、非 A 股代码和不可查询条目。

代码标准化规则：

- 上海 A 股转为 `XXXXXX.XSHG`。
- 深圳 A 股转为 `XXXXXX.XSHE`。
- 可被 JQData 查询的北交所股票转为平台支持的标准后缀。
- 仅凭六位数字不足以可靠判定、平台不支持或查询失败的代码标记为无效。
- 港股、美股、占位代码和伪代码不进入首版 P3。

采集前先按标准证券代码去重。一个证券只请求和存储一次，但保留它与所有 `stockId`、`subThemeId` 的展示映射。

首版 P3 只展示成功匹配且当前快照有真实值的 A 股。被排除的条目记录原因，用于数据质量报告，但不在地图上以零值或模拟值占位。

## 5. 快照数据契约

前端使用下列逻辑模型：

```ts
interface CapitalFlowSnapshot {
  tradeDate: string;
  fetchedAt: string;
  source: "jqdata";
  metric: "net_amount_main";
  unit: "CNY";
  status: "ready" | "partial" | "failed";
  coverage: {
    requested: number;
    succeeded: number;
    failed: number;
  };
  points: StockCapitalFlowPoint[];
  failures: StockFetchFailure[];
}

interface StockCapitalFlowPoint {
  stockId: string;
  securityCode: string;
  stockName: string;
  subThemeId: string;
  netAmountMain: number;
  tradeDate: string;
}
```

`points` 可为同一证券包含多个展示映射，但必须携带相同的原子资金值。所有向上聚合都先以 `securityCode` 识别证券，不能把重复展示记录当作多笔资金流。

状态规则：

- `ready`：存在真实数据，且有效目标证券覆盖率至少 90%；允许少量失败，但必须在元数据和 UI 中展示失败数量。
- `partial`：存在真实数据，但覆盖率低于 90%。
- `failed`：没有可用于展示的真实点；失败尝试可记录审计信息，但不能成为最新可用快照。

覆盖率分母是通过代码标准化且预期可由 JQData 查询的唯一证券数，不包含预先识别的港股、美股和占位代码。

## 6. SQLite 存储

SQLite 是本地快照事实源，建议拆为四类表：

- `capital_flow_snapshots`：快照元数据、状态、覆盖数量、来源和指标。
- `capital_flow_points`：按 `snapshot_id + security_code` 唯一存储原子资金值。
- `stock_mappings`：标准证券代码到项目 `stockId`、`subThemeId` 和股票名称的映射。
- `capital_flow_failures`：排除项、请求失败项和缺失项及其原因。

写入必须在单个事务中完成。只有元数据、点、映射、失败记录及聚合校验全部通过后，快照才可提交。失败事务回滚，并保留上一份可用快照。

数据库文件属于本地运行数据，不提交 Git。凭据只从后端环境变量读取，不进入数据库、API 响应、日志正文或前端包。

## 7. 聚合规则

P3 使用按证券代码唯一存储的真实 `net_amount_main`。当同一证券属于多个子题材时，界面可以在多个 P3 区域展示该证券，但聚合必须避免重复计算。

为保证 P1/P2 可加总且总额一致，首版采用确定性主归属规则：

1. `stockRegistry` 中同一证券第一次出现的 `subThemeId` 是其聚合主归属。
2. 其他子题材映射只用于 P3 关联展示，不计入 P2/P1 金额。
3. P2 按证券的主归属 `subThemeId` 求和。
4. P1 按 P2 所属主题继续求和。

必须满足：

```text
P1 全部主线之和 = P2 全部子题材之和 = 去重后的 P3 证券总额
```

UI 应能区分“聚合主归属”和“关联展示”，避免用户误以为同一笔资金被多个题材共同拥有。后续若引入权重分摊模型，必须作为独立版本设计和校准，不能在首版中隐式实现。

缺失值不按零处理。某证券缺失时，它不参与该日聚合，同时影响覆盖率和快照状态。

## 8. 日终采集流程

提供命令：

```bash
python3 -m server.capital_flow.sync --trade-date latest
```

执行步骤：

1. 从环境变量读取 JQData 凭据并认证。
2. 将 `latest` 解析为 JQData 可用的最近交易日；显式日期则校验是否为交易日。
3. 解析项目股票清单，生成有效证券、重复映射和排除项。
4. 对唯一有效证券批量获取 `net_amount_main`。
5. 校验交易日、证券代码、数值类型、重复行和缺失值。
6. 建立展示映射与确定性主归属。
7. 计算覆盖率与快照状态。
8. 校验 P1、P2、P3 聚合总额一致。
9. 在事务中写入 SQLite 并提交。
10. 输出交易日、覆盖率、排除项、失败项和聚合校验摘要。

当指定当天尚无数据时，`latest` 自动选择最近已有数据的交易日，并在快照中记录实际交易日。显式日期模式不静默改写日期，失败时返回明确错误。

## 9. 容错与可观测性

- 认证、网络或数据源整体失败：不创建可用快照，不覆盖旧数据。
- 个别证券失败：创建 `partial` 快照并记录逐项原因。
- 返回空值、`-`、非数值或无对应交易日：记为缺失，禁止转换为零。
- SQLite 写入失败：完整回滚。
- API 默认返回最新 `ready` 快照；没有 `ready` 时可返回最新 `partial`，并显式标注状态。
- 没有任何可用快照时返回结构化错误，不返回模拟场景。

采集日志不得包含密码或 Token。日志和命令摘要应包含来源、交易日、请求数、成功数、失败数、覆盖率和耗时。

## 10. Flask API

首版提供：

```text
GET /api/capital-flow/snapshot/latest
GET /api/capital-flow/snapshot?trade_date=YYYY-MM-DD
GET /api/capital-flow/status
```

`snapshot/latest` 返回最新可用快照及展开后的项目股票映射。`snapshot` 返回指定交易日快照，不存在时返回 404。`status` 返回数据库可用性、最新可用交易日、快照状态、覆盖率、来源和指标，不访问 JQData。

所有响应使用一致的错误结构。HTTP 非成功状态不能被前端解析为有效场景。

现有 `/api/capital-flow/rank` AkShare 端点退出产品主流程。首版可暂时保留用于开发诊断，但必须明确为实验接口，且不能被 `App` 调用。

## 11. 前端状态与交互

前端数据访问改为异步快照 Provider，不在模块初始化时预取。Provider 返回快照和元数据，而不是把失败折叠为模拟 `MarketScenario`。

页面状态：

- `loading`：正在读取本地快照 API。
- `ready`：完整度达到 90% 或以上。
- `partial`：展示真实数据，同时明确警告覆盖不足。
- `error`：没有可用真实快照。

顶栏显示：

- 数据截至交易日。
- 数据来源 JQData。
- 指标口径 `net_amount_main` / 主力净流入。
- 成功数、目标数和覆盖率。
- `partial` 状态提示。

原“今日 / 5日 / 10日”控件改为快照日期选择。首版至少支持“最新交易日”和 API 已有的历史快照日期。

P3 仅渲染当前快照有真实值的有效股票。P2/P1 使用共享纯函数按主归属聚合。开发用模拟数据只能通过显式开发配置启用，并必须在页面醒目标注“演示数据”；生产默认路径不允许自动降级。

## 12. 测试策略

所有自动测试使用固定 fixture，不访问 JQData 网络。

后端测试：

- A 股代码标准化和市场后缀。
- 占位、非 A 股及不可识别代码过滤。
- 重复证券只采集一次并保留多个展示映射。
- JQData 响应字段转换、空值、`-` 和非数值处理。
- 覆盖率和 `ready` / `partial` / `failed` 判定。
- SQLite 事务提交与失败回滚。
- 失败采集不覆盖最新可用快照。
- Flask 三个端点的成功、404 和无快照错误契约。

前端和领域测试：

- 异步 Provider 对 HTTP 错误、格式错误和 `partial` 元数据的处理。
- P3 只包含有真实值的有效股票。
- 同一证券多处展示但聚合只计算一次。
- P2 主归属求和和 P1 主题求和。
- P1、P2、去重 P3 总额一致。
- 加载、成功、部分覆盖、失败和日期切换 UI。
- 页面准确显示来源、交易日、口径和覆盖率。

手动验收：

1. 使用真实 JQData 账号运行日终采集命令。
2. 检查 SQLite 快照、覆盖率、失败项和聚合校验。
3. 启动 Flask 并验证三个 API。
4. 启动前端，验证 P1/P2/P3、日期和状态标识。
5. 暂时断开数据源，确认页面仍读取旧快照且不出现伪装的模拟值。

## 13. 成功标准

- 有效精选 A 股的真实数据覆盖率至少 90%。
- 页面明确展示数据来源、交易日、指标口径和覆盖率。
- P1 总额、P2 总额和去重后的 P3 总额一致。
- 重复股票不会在聚合中重复计算。
- 缺失值不会被转换成零或模拟值。
- JQData 不可用时，已存在的快照仍可读取；没有快照时显示明确错误。
- 自动测试和构建通过，手动真实链路验收通过。

## 14. 迁移说明

实施时应复用现有领域注册表和渲染组件，但替换以下行为：

- `App` 不再使用 `createAkShareDataProvider()`。
- `buildP3StockRenderNodes()` 不再按子题材总额分配或制造个股数值。
- 前端不再静默回退 `createScenarioDataProvider()`。
- “今日 / 5日 / 10日”不再表达混合来源的周期排名。

现有未提交的 `server/app.py` 诊断改动和 `scripts/diagnose_data.py` 属于工作区既有修改。实施计划应明确决定保留为诊断工具或后续清理，不在本设计文档提交中改动它们。
