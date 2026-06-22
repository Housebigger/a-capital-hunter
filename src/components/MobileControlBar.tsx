import { WindowSelector } from "./WindowSelector";
import { ViewModeSelector, type ViewMode } from "./ViewModeSelector";
import type { CapitalFlowWindowKey } from "../data/capitalFlowDataProvider";

/**
 * Sticky primary-control bar shown only in compact (≤900px) layout — keeps the
 * high-frequency time-window + view-mode controls one tap away above the map.
 */
export function MobileControlBar(props: {
  activeWindow: CapitalFlowWindowKey;
  onWindowChange: (window: CapitalFlowWindowKey) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="mobile-control-bar" role="group" aria-label="移动端主控件">
      <WindowSelector activeWindow={props.activeWindow} onWindowChange={props.onWindowChange} />
      <ViewModeSelector viewMode={props.viewMode} onViewModeChange={props.onViewModeChange} />
    </div>
  );
}
