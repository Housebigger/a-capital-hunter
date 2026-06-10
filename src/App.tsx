import { useMemo, useState } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { HunterScene } from "./components/HunterScene";
import { InspectorPanel } from "./components/InspectorPanel";
import { SceneLegend } from "./components/SceneLegend";
import { layoutStages } from "./domain/layoutStages";
import { createScenarioDataProvider } from "./domain/scenarioDataProvider";
import { themes } from "./domain/themeRegistry";
import { createThemeLayoutProvider } from "./domain/themeVoronoiLayoutProvider";
import { buildThemeRenderNodes } from "./domain/themeRenderNodes";
import { createSubThemeLayoutProvider } from "./domain/voronoiLayoutProvider";
import { buildSubThemeRenderNodes } from "./domain/subThemeRenderNodes";
import { getScenarioIds, useHunterState } from "./state/useHunterState";

const themeLayoutProvider = createThemeLayoutProvider();
const subThemeLayoutProvider = createSubThemeLayoutProvider();
const dataProvider = createScenarioDataProvider();
const scenarios = dataProvider.getScenarios();
const scenarioIds = getScenarioIds(scenarios);

export type ViewMode = "P1" | "P2";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("P1");
  const hunterState = useHunterState(scenarioIds);
  const activeScenario =
    scenarios.find((scenario) => scenario.id === hunterState.activeScenarioId) || scenarios[0];
  const activeScenarioIndex = Math.max(
    0,
    scenarios.findIndex((scenario) => scenario.id === activeScenario.id)
  );
  const activeLayoutStage = layoutStages[activeScenarioIndex] || layoutStages[0];

  // P1: Theme-level layout (11 cells)
  const themeLayout = useMemo(
    () => themeLayoutProvider.getLayout(activeLayoutStage.id),
    [activeLayoutStage.id]
  );
  const themeNodes = useMemo(
    () =>
      buildThemeRenderNodes({
        cells: themeLayout.cells,
        scenario: activeScenario,
        themeFilter: hunterState.themeFilter,
      }),
    [themeLayout, activeScenario, hunterState.themeFilter]
  );

  // P2: SubTheme-level layout (~30 cells)
  const subThemeLayout = useMemo(
    () => subThemeLayoutProvider.getLayout(activeLayoutStage.id),
    [activeLayoutStage.id]
  );
  const subThemeNodes = useMemo(
    () =>
      buildSubThemeRenderNodes({
        voronoiCells: subThemeLayout.cells,
        scenario: activeScenario,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
      }),
    [subThemeLayout, activeScenario, hunterState.themeFilter, hunterState.capitalStateFilter]
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
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <section className="scene-panel" aria-label="A Capital Hunter 3D资金峰面">
          <div className="scene-toolbar">
            <span>二维位置 = 关系</span>
            <span>柱高 = 强度</span>
            <span>时间片 = 轮动</span>
          </div>
          {viewMode === "P1" ? (
            <HunterScene
              themeCells={themeLayout.cells}
              themeNodes={themeNodes}
              cameraPreset={hunterState.cameraPreset}
              selectedSectorId={hunterState.selectedSectorId}
              onSelectSector={hunterState.setSelectedSectorId}
            />
          ) : (
            <HunterScene
              subThemeCells={subThemeLayout.cells}
              subThemeNodes={subThemeNodes}
              cameraPreset={hunterState.cameraPreset}
              selectedSectorId={hunterState.selectedSectorId}
              onSelectSector={hunterState.setSelectedSectorId}
            />
          )}
          <SceneLegend />
        </section>

        <InspectorPanel />
      </section>
    </main>
  );
}
