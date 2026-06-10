import { createAlgorithmicLayout } from "./algorithmicLayoutEngine";
import { layoutStages, getLayoutStageById } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { sectors, themes } from "./themeRegistry";
import { subThemes } from "./subThemeRegistry";
import type { LayoutProvider, SectorLayout } from "./types";

const manualLayout: SectorLayout = {
  version: "manual-v1",
  stageId: "manual",
  cells: [
    { sectorId: "ai-computing", x: -5, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "optical-modules", x: -6, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "cpo", x: -4, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "liquid-cooled-servers", x: -6, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "domestic-computing", x: -4, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "data-centers", x: -5, z: 2, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "robotics-physical-ai", x: 0, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "reducers", x: -1, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "servo-systems", x: 1, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "sensors", x: -1, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "machine-vision", x: 1, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "actuators", x: 0, z: 2, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "low-altitude-economy", x: 5, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "evtol", x: 4, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "flight-control-systems", x: 6, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "drones", x: 4, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "general-aviation-operations", x: 6, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "air-traffic-systems", x: 5, z: 2, role: "related-sector", relationshipStrength: 2 }
  ]
};

const cloneLayout = (layout: SectorLayout): SectorLayout => ({
  ...layout,
  cells: layout.cells.map((cell) => ({ ...cell }))
});

export function createManualLayoutProvider(): LayoutProvider {
  return {
    getLayout: () => cloneLayout(manualLayout)
  };
}

export function createAlgorithmicLayoutProvider(): LayoutProvider {
  return {
    getLayout: (stageId) => {
      const stage = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      const previousStage = stage.previousStageId ? getLayoutStageById(stage.previousStageId) : undefined;
      const result = createAlgorithmicLayout({
        themes,
        sectors,
        relationshipEdges,
        stage,
        previousStage,
        options: {
          gridWidth: 22,
          gridHeight: 16,
          maxStageShift: 1.6,
          centerPullStrength: 1.2,
          baseRadius: 6.8,
          subThemeDistance: 1.5,
          relationPullFactor: 0.15
        },
        subThemes
      });

      return {
        ...result.layout,
        cells: result.layout.cells.map((cell) => ({ ...cell }))
      };
    }
  };
}
