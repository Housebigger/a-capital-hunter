import subThemeConfig from "../data/subThemeRegistry.json";
import type { SubTheme } from "./types";

const freezeSubTheme = (subTheme: SubTheme): Readonly<SubTheme> =>
  Object.freeze({ ...subTheme });

export const subThemes: readonly Readonly<SubTheme>[] = Object.freeze(
  subThemeConfig.map((subTheme) => freezeSubTheme(subTheme))
);
