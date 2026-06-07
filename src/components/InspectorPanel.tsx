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
      <div className="inspector-kicker">主线：{node.theme.name}</div>
      <h2>{node.sector.name}</h2>
      <div className="metric-row">
        <span>模拟净流入</span>
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
    </section>
  );
}
