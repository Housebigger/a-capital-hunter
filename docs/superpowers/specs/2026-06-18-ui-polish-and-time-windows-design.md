# UI 优化 + 资金流时间窗口 — 设计 Spec

> 日期：2026-06-18
> 状态：待用户评审
> 范围：P0–P5(两个确定 bug + 四组 UI 优化 + 一个时间档位新功能)

## 背景

真实资金流管线已接通,P3 个股峰面可渲染(2026-06-17,覆盖 167/168)。一次界面走查发现两个确定 bug 与若干优化点;同时用户要求把单日快照扩展为「今日 / 近5 / 近10 / 近20 日」四个时间档位。本 spec 汇总 P0–P5,作为后续实现计划的依据。

## 目标与范围

| 编号 | 项 | 类型 | 依据 |
|---|---|---|---|
| P0 | header 写死「JQData」,真实源是 Tushare | 确定 bug(诚实红线) | `App.tsx:222` |
| P1 | 顶部工具栏与覆盖条重叠成「乱码」 | 确定 bug(布局) | `App.css:194` vs `:403` |
| P5 | 资金流时间档位:今日/近5/近10/近20日 | 新功能(前后端) | 用户需求 |
| P2b | 右侧 Inspector 未选中时几乎空白 | UX | 走查 |
| P4 | 左栏说明可折叠 + 图例加「红=流入」注 | UX | 走查 |
| P3b | P3 个股标签过小/过暗,斜视难读 | 视觉 | 走查 |
| P3a | 主题底色过饱和,与红绿语义色争注意力 | 视觉调参 | 走查 |
| P2a | 3D 场景上方留白、峰面偏下且底部贴边 | 视觉调参 | 走查 |

### 非目标(YAGNI)

- 不做按任意历史日期浏览(档位锚点固定为最新交易日;历史锚点若需另开功能)。
- 不引入新的图表库或重写 3D 渲染管线。
- 不动合法的 JQData 适配器 / 源选择工厂(JQData 仍是合法备选源)。

## 实现分期(建议构建顺序)

- **Phase 1 — 修 bug(快、低风险)**:P0、P1。
- **Phase 2 — 时间档位功能**:P5(后端回补 + 窗口读取 + 前端档位选择器)。
- **Phase 3 — UX/视觉打磨**:P2b、P4、P3b、P3a、P2a。

---

## Phase 1:确定 bug

### P0 — header 源标识动态化(诚实红线)

- 现状:`App.tsx:222` 硬编码 `JQData 主力净流入`;`DataStatus.tsx:57` 已动态(`source === "tushare" ? "Tushare" : "JQData"`)。两处不一致,同屏自相矛盾。
- 方案:抽公共工具 `sourceLabel(source: string): string`(`tushare`→`Tushare`、`jqdata`→`JQData`、其它→原样回显),供 header 与 DataStatus **共用**,根治漂移。
- header 文案改为动态源标签(并与 P5 的档位标签拼接,见 P5)。
- 测试:`sourceLabel` 单测;App header 渲染断言显示真实源。

### P1 — 顶部工具栏 / 覆盖条重叠

- 现状:`.scene-toolbar` 为 `position:absolute; top-left`(浮层),`DataStatus` 为普通文档流首块,二者在场景顶部重叠,半透明 chip 透出底层文字成乱码。
- 方案:`ready/partial` 态的 DataStatus 改为**右上角浮层**(`position:absolute; top:14px; right:14px`),与左上 `scene-toolbar` 分居两侧、互不重叠,且不再占用 canvas 垂直高度(顺带利好 P2a)。
- `error` / `demo` 态维持现状:`error` 无场景,不存在重叠;`demo` 仍用醒目提示。
- 测试:组件测试断言 ready 态 DataStatus 带浮层定位类名;无重叠回归。

---

## Phase 2:P5 — 资金流时间档位

### 档位集合

四档(用户确认):`今日 (1d)` / `近5日 (5d)` / `近10日 (10d)` / `近20日 (20d)`。`今日` = `window=1d` = 现有单日语义(向后兼容)。

### 数据语义

「近 N 日主力净流入」= 以最新交易日为锚点,向前取 N 个交易日,对每只个股的单日 `net_amount_main`(CNY)**累加求和**。P1/P2/P3 聚合与「P1==P2==unique-P3」不变量在累加后的快照上原样成立。

### 2.1 历史回补(后端)

- 不改表结构:每个交易日仍是一条普通快照(沿用 `repository.save_snapshot`)。
- 新增批量回补 CLI:`python3 -m server.capital_flow.sync --backfill 20`,回补最近 20 个交易日的日快照。
- 交易日枚举:从 `source.latest_trade_date()` 向回逐日用 `source.is_trade_date()` 判定,凑满 N 个交易日(或为数据源新增轻量 `trading_days(end, count)` 辅助;实现计划阶段定)。
- 幂等:已存在的交易日默认**覆盖重写**(沿用 `save_snapshot` 的原子 delete-and-replace),回补可安全重跑。
- 成本:一次性 ~20 天 × ~168 只的 Tushare 调用(消耗积分);用户已接受。

### 2.2 窗口读取(后端)

- 新增查询参数:`GET /api/capital-flow/snapshot/latest?window=1d|5d|10d|20d`(缺省 `1d`,向后兼容)。
- 行为:以最新交易日为锚点,取最近 N 个交易日的日快照,按 `stockId` 累加 `netAmountMain`,产出**标准 `CapitalFlowSnapshot`**(points 的值为 N 日累计)。
- 累加在 repository/service 层完成,复用现有展开逻辑;窗口聚合作为一个独立、可单测的纯函数。

