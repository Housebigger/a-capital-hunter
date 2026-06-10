import type { RenderNode } from "../domain/types";

const RELATIONSHIP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  "industrial-chain": { label: "产业链", color: "#4a9eff" },
  "market-comovement": { label: "市场共振", color: "#4ecdc4" },
  "heat-correction": { label: "热度修正", color: "#7b8794" },
  "policy-linkage": { label: "政策联动", color: "#ff8c42" },
  "capital-flow": { label: "资金流向", color: "#e64646" },
};

interface InspectorPanelProps {
  node?: RenderNode;
}

export function InspectorPanel({ node }: InspectorPanelProps) {
  if (!node) {
    return (
      <section className="inspector-panel" aria-label="板块详情">
        <h2>点击板块查看资金状态</h2>
        <p>第三版展示资金方向、模拟净流入、算法布局解释和分题材信息。</p>
      </section>
    );
  }

  const explanationReasons = node.layoutExplanation?.reasons.slice(0, 3) ?? [];
  const groupedReasons = [...explanationReasons].sort((a, b) =>
    a.relationshipType.localeCompare(b.relationshipType)
  );

  return (
    <section className="inspector-panel" aria-label="板块详情">
      <div className="inspector-kicker">主线：{node.theme.name}</div>
      {node.subTheme && (
        <div className="inspector-kicker">分题材：{node.subTheme.name}</div>
      )}
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
            {groupedReasons.map((reason) => {
              const typeInfo = RELATIONSHIP_TYPE_LABELS[reason.relationshipType] ?? { label: reason.relationshipType, color: "#888" };
              return (
                <li key={`${reason.relatedSectorId}-${reason.note}`}>
                  <span style={{ color: typeInfo.color, fontSize: "11px", fontWeight: 600 }}>
                    [{typeInfo.label}]
                  </span>{" "}
                  <span>{reason.note}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
