import { layoutStages, getLayoutStageById } from "./layoutStages";
import { relationshipEdges } from "./relationshipRegistry";
import { themes } from "./themeRegistry";
import {
  createThemeVoronoiLayout,
  type ThemeVoronoiLayout,
} from "./themeVoronoiLayoutEngine";

export interface ThemeLayoutProvider {
  getLayout(stageId?: string, themeHeat?: Record<string, number>): ThemeVoronoiLayout;
}

export function createThemeLayoutProvider(): ThemeLayoutProvider {
  return {
    getLayout: (stageId, themeHeat) => {
      const base = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      const stage = themeHeat ? { ...base, themeHeat } : base;
      return createThemeVoronoiLayout({
        themes,
        relationshipEdges,
        stage,
        options: {
          mapRadius: 15,
          borderGap: 0.20,
          lloydIterations: 3,
          smoothIterations: 2,
        },
      });
    },
  };
}
