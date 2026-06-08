import { useMemo } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { HunterScene } from "./components/HunterScene";
import { InspectorPanel } from "./components/InspectorPanel";
import { SceneLegend } from "./components/SceneLegend";
import { createManualLayoutProvider } from "./domain/layoutProvider";
import { buildRenderNodes } from "./domain/renderNodes";
import { createMockScenarioDataProvider } from "./domain/scenarioDataProvider";
import { themes } from "./domain/themeRegistry";
import { getScenarioIds, useHunterState } from "./state/useHunterState";

const layoutProvider = createManualLayoutProvider();
const dataProvider = createMockScenarioDataProvider();
const scenarios = dataProvider.getScenarios();
const scenarioIds = getScenarioIds(scenarios);

export default function App() {
  const hunterState = useHunterState(scenarioIds);
  const activeScenario =
    scenarios.find((scenario) => scenario.id === hunterState.activeScenarioId) || scenarios[0];

  const nodes = useMemo(
    () =>
      buildRenderNodes({
        layout: layoutProvider.getLayout(),
        scenario: activeScenario,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
        showCentersOnly: hunterState.showCentersOnly
      }),
    [
      activeScenario,
      hunterState.capitalStateFilter,
      hunterState.showCentersOnly,
      hunterState.themeFilter
    ]
  );

  const selectedNode = nodes.find((node) => node.sector.id === hunterState.selectedSectorId);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">A股主力资金动向捕捉神器</p>
          <h1>A Capital Hunter</h1>
        </div>
        <div className="scenario-story" aria-live="polite">
          <span>{activeScenario.label}</span>
          <p>{activeScenario.story}</p>
        </div>
      </header>

      <section className="workspace">
        <ControlsPanel
          scenarios={scenarios}
          themes={themes}
          activeScenarioId={hunterState.activeScenarioId}
          themeFilter={hunterState.themeFilter}
          capitalStateFilter={hunterState.capitalStateFilter}
          cameraPreset={hunterState.cameraPreset}
          showCentersOnly={hunterState.showCentersOnly}
          onScenarioChange={hunterState.setActiveScenarioId}
          onThemeFilterChange={hunterState.setThemeFilter}
          onCapitalStateFilterChange={hunterState.setCapitalStateFilter}
          onCameraPresetChange={hunterState.setCameraPreset}
          onShowCentersOnlyChange={hunterState.setShowCentersOnly}
        />

        <section className="scene-panel" aria-label="A Capital Hunter 3D资金峰面">
          <div className="scene-toolbar">
            <span>二维位置 = 关系</span>
            <span>柱高 = 强度</span>
            <span>时间片 = 轮动</span>
          </div>
          <HunterScene
            nodes={nodes}
            cameraPreset={hunterState.cameraPreset}
            selectedSectorId={hunterState.selectedSectorId}
            onSelectSector={hunterState.setSelectedSectorId}
          />
          <SceneLegend />
        </section>

        <InspectorPanel node={selectedNode} />
      </section>
    </main>
  );
}
