import { useMemo, useState, useCallback, useEffect } from "react";
import { ControlsPanel } from "./components/ControlsPanel";
import { HunterScene } from "./components/HunterScene";
import { InspectorPanel } from "./components/InspectorPanel";
import { SceneLegend } from "./components/SceneLegend";
import { DataStatus } from "./components/DataStatus";
import { layoutStages } from "./domain/layoutStages";
import { createCapitalFlowDataProvider, type CapitalFlowDataProvider, type CapitalFlowWindowKey } from "./data/capitalFlowDataProvider";
import type { CapitalFlowSnapshot } from "./data/capitalFlowSnapshot";
import { createScenarioDataProvider } from "./domain/scenarioDataProvider";
import { themes } from "./domain/themeRegistry";
import { createThemeLayoutProvider } from "./domain/themeVoronoiLayoutProvider";
import { buildThemeRenderNodes } from "./domain/themeRenderNodes";
import { createSubThemeLayoutProvider } from "./domain/voronoiLayoutProvider";
import { buildSubThemeRenderNodes } from "./domain/subThemeRenderNodes";
import { buildP3StockRenderNodes } from "./domain/stockRenderNodes";
import { buildCapitalFlowAggregates } from "./domain/capitalFlowAggregation";
import { buildOverview } from "./domain/capitalFlowOverview";
import { subThemes } from "./domain/subThemeRegistry";
import { useHunterState } from "./state/useHunterState";
import type { MarketScenario } from "./domain/types";
import { sourceLabel } from "./data/sourceLabel";

const themeLayoutProvider = createThemeLayoutProvider();
const subThemeLayoutProvider = createSubThemeLayoutProvider();
const FALLBACK_PROVIDER = createScenarioDataProvider();
// Default real provider lives at module scope so it has a stable identity
// across renders (avoids a useEffect re-run loop). Tests inject their own.
const DEFAULT_DATA_PROVIDER = createCapitalFlowDataProvider();

export type ViewMode = "P1" | "P2" | "P3";

type SnapshotViewState =
  | { status: "loading"; previous?: CapitalFlowSnapshot }
  | { status: "ready"; snapshot: CapitalFlowSnapshot }
  | { status: "partial"; snapshot: CapitalFlowSnapshot }
  | { status: "error"; message: string }
  | { status: "demo"; scenario: MarketScenario };

export interface AppProps {
  /** Inject a provider (tests). Defaults to the real capital-flow snapshot provider. */
  readonly provider?: CapitalFlowDataProvider;
}

