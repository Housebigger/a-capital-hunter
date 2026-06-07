export function SceneLegend() {
  return (
    <div className="scene-legend" aria-label="图例">
      <span>
        <i className="legend-dot inflow" />
        资金流入
      </span>
      <span>
        <i className="legend-dot outflow" />
        资金流出
      </span>
      <span>
        <i className="legend-dot flat" />
        弱/平
      </span>
    </div>
  );
}
