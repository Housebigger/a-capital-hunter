import type { RenderNode, StockRenderNode } from "../domain/types";
import type { CapitalFlowOverview } from "../domain/capitalFlowOverview";
import type { SelectionDetail } from "../domain/selectionDetail";

const RELATIONSHIP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "industrial-chain": { label: "产业链", color: "#4a9eff" },
  "market-comovement": { label: "市场共振", color: "#4ecdc4" },
  "heat-correction": { label: "热度修正", color: "#7b8794" },
  "policy-linkage": { label: "政策联动", color: "#ff8c42" },
  "capital-flow": { label: "资金流向", color: "#e64646" },
};

interface InspectorPanelProps {
  node?: RenderNode;
  selectedStockNode?: StockRenderNode;
  overview?: CapitalFlowOverview;
  overviewTitle?: string;
  selection?: SelectionDetail;
  isDemo?: boolean;
}

export function InspectorPanel({ node, selectedStockNode, overview, overviewTitle, selection, isDemo }: InspectorPanelProps) {
  // Live selection detail (takes precedence over all legacy branches)
  if (selection) {
    const fmt = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) / 1e8).toFixed(2)}亿`;
    const label = isDemo ? "模拟净流入" : "主力净流入";
    const color =
      selection.direction === "inflow" ? "#e64646" : selection.direction === "outflow" ? "#3fae6a" : "#9ba8a7";
    const dirText =
      selection.direction === "inflow" ? "流入" : selection.direction === "outflow" ? "流出" : "平盘";
    return (
      <section className="inspector-panel" aria-label="板块详情">
        {selection.parentThemeName && <div className="inspector-kicker">主线：{selection.parentThemeName}</div>}
        <h2>{selection.name}</h2>
        <div className="metric-row"><span>{label}</span><strong style={{ color }}>{fmt(selection.netInflow)}</strong></div>
        <div className="metric-row"><span>状态</span><strong>{dirText}</strong></div>
      </section>
    );
  }

  // Stock-level detail view
  if (selectedStockNode) {
    const { stock, subTheme, theme, metric } = selectedStockNode;
    return (
      <section className="inspector-panel" aria-label="个股详情">
        <div className="inspector-kicker">主线：{theme.name}</div>
        <div className="inspector-kicker">分题材：{subTheme.name}</div>
        <h2>{stock.name}</h2>
        <div className="metric-row">
          <span>代码</span>
          <strong>{stock.code}</strong>
        </div>
        <div className="metric-row">
          <span>{isDemo ? "模拟净流入" : "主力净流入"}</span>
          <strong style={{ color: metric.color }}>{metric.labelValue}</strong>
        </div>
        <div className="metric-row">
          <span>状态</span>
          <strong>
            {metric.direction === "inflow"
              ? "流入"
              : metric.direction === "outflow"
                ? "流出"
                : "平盘"}
          </strong>
        </div>
        <div className="metric-row">
          <span>强度</span>
          <strong>{(metric.intensity * 100).toFixed(0)}%</strong>
        </div>
      </section>
    );
  }

  if (!node) {
    if (overview) {
      const fmt = (v: number) => `${v >= 0 ? "+" : "−"}${(Math.abs(v) / 1e8).toFixed(2)}亿`;
      return (
        <section className="inspector-panel" aria-label="当日概览">
          <h2>{overviewTitle ?? "当日概览"}</h2>
          <div className="metric-row"><span>主力净流入合计</span>
            <strong style={{ color: overview.totalNetInflow >= 0 ? "#e64646" : "#3fae6a" }}>{fmt(overview.totalNetInflow)}</strong></div>
          <h3>净流入 Top</h3>
          <ul className="overview-list">{overview.topInflow.map((e) => (
            <li className="overview-row" key={e.id}>{e.name} <strong style={{ color: "#e64646" }}>{fmt(e.value)}</strong></li>))}</ul>
          <h3>净流出 Top</h3>
          <ul className="overview-list">{overview.topOutflow.map((e) => (
            <li className="overview-row" key={e.id}>{e.name} <strong style={{ color: "#3fae6a" }}>{fmt(e.value)}</strong></li>))}</ul>
        </section>
      );
    }
    return (
      <section className="inspector-panel" aria-label="板块详情">
        <h2>点击地图上的板块查看详情</h2>
        <p>查看该板块的主力净流入、资金方向与产业链/联动关系解释。</p>
      </section>
    );
  }

  // SubTheme area detail when a SubTheme area is focused
  if (node.subTheme) {
    const subTheme = node.subTheme;
    return (
      <section className="inspector-panel" aria-label="板块详情">
        <div className="inspector-kicker">主线：{node.theme.name}</div>
        <div className="inspector-kicker">分题材：{subTheme.name}</div>
        <h2>{node.sector.name}</h2>
        <div className="metric-row">
          <span>{isDemo ? "模拟净流入" : "主力净流入"}</span>
          <strong style={{ color: node.metric.color }}>{node.metric.labelValue}</strong>
        </div>
        <div className="metric-row">
          <span>状态</span>
          <strong>
            {node.metric.direction === "inflow"
              ? "流入"
              : node.metric.direction === "outflow"
                ? "流出"
                : "平盘"}
          </strong>
        </div>
        <div className="metric-row">
          <span>面积权重</span>
          <strong>{subTheme.areaWeight.toFixed(2)}</strong>
        </div>
        <div className="metric-row">
          <span>面积占比</span>
          <strong>{(subTheme.areaWeight * 100).toFixed(1)}%</strong>
        </div>
        <p>{node.sector.relationshipNote}</p>
        <div className="layout-explanation">
          <h3>布局解释</h3>
          <p>{node.layoutExplanation?.summary ?? "当前布局未提供算法解释。"}</p>
          {renderRelationshipReasons(node)}
        </div>
      </section>
    );
  }

  // Fallback: sector-only view (no subTheme)
  return (
    <section className="inspector-panel" aria-label="板块详情">
      <div className="inspector-kicker">主线：{node.theme.name}</div>
      <h2>{node.sector.name}</h2>
      <div className="metric-row">
        <span>{isDemo ? "模拟净流入" : "主力净流入"}</span>
        <strong style={{ color: node.metric.color }}>{node.metric.labelValue}</strong>
      </div>
      <div className="metric-row">
        <span>状态</span>
        <strong>
          {node.metric.direction === "inflow"
            ? "流入"
            : node.metric.direction === "outflow"
              ? "流出"
              : "平盘"}
        </strong>
      </div>
      <p>{node.sector.relationshipNote}</p>
      <div className="layout-explanation">
        <h3>布局解释</h3>
        <p>{node.layoutExplanation?.summary ?? "当前布局未提供算法解释。"}</p>
        {renderRelationshipReasons(node)}
      </div>
    </section>
  );
}

function renderRelationshipReasons(node: RenderNode) {
  const explanationReasons = node.layoutExplanation?.reasons.slice(0, 3) ?? [];
  const groupedReasons = [...explanationReasons].sort((a, b) =>
    a.relationshipType.localeCompare(b.relationshipType)
  );

  if (groupedReasons.length === 0) return null;

  return (
    <ul>
      {groupedReasons.map((reason) => {
        const typeInfo = RELATIONSHIP_TYPE_LABELS[reason.relationshipType] ?? { label: reason.relationshipType, color: "#888" };
        return (
          <li key={`${reason.relatedSectorId}-${reason.note}`}>
            <span className="rel-tag" style={{ color: typeInfo.color }}>
              [{typeInfo.label}]
            </span>{" "}
            <span>{reason.note}</span>
          </li>
        );
      })}
    </ul>
  );
}