### 2.3 契约扩展(诚实 / 覆盖)

- 快照新增顶层字段 `window`:
  ```
  window: {
    days: number          // 请求的窗口交易日数 (1/5/10/20)
    label: string         // "今日" | "近5日" | "近10日" | "近20日"
    from: string          // 实际累加到的最早交易日 YYYY-MM-DD
    to: string            // 锚点(最新)交易日 YYYY-MM-DD
    availableDays: number // 实际累加到的交易日数(可能 < days)
  }
  ```
- 若库内不足 N 天,累加已有的 `availableDays` 天(`from` 为其中最早一天),前端显式标注「近20日 · 仅 M 日可用」。符合诚实红线。
- **`window` 为必填,且所有快照端点统一返回**:`latest` 缺省与按日期端点(`/snapshot?trade_date=`)均返回 `days=1` 的窗口。这样严格校验器对每个响应一致,不会出现「某端点缺字段被拒」(避免重蹈 `tradeDate` 覆辙)。
- `capitalFlowSnapshot.ts`:`CapitalFlowSnapshot` 增加必填 `window` 字段;`parseSnapshot` 增加对应校验(`days`/`availableDays` 为有限数、`label`/`from`/`to` 为非空串)。
- 同步更新金标准 fixture(`scripts/dump_snapshot_fixture.py` 产出含 `window`)与前端契约测试。

### 2.4 前端

- `ControlsPanel`:把现有「资金流快照日期」下拉**换成 4 按钮分段选择器**(今日/近5/近10/近20日),样式复用 P1/P2/P3 分段控件。
- Provider:`fetchLatest(window?: WindowKey)` 传 `?window=`;`WindowKey = "1d"|"5d"|"10d"|"20d"`。
- `App.tsx`:维护 `activeWindow` 状态,切换档位时重新拉取;锚点固定最新交易日。
- header / DataStatus:展示「{源} {档位}主力净流入 · {from~to}」,不足天数时附「仅 M 日可用」。

### 2.5 测试(全程 TDD)

- 后端:窗口累加纯函数(满 N / 不足 M / 某股仅部分天有数据 / 跨锚点对齐);API `window` 参数(合法值、非法值 400、缺省 1d);回补 CLI(枚举交易日、幂等)。
- 前端:`parseSnapshot` 的 `window` 字段契约测试(含金标准 fixture);档位选择器交互测试;header 档位+源标签渲染。

---

## Phase 3:UX / 视觉打磨

### P2b — Inspector 未选中时的当日概览

- 现状:`InspectorPanel` 未选中时仅静态文案,大片留白。
- 方案:未选中时展示**当日概览**,数据复用 `App.tsx` 已构建的 `aggregates`(`byTheme`/`bySubTheme`):
  - 当前视图层级对应维度的 **Top 5 净流入** 与 **Top 5 净流出**(P1→主题,P2/P3→子题材);
  - 全市场主力净流入合计;
  - 数据状态/覆盖(ready/partial、覆盖率、窗口档位)。
- `InspectorPanel` 接收 `aggregates` + `viewMode` + `window` props(当前为静态组件,需加 props)。
- 测试:给定 aggregates,断言 Top5 排序与合计正确渲染。

### P4 — 左栏说明折叠 + 图例注释

- 左栏「读图规则」「第三版策略」改为可折叠区块,默认收起。
- 底部图例加一句「红=流入(A股习惯)」,避免按西方红绿习惯误读(方向本身正确,保留)。
- 测试:折叠交互;图例文案存在。

### P3b — P3 个股标签可读性

- 现状:斜视下个股名过小/过暗,几乎不可读。
- 方案:每个子题材单元只渲染按 |净额| 排序的 **Top-N 个股标签**(默认 N≈3,浏览器调);其余在悬停/选中时显示;标签加描边/提高对比。涉及 `CapitalMapScene` 的 drei `Text`。
- 验证:需在浏览器实测可读性(视觉调参,非精确 spec)。

### P3a — 主题底色去饱和(视觉调参)

- 现状:Voronoi 分块底色高饱和,与红绿资金柱争夺注意力。
- 方案:降低主题填充的饱和度/不透明度(具体数值在浏览器迭代),使红绿柱成为主信号;主题靠色相区分即可。
- 验证:浏览器实测,确保红绿柱为视觉重点。

### P2a — 3D 场景默认取景(视觉调参)

- 现状:斜视角把峰面压到下半屏,顶部约 40% 留白,底部分块贴边。
- 方案:调整 `CapitalMapScene` 各相机 preset 的 `position/target/fov`,使峰面垂直居中、四周留白均匀。
- 验证:浏览器实测各 preset(斜视/俯视/侧视)。

---

## 风险与备注

- **Tushare 积分**:一次性回补 ~20 个交易日会消耗积分;若部分历史日数据缺失,以 `availableDays` 诚实降级。
- **视觉调参项(P2a/P3a/P3b)** 无法仅靠单测验收,需用户在浏览器确认手感;实现计划中标注为「需浏览器验证」。
- **契约变更(window 字段)** 触及严格校验器:务必同步金标准 fixture + 前后端契约测试,沿用上次「真实形状过 parseSnapshot」的防漂移做法。
- **诚实红线**:P0 与 P5 的覆盖标注都服务于「只展示真实来源/真实覆盖」这一核心原则。
