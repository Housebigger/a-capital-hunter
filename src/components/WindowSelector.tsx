import type { CapitalFlowWindowKey } from "../data/capitalFlowDataProvider";

export const WINDOW_OPTIONS: readonly { value: CapitalFlowWindowKey; label: string }[] = [
  { value: "1d", label: "今日" },
  { value: "5d", label: "近5日" },
  { value: "10d", label: "近10日" },
  { value: "20d", label: "近20日" },
];

export function WindowSelector(props: {
  activeWindow: CapitalFlowWindowKey;
  onWindowChange: (window: CapitalFlowWindowKey) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="时间档位">
      {WINDOW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={props.activeWindow === value ? "active" : ""}
          aria-pressed={props.activeWindow === value}
          onClick={() => props.onWindowChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
