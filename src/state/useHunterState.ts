import { useState } from "react";
import type { CameraPreset, CapitalStateFilter, SectorId, ThemeFilter } from "../domain/types";

export function useHunterState(scenarioIds: string[]) {
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
