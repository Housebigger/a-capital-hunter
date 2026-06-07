import { useState } from "react";
import type {
  CameraPreset,
  CapitalStateFilter,
  MarketScenario,
  ReadonlyNonEmptyArray,
  SectorId,
  ThemeFilter
} from "../domain/types";

export function getScenarioIds(
  scenarios: ReadonlyNonEmptyArray<Pick<MarketScenario, "id">>
): ReadonlyNonEmptyArray<string> {
  const [firstScenario, ...remainingScenarios] = scenarios;
  return [firstScenario.id, ...remainingScenarios.map((scenario) => scenario.id)];
}

export function useHunterState(scenarioIds: ReadonlyNonEmptyArray<string>) {
  const [activeScenarioId, setActiveScenarioIdState] = useState(scenarioIds[0]);
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>("all");
  const [capitalStateFilter, setCapitalStateFilter] = useState<CapitalStateFilter>("all");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("angled");
  const [showCentersOnly, setShowCentersOnly] = useState(false);
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId | undefined>();

  function setActiveScenarioId(nextScenarioId: string) {
    setActiveScenarioIdState(nextScenarioId);
    setSelectedSectorId(undefined);
  }

  return {
    activeScenarioId,
    setActiveScenarioId,
    themeFilter,
    setThemeFilter,
    capitalStateFilter,
    setCapitalStateFilter,
    cameraPreset,
    setCameraPreset,
    showCentersOnly,
    setShowCentersOnly,
    selectedSectorId,
    setSelectedSectorId
  };
}
