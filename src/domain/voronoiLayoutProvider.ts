import { createVoronoiLayout } from "./voronoiLayoutEngine";
import { layoutStages, getLayoutStageById } from "./layoutStages";
import { subThemes } from "./subThemeRegistry";
import type { VoronoiLayout } from "./types";
import type { ThemeCell } from "./themeVoronoiLayoutEngine";

export interface VoronoiLayoutProvider {
  getLayout(stageId?: string, themeCells?: ReadonlyArray<ThemeCell>, subThemeHeat?: Record<string, number>): VoronoiLayout;
}

/**
 * P2 SubTheme layout: each SubTheme gets its own territory within the
 * parent theme's polygon. Requires themeCells from P1 layout.
 */
export function createSubThemeLayoutProvider(): VoronoiLayoutProvider {
  return {
    getLayout: (stageId, themeCells, subThemeHeat) => {
      const stage = stageId ? getLayoutStageById(stageId) : layoutStages[0];
      if (!themeCells || themeCells.length === 0) {
        // Fallback: return empty layout if no theme cells provided
        return {
          cells: [],
          boundary: { radius: 11 },
          version: `voronoi-${stage.id}`,
          stageId: stage.id,
        };
      }
      return createVoronoiLayout({
        subThemes,
        themeCells,
        stage,
        options: {
          mapRadius: 15,
          cityBorderGap: 0.02,
          smoothIterations: 1,
        },
        subThemeHeat,
      });
    },
  };
}
