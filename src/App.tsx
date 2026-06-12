import { useMemo, useState, useCallback } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { HunterScene } from "./components/HunterScene";
import { InspectorPanel } from "./components/InspectorPanel";
import { SceneLegend } from "./components/SceneLegend";
import { layoutStages } from "./domain/layoutStages";
import { createAkShareDataProvider, PERIOD_OPTIONS, type PeriodIndicator } from "./data/akShareDataProvider";
import { themes } from "./domain/themeRegistry";
import { createThemeLayoutProvider } from "./domain/themeVoronoiLayoutProvider";
import { buildThemeRenderNodes } from "./domain/themeRenderNodes";
import { createSubThemeLayoutProvider } from "./domain/voronoiLayoutProvider";
import { buildSubThemeRenderNodes } from "./domain/subThemeRenderNodes";
import { buildP3StockRenderNodes } from "./domain/stockRenderNodes";
import { useHunterState } from "./state/useHunterState";
import type { MarketScenario } from "./domain/types";

const themeLayoutProvider = createThemeLayoutProvider();
const subThemeLayoutProvider = createSubThemeLayoutProvider();
const dataProvider = createAkShareDataProvider();

export type ViewMode = "P1" | "P2" | "P3";

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("P1");
  const [activePeriod, setActivePeriod] = useState<PeriodIndicator>("今日");
  const [activeScenario, setActiveScenario] = useState<MarketScenario>(
    () => dataProvider.getCachedPeriod("今日") ?? dataProvider.getScenarios()[0]
  );
  const hunterState = useHunterState();

  // Always use first layout stage — layout doesn't change per period
  const activeLayoutStage = layoutStages[0];

  // Fetch data when period changes
  const handlePeriodChange = useCallback(
    async (indicator: string) => {
      const period = indicator as PeriodIndicator;
      setActivePeriod(period);
      const scenario = await dataProvider.fetchPeriod(period);
      setActiveScenario(scenario);
    },
    []
  );

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

  // P2: SubTheme-level layout (~30 cells, constrained to theme polygons)
  const subThemeLayout = useMemo(
    () => subThemeLayoutProvider.getLayout(activeLayoutStage.id, themeLayout.cells),
    [activeLayoutStage.id, themeLayout]
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

  // P3: Individual stock level (3-8 stocks per SubTheme)
  const stockNodes3 = useMemo(
    () =>
      viewMode === "P3"
        ? buildP3StockRenderNodes({
            voronoiCells: subThemeLayout.cells,
            scenario: activeScenario,
            themeFilter: hunterState.themeFilter,
            capitalStateFilter: hunterState.capitalStateFilter,
          })
        : [],
    [viewMode, subThemeLayout, activeScenario, hunterState.themeFilter, hunterState.capitalStateFilter]
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
          themes={themes}
          activePeriod={activePeriod}
          onPeriodChange={handlePeriodChange}
          themeFilter={hunterState.themeFilter}
          capitalStateFilter={hunterState.capitalStateFilter}
          cameraPreset={hunterState.cameraPreset}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onThemeFilterChange={hunterState.setThemeFilter}
          onCapitalStateFilterChange={hunterState.setCapitalStateFilter}
          onCameraPresetChange={hunterState.setCameraPreset}
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
              themeCells={themeLayout.cells}
              subThemeCells={subThemeLayout.cells}
              subThemeNodes={subThemeNodes}
              stockNodes3={viewMode === "P3" ? stockNodes3 : undefined}
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
