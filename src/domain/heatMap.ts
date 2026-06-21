import type { SubTheme } from "./types";

export interface HeatMap {
  /** themeId -> [0,1], |net inflow| normalized across all themes */
  readonly themeHeat: Record<string, number>;
  /** subThemeId -> [0,1], |net inflow| normalized WITHIN the parent theme */
  readonly subThemeHeat: Record<string, number>;
}

/**
 * Build a layout heat map from the active window's capital aggregates. Heat is
 * |主力净流入| (absolute) — heavy inflow and heavy outflow are both "hot".
 * Theme heat is normalized across the 11 themes; sub-theme heat is normalized
 * within its parent theme (so a theme's sub-themes size relative to each other).
 * Pure: same input -> same output. All-flat input yields all-zero heat.
 */
export function buildHeatMap(
  byTheme: ReadonlyMap<string, number>,
  bySubTheme: ReadonlyMap<string, number>,
  subThemes: readonly Pick<SubTheme, "id" | "themeId">[]
): HeatMap {
  let maxTheme = 0;
  for (const v of byTheme.values()) maxTheme = Math.max(maxTheme, Math.abs(v));
  const themeHeat: Record<string, number> = {};
  for (const [id, v] of byTheme) {
    themeHeat[id] = maxTheme > 0 ? Math.abs(v) / maxTheme : 0;
  }

  const themeOf = new Map(subThemes.map((s) => [s.id, s.themeId]));
  const maxByParent = new Map<string, number>();
  for (const [id, v] of bySubTheme) {
    const parent = themeOf.get(id);
    if (parent === undefined) continue;
    maxByParent.set(parent, Math.max(maxByParent.get(parent) ?? 0, Math.abs(v)));
  }
  const subThemeHeat: Record<string, number> = {};
  for (const [id, v] of bySubTheme) {
    const parent = themeOf.get(id);
    if (parent === undefined) continue;
    const max = maxByParent.get(parent) ?? 0;
    subThemeHeat[id] = max > 0 ? Math.abs(v) / max : 0;
  }
  return { themeHeat, subThemeHeat };
}
