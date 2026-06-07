import { Activity, Eye, Filter, Layers3, Rotate3D } from "lucide-react";
import type {
  CameraPreset,
  CapitalStateFilter,
  MarketScenario,
  Theme,
  ThemeFilter
} from "../domain/types";

interface ControlsPanelProps {
  scenarios: readonly MarketScenario[];
  themes: readonly Theme[];
  activeScenarioId: string;
  themeFilter: ThemeFilter;
  capitalStateFilter: CapitalStateFilter;
  cameraPreset: CameraPreset;
  showCentersOnly: boolean;
  onScenarioChange: (scenarioId: string) => void;
  onThemeFilterChange: (themeFilter: ThemeFilter) => void;
  onCapitalStateFilterChange: (filter: CapitalStateFilter) => void;
  onCameraPresetChange: (preset: CameraPreset) => void;
  onShowCentersOnlyChange: (show: boolean) => void;
}

export function ControlsPanel(props: ControlsPanelProps) {
  return (
    <aside className="controls-panel" aria-label="A Capital Hunter 控制面板">
      <section className="control-section">
        <div className="section-title">
          <Activity size={16} aria-hidden="true" />
          <span>资金轮动时间片</span>
        </div>
        <div className="timeline-buttons" role="group" aria-label="时间片">
          {props.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              className={scenario.id === props.activeScenarioId ? "active" : ""}
              type="button"
              onClick={() => props.onScenarioChange(scenario.id)}
            >
              {scenario.label}
            </button>
          ))}
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
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={props.showCentersOnly}
            onChange={(event) => props.onShowCentersOnlyChange(event.target.checked)}
          />
          <span>只看主线中心</span>
        </label>
      </section>

      <section className="control-section">
        <div className="section-title">
          <Rotate3D size={16} aria-hidden="true" />
          <span>视角</span>
        </div>
        <div className="segmented" role="group" aria-label="视角预设">
          {[
            ["angled", "斜视"],
            ["top", "俯视"],
            ["side", "侧视"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={props.cameraPreset === value ? "active" : ""}
              onClick={() => props.onCameraPresetChange(value as CameraPreset)}
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
        <p>二维位置表达关系，柱高表达资金强度，红色为流入，绿色为流出。</p>
        <div className="section-title">
          <Eye size={16} aria-hidden="true" />
          <span>第一版策略</span>
        </div>
        <p>使用模拟时间片和手工布局，接口保留给真实数据源和算法布局。</p>
      </section>
    </aside>
  );
}
