export type ViewMode = "P1" | "P2" | "P3";

const VIEW_OPTIONS: readonly { value: ViewMode; label: string }[] = [
  { value: "P1", label: "P1 主线" },
  { value: "P2", label: "P2 子题材" },
  { value: "P3", label: "P3 个股" },
];

export function ViewModeSelector(props: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="视图层级">
      {VIEW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          className={props.viewMode === value ? "active" : ""}
          aria-pressed={props.viewMode === value}
          onClick={() => props.onViewModeChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
