import { useMemo } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { HunterScene } from "./components/HunterScene";
import { InspectorPanel } from "./components/InspectorPanel";
import { SceneLegend } from "./components/SceneLegend";
import { layoutStages } from "./domain/layoutStages";
import { buildRenderNodes, buildStockRenderNodes } from "./domain/renderNodes";
import { createScenarioDataProvider } from "./domain/scenarioDataProvider";
import { themes } from "./domain/themeRegistry";
import { createVoronoiLayoutProvider } from "./domain/voronoiLayoutProvider";
import type { StockRenderNode } from "./domain/types";
import { getScenarioIds, useHunterState } from "./state/useHunterState";

const voronoiLayoutProvider = createVoronoiLayoutProvider();
const dataProvider = createScenarioDataProvider();
const scenarios = dataProvider.getScenarios();
const scenarioIds = getScenarioIds(scenarios);

export default function App() {
  const hunterState = useHunterState(scenarioIds);
  const activeScenario =
    scenarios.find((scenario) => scenario.id === hunterState.activeScenarioId) || scenarios[0];
  const activeScenarioIndex = Math.max(
    0,
    scenarios.findIndex((scenario) => scenario.id === activeScenario.id)
  );
  const activeLayoutStage = layoutStages[activeScenarioIndex] || layoutStages[0];

  const voronoiLayout = useMemo(
    () => voronoiLayoutProvider.getLayout(activeLayoutStage.id),
    [activeLayoutStage.id]
  );

  const stockNodes = useMemo(
    () =>
      buildStockRenderNodes({
        layout: voronoiLayout,
        scenario: activeScenario,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
        capitalThreshold: hunterState.capitalThreshold
      }),
    [
      voronoiLayout,
      activeScenario,
      hunterState.capitalStateFilter,
      hunterState.capitalThreshold,
      hunterState.themeFilter
    ]
  );

  const selectedStockNode: StockRenderNode | undefined = useMemo(
    () => (hunterState.selectedStockId ? stockNodes.find((n) => n.stock.id === hunterState.selectedStockId) : undefined),
    [hunterState.selectedStockId, stockNodes]
  );

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
          capitalThreshold={hunterState.capitalThreshold}
          onScenarioChange={hunterState.setActiveScenarioId}
          onThemeFilterChange={hunterState.setThemeFilter}
          onCapitalStateFilterChange={hunterState.setCapitalStateFilter}
          onCameraPresetChange={hunterState.setCameraPreset}
          onShowCentersOnlyChange={hunterState.setShowCentersOnly}
          onCapitalThresholdChange={hunterState.setCapitalThreshold}
        />

        <section className="scene-panel" aria-label="A Capital Hunter 3D资金峰面">
          <div className="scene-toolbar">
            <span>二维位置 = 关系</span>
            <span>柱高 = 强度</span>
            <span>时间片 = 轮动</span>
          </div>
          <HunterScene
            voronoiLayout={voronoiLayout}
            stockNodes={stockNodes}
            cameraPreset={hunterState.cameraPreset}
            selectedSectorId={hunterState.selectedSectorId}
            focusSubThemeId={hunterState.focusSubThemeId}
            onSelectSector={hunterState.setSelectedSectorId}
            onFocusSubTheme={hunterState.setFocusSubThemeId}
          />
          <SceneLegend />
        </section>

        <InspectorPanel selectedStockNode={selectedStockNode} />
      </section>
    </main>
  );
}
