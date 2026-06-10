import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { layoutStages, getLayoutStageById } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import type { VoronoiLayout } from "./types";

export interface VoronoiLayoutProvider {
  getLayout(stageId?: string): VoronoiLayout;
}

export function createVoronoiLayoutProvider(): VoronoiLayoutProvider {
  return {
    getLayout: (stageId) => {
      const stage = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      return createVoronoiLayout({
        subThemes,
        themes,
        relationshipEdges,
        stage,
        options: {
          mapWidth: 30,
          mapHeight: 22,
          relaxationIterations: 20,
          areaConvergenceThreshold: 0.05,
          provinceBorderGap: 0.25,
          cityBorderGap: 0,
        },
      });
    },
  };
}