export default function App({ provider }: AppProps = {}) {
  const dataProvider = provider ?? DEFAULT_DATA_PROVIDER;

  const [viewState, setViewState] = useState<SnapshotViewState>({ status: "loading" });
  const [viewMode, setViewMode] = useState<ViewMode>("P1");
  const [activeWindow, setActiveWindow] = useState<CapitalFlowWindowKey>("1d");
  const hunterState = useHunterState();

  // Always use first layout stage — layout is static relative to data.
  const activeLayoutStage = layoutStages[0];

  // ---- Initial load: status + latest snapshot ----
  const loadInitial = useCallback(async () => {
    setViewState((prev) =>
      prev.status === "ready" || prev.status === "partial"
        ? { status: "loading", previous: prev.snapshot }
        : { status: "loading" }
    );
    try {
      const snapshot = await dataProvider.fetchLatest(activeWindow);
      setViewState(
        snapshot.status === "partial"
          ? { status: "partial", snapshot }
          : { status: "ready", snapshot }
      );
    } catch (err) {
      setViewState({
        status: "error",
        message: err instanceof Error ? err.message : "unknown_error",
      });
    }
  }, [dataProvider, activeWindow]);

  useEffect(() => {
    let cancelled = false;
    loadInitial().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadInitial]);

  const handleLoadDemo = useCallback(() => {
    setViewState({ status: "demo", scenario: FALLBACK_PROVIDER.getScenarios()[0] });
  }, []);

  // ---- Derive the active snapshot / scenario for rendering ----
  const activeSnapshot: CapitalFlowSnapshot | null =
    viewState.status === "ready" || viewState.status === "partial"
      ? viewState.snapshot
      : viewState.status === "loading"
      ? viewState.previous ?? null
      : null;

  const isDemo = viewState.status === "demo";
  const aggregates = useMemo(
    () => (activeSnapshot ? buildCapitalFlowAggregates(activeSnapshot.points) : null),
    [activeSnapshot]
  );

  const overview = useMemo(() => {
    if (!aggregates) return undefined;
    if (viewMode === "P1") {
      const nameOf = (id: string) => themes.find((t) => t.id === id)?.name ?? id;
      return buildOverview(aggregates.byTheme, nameOf);
    }
    const nameOf = (id: string) => subThemes.find((s) => s.id === id)?.name ?? id;
    return buildOverview(aggregates.bySubTheme, nameOf);
  }, [aggregates, viewMode]);

  // Layout is independent of data — compute once.
  const themeLayout = useMemo(
    () => themeLayoutProvider.getLayout(activeLayoutStage.id),
    [activeLayoutStage.id]
  );
  const subThemeLayout = useMemo(
    () => subThemeLayoutProvider.getLayout(activeLayoutStage.id, themeLayout.cells),
    [activeLayoutStage.id, themeLayout]
  );

  // P1: theme totals from real aggregation (or demo scenario).
  const themeNodes = useMemo(() => {
    if (aggregates) {
      return buildThemeRenderNodes({
        cells: themeLayout.cells,
        capitalByTheme: aggregates.byTheme,
        themeFilter: hunterState.themeFilter,
      });
    }
    if (isDemo && viewState.status === "demo") {
      return buildThemeRenderNodes({
        cells: themeLayout.cells,
        scenario: viewState.scenario,
        themeFilter: hunterState.themeFilter,
      });
    }
    return [];
  }, [aggregates, isDemo, viewState, themeLayout, hunterState.themeFilter]);

  const subThemeNodes = useMemo(() => {
    if (aggregates) {
      return buildSubThemeRenderNodes({
        voronoiCells: subThemeLayout.cells,
        capitalBySubTheme: aggregates.bySubTheme,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
      });
    }
    if (isDemo && viewState.status === "demo") {
      return buildSubThemeRenderNodes({
        voronoiCells: subThemeLayout.cells,
        scenario: viewState.scenario,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
      });
    }
    return [];
  }, [aggregates, isDemo, viewState, subThemeLayout, hunterState.themeFilter, hunterState.capitalStateFilter]);

  const stockNodes3 = useMemo(() => {
    if (viewMode !== "P3") return [];
    if (aggregates) {
      return buildP3StockRenderNodes({
        voronoiCells: subThemeLayout.cells,
        points: activeSnapshot?.points ?? [],
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
      });
    }
    if (isDemo && viewState.status === "demo") {
      return buildP3StockRenderNodes({
        voronoiCells: subThemeLayout.cells,
        scenario: viewState.scenario,
        themeFilter: hunterState.themeFilter,
        capitalStateFilter: hunterState.capitalStateFilter,
      });
    }
    return [];
  }, [viewMode, aggregates, activeSnapshot, isDemo, viewState, subThemeLayout, hunterState.themeFilter, hunterState.capitalStateFilter]);

  // ---- Loading / error gates: no scene during initial load or hard error ----
  const showScene = activeSnapshot !== null || isDemo;
  const isLoading = viewState.status === "loading" && activeSnapshot === null && !isDemo;

  // M5: elide identical from/to date (show single date when from === to)
  const range = activeSnapshot
    ? activeSnapshot.window.from === activeSnapshot.window.to
      ? activeSnapshot.window.from
      : `${activeSnapshot.window.from}~${activeSnapshot.window.to}`
    : "";

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">A股主力资金动向捕捉神器</p>
          <h1>A Capital Hunter</h1>
        </div>
        <div className="scenario-story" aria-live="polite">
          {activeSnapshot ? (
            <>
              <span>真实资金流快照</span>
              <p>{sourceLabel(activeSnapshot.source)} {activeSnapshot.window.label}主力净流入 · {range}{activeSnapshot.window.availableDays < activeSnapshot.window.days ? `（仅${activeSnapshot.window.availableDays}日可用）` : ""}</p>
            </>
          ) : isDemo ? (
            <>
              <span>演示模式</span>
              <p>非真实数据，仅用于展示交互。</p>
            </>
          ) : (
            <>
              <span>资金动向</span>
              <p>等待真实资金流快照。</p>
            </>
          )}
        </div>
      </header>

      <section className="workspace">
        <ControlsPanel
          themes={themes}
          activeWindow={activeWindow}
          onWindowChange={setActiveWindow}
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

          <DataStatus
            snapshot={activeSnapshot}
            isDemo={isDemo}
            onRetry={loadInitial}
            onLoadDemo={handleLoadDemo}
          />

          {isLoading && (
            <div className="loading-state" role="status">
              正在读取本地资金流快照…
            </div>
          )}

          {showScene && (
            viewMode === "P1" ? (
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
            )
          )}
          <SceneLegend />
        </section>

        <InspectorPanel overview={overview} overviewTitle={viewMode === "P1" ? "主线概览" : "子题材概览"} />
      </section>
    </main>
  );
}
