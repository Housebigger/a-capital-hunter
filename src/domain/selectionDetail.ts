import type { Theme, SubTheme } from "./types";

export interface SelectionDetail {
  readonly kind: "theme" | "subTheme";
  readonly name: string;
  readonly parentThemeName?: string;
  readonly netInflow: number;
  readonly direction: "inflow" | "outflow" | "flat";
}

interface SelectionData {
  readonly themes: readonly Theme[];
  readonly subThemes: readonly SubTheme[];
  readonly byTheme: ReadonlyMap<string, number>;
  readonly bySubTheme: ReadonlyMap<string, number>;
}

const directionOf = (v: number): SelectionDetail["direction"] =>
  v > 0 ? "inflow" : v < 0 ? "outflow" : "flat";

/**
 * Turn the selected id (themeId in P1, subThemeId in P2/P3) + the active window's
 * aggregates into a small inspector view-model. Pure. Returns null when nothing
 * is selected or the id is unknown.
 */
export function buildSelectionDetail(
  selectedSectorId: string | undefined,
  viewMode: "P1" | "P2" | "P3",
  data: SelectionData
): SelectionDetail | null {
  if (!selectedSectorId) return null;
  if (viewMode === "P1") {
    const theme = data.themes.find((t) => t.id === selectedSectorId);
    if (!theme) return null;
    const net = data.byTheme.get(theme.id) ?? 0;
    return { kind: "theme", name: theme.name, netInflow: net, direction: directionOf(net) };
  }
  const sub = data.subThemes.find((s) => s.id === selectedSectorId);
  if (!sub) return null;
  const net = data.bySubTheme.get(sub.id) ?? 0;
  const parent = data.themes.find((t) => t.id === sub.themeId);
  return {
    kind: "subTheme",
    name: sub.name,
    parentThemeName: parent?.name,
    netInflow: net,
    direction: directionOf(net),
  };
}
