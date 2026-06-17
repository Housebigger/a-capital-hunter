import { Activity, Eye, Filter, Layers3, Rotate3D } from "lucide-react";
import type {
  CameraPreset,
  CapitalStateFilter,
  Theme,
  ThemeFilter
} from "../domain/types";

interface ControlsPanelProps {
  themes: readonly Theme[];
  /** Active snapshot trade date (YYYY-MM-DD). */
  activeTradeDate: string;
  /** Trade dates the backend has snapshots for (descending). */
  availableTradeDates: readonly string[];
  onTradeDateChange: (tradeDate: string) => void;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  cameraPreset: CameraPreset;
  viewMode: "P1" | "P2" | "P3";
  onViewModeChange: (mode: "P1" | "P2" | "P3") => void;
  onThemeFilterChange: (themeFilter: ThemeFilter) => void;
  onCapitalStateFilterChange: (filter: CapitalStateFilter) => void;
  onCameraPresetChange: (preset: CameraPreset) => void;
}

const CAMERA_PRESET_OPTIONS: readonly { value: CameraPreset; label: string }[] = [
  { value: "angled", label: "斜视" },
  { value: "top", label: "俯视" },
  { value: "side", label: "侧视" }
];

export function ControlsPanel(props: ControlsPanelProps) {
  return (
    <aside className="controls-panel" aria-label="A Capital Hunter 控制面板">
      <section className="control-section">
        <div className="section-title">
          <Activity size={16} aria-hidden="true" />
          <span>资金流快照</span>
        </div>
        <label>
          <span>资金流快照日期</span>
          <select
            aria-label="资金流快照日期"
            value={props.activeTradeDate}
            onChange={(event) => props.onTradeDateChange(event.target.value)}
          >
            {props.availableTradeDates.length === 0 ? (
              <option value={props.activeTradeDate}>{props.activeTradeDate || "暂无快照"}</option>
            ) : (
              props.availableTradeDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))
            )}
          </select>
        </label>
      </section>

      <section className="control-section">
        <div className="section-title">
          <Layers3 size={16} aria-hidden="true" />
          <span>视图层级</span>
        </div>
        <div className="segmented" role="group" aria-label="视图层级">
          <button
            type="button"
            className={props.viewMode === "P1" ? "active" : ""}
            aria-pressed={props.viewMode === "P1"}
            onClick={() => props.onViewModeChange("P1")}
          >
            P1 主线
          </button>
          <button
            type="button"
            className={props.viewMode === "P2" ? "active" : ""}
            aria-pressed={props.viewMode === "P2"}
            onClick={() => props.onViewModeChange("P2")}
          >
            P2 子题材
          </button>
          <button
            type="button"
            className={props.viewMode === "P3" ? "active" : ""}
            aria-pressed={props.viewMode === "P3"}
            onClick={() => props.onViewModeChange("P3")}
          >
            P3 个股
          </button>
        </div>
      </section>

      <section className="control-section">
        <div className="section-title">
          <Filter size={16} aria-hidden="true" />
          <span>筛选</span>
        </div>
        <label>
          <span>主题筛选</span>
          <select
            aria-label="主题筛选"
            value={props.themeFilter}
            onChange={(event) => props.onThemeFilterChange(event.target.value as ThemeFilter)}
          >
            <option value="all">全部主线</option>
            {props.themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>资金状态</span>
          <select
            aria-label="资金状态"
            value={props.capitalStateFilter}
            onChange={(event) =>
              props.onCapitalStateFilterChange(event.target.value as CapitalStateFilter)
            }
          >
            <option value="all">全部状态</option>
            <option value="inflow">只看流入</option>
            <option value="outflow">只看流出</option>
            <option value="flat">只看平盘</option>
          </select>
        </label>
      </section>

      <section className="control-section">
        <div className="section-title">
          <Rotate3D size={16} aria-hidden="true" />
          <span>视角</span>
        </div>
        <div className="segmented" role="group" aria-label="视角预设">
          {CAMERA_PRESET_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={props.cameraPreset === value ? "active" : ""}
              aria-pressed={props.cameraPreset === value}
              onClick={() => props.onCameraPresetChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-section compact-note">
        <div className="section-title">
          <Layers3 size={16} aria-hidden="true" />
          <span>读图规则</span>
        </div>
        <p>二维位置表达关系，柱高表达资金强度，红色为流入，绿色为流出。点击分题材区域展开详细标签。</p>
        <div className="section-title">
          <Eye size={16} aria-hidden="true" />
          <span>第三版策略</span>
        </div>
        <p>第三版：11个主题、~80个板块、5种关系类型、国家地图底座。</p>
      </section>
    </aside>
  );
}
