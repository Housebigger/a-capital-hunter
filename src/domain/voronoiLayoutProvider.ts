import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { layoutStages, getLayoutStageById } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { subThemes } from "./subThemeRegistry";
import { themes } from "./themeRegistry";
import type { VoronoiLayout } from "./types";

export interface VoronoiLayoutProvider {
  getLayout(stageId?: string): VoronoiLayout;
}

/**
 * P1 SubTheme layout: cityBorderGap=0 so same-theme cells form continuous regions.
 * Used internally by the theme-level engine for theme plate backgrounds.
 */
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
          mapRadius: 11,
          relaxationIterations: 20,
          areaConvergenceThreshold: 0.05,
          provinceBorderGap: 0.25,
          cityBorderGap: 0,
        },
      });
    },
  };
}

/**
 * P2 SubTheme layout: each SubTheme gets its own distinct island with visible gaps.
 * cityBorderGap > 0 creates space between all SubTheme cells.
 */
export function createSubThemeLayoutProvider(): VoronoiLayoutProvider {
  return {
    getLayout: (stageId) => {
      const stage = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      return createVoronoiLayout({
        subThemes,
        themes,
        relationshipEdges,
        stage,
        options: {
          mapRadius: 11,
          relaxationIterations: 20,
          areaConvergenceThreshold: 0.05,
          provinceBorderGap: 0.30,
          cityBorderGap: 0.08,
        },
      });
    },
  };
}
