import { useState } from "react";
import type {
  CameraPreset,
  CapitalStateFilter,
  SectorId,
  ThemeFilter
} from "../domain/types";

export function useHunterState() {
  const [themeFilter, setThemeFilter] = useState<ThemeFilter>("all");
  const [capitalStateFilter, setCapitalStateFilter] = useState<CapitalStateFilter>("all");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("angled");
  const [selectedSectorId, setSelectedSectorId] = useState<SectorId | undefined>();
  const [selectedStockId, setSelectedStockId] = useState<string | undefined>();
  const [focusSubThemeId, setFocusSubThemeId] = useState<string | undefined>();

  return {
    themeFilter,
    setThemeFilter,
    capitalStateFilter,
    setCapitalStateFilter,
    cameraPreset,
    setCameraPreset,
    selectedSectorId,
    setSelectedSectorId,
    selectedStockId,
    setSelectedStockId,
    focusSubThemeId,
    setFocusSubThemeId,
  };
}
