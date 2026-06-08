import type { RenderNode } from "../domain/types";

interface InspectorPanelProps {
  node?: RenderNode;
}

export function InspectorPanel({ node }: InspectorPanelProps) {
  if (!node) {
    return (
      <section className="inspector-panel" aria-label="板块详情">
        <h2>点击板块查看资金状态</h2>
        <p>第二版展示资金方向、模拟净流入和算法布局解释。</p>
      </section>
    );
  }

  const explanationReasons = node.layoutExplanation?.reasons.slice(0, 3) ?? [];

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
      <div className="layout-explanation">
        <h3>布局解释</h3>
        <p>{node.layoutExplanation?.summary ?? "当前布局未提供算法解释。"}</p>
        {explanationReasons.length > 0 && (
          <ul>
            {explanationReasons.map((reason) => (
              <li key={`${reason.relatedSectorId}-${reason.note}`}>
                <span>{reason.note}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
