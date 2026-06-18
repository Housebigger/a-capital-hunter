/**
 * DataStatus — honest indicator of where the map's numbers come from.
 *
 * Four display modes, mutually exclusive:
 *   • ready / partial: render real JQData source, trade date, metric, coverage.
 *     partial additionally warns that some stocks are missing.
 *   • demo:           simulated data is being shown because the user chose to
 *                     load demo data — labeled explicitly, never silent.
 *   • error:          no usable snapshot; show an alert with retry + demo
 *                     buttons so the user decides what happens next.
 */

import type { CapitalFlowSnapshot } from "../data/capitalFlowSnapshot";
import { sourceLabel } from "../data/sourceLabel";

interface DataStatusProps {
  readonly snapshot: CapitalFlowSnapshot | null;
  readonly isDemo: boolean;
  readonly onRetry: () => void;
  readonly onLoadDemo: () => void;
}

function coveragePercent(succeeded: number, requested: number): string {
  if (!requested) return "0.0%";
  return `${((succeeded / requested) * 100).toFixed(1)}%`;
}

export function DataStatus({ snapshot, isDemo, onRetry, onLoadDemo }: DataStatusProps) {
  // --- Demo mode ---
  if (isDemo && !snapshot) {
    return (
      <div className="data-status demo" role="status">
        <span>演示数据 · 非真实资金流</span>
      </div>
    );
  }

  // --- Hard error: no snapshot at all ---
  if (!snapshot) {
    return (
      <div className="data-error" role="alert">
        <span>没有可用的真实资金流快照</span>
        <div className="data-error-actions">
          <button type="button" onClick={onRetry}>
            重试
          </button>
          <button type="button" onClick={onLoadDemo}>
            加载演示数据
          </button>
        </div>
      </div>
    );
  }

  // --- Ready / partial: show provenance + coverage ---
  const isPartial = snapshot.status === "partial";
  const coverage = snapshot.coverage;
  const sourceText = sourceLabel(snapshot.source);

  return (
    <div className={`data-status${isPartial ? " partial" : ""}`} role="status">
      <span>数据截至 {snapshot.tradeDate}</span>
      <span>
        {sourceText} · 主力净流入 · 单位 {snapshot.unit}
      </span>
      <span>
        覆盖 {coverage.succeeded} / {coverage.requested}（{coveragePercent(coverage.succeeded, coverage.requested)}）
      </span>
      {isPartial && <span className="partial-warning">部分股票缺少真实数据</span>}
    </div>
  );
}
