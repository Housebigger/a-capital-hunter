import { sectors, themes } from "./themeRegistry";
import type { LayoutStage, LayoutStageId, ReadonlyNonEmptyArray, SectorId, ThemeId } from "./types";

const heat = (
  highThemes: readonly ThemeId[],
  warmThemes: readonly ThemeId[]
): { themeHeat: Record<ThemeId, number>; sectorHeat: Record<SectorId, number> } => {
  const themeHeat: Record<ThemeId, number> = {};
  const sectorHeat: Record<SectorId, number> = {};

  for (const theme of themes) {
    themeHeat[theme.id] = highThemes.includes(theme.id)
      ? 1
      : warmThemes.includes(theme.id)
        ? 0.62
        : 0.28;
  }

  for (const sector of sectors) {
    const base = themeHeat[sector.primaryThemeId] ?? 0.2;
    sectorHeat[sector.id] = Number(
      (sector.isThemeCenter ? base : Math.max(0.12, base - 0.08)).toFixed(2)
    );
  }

  return { themeHeat, sectorHeat };
};

const stage = (
  id: LayoutStageId,
  label: string,
  story: string,
  highThemes: readonly ThemeId[],
  warmThemes: readonly ThemeId[],
  previousStageId?: LayoutStageId
): LayoutStage => {
  const { sectorHeat, themeHeat } = heat(highThemes, warmThemes);

  return Object.freeze({
    id,
    label,
    story,
    previousStageId,
    sectorHeat: Object.freeze(sectorHeat),
    themeHeat: Object.freeze(themeHeat)
  });
};

export const layoutStages: ReadonlyNonEmptyArray<LayoutStage> = Object.freeze([
  stage(
    "ai-semiconductor-resonance",
    "AI/半导体共振",
    "AI算力与半导体供应链共振，硬科技主线靠近视觉中心。",
    ["ai-computing", "semiconductors"],
    ["robotics-physical-ai"]
  ),
  stage(
    "robotics-low-altitude-diffusion",
    "机器人/低空扩散",
    "机器人与低空经济扩散，感知、控制、航空器相关板块升温。",
    ["robotics-physical-ai", "low-altitude-economy"],
    ["ai-computing", "defense-aerospace"],
    "ai-semiconductor-resonance"
  ),
  stage(
    "new-energy-defense-rotation",
    "新能源/军工轮动",
    "新能源与军工航天获得资金关注，前期科技主线进入整理。",
    ["new-energy", "defense-aerospace"],
    ["innovative-medicine"],
    "robotics-low-altitude-diffusion"
  )
]);

export function getLayoutStageById(stageId: LayoutStageId): LayoutStage {
  const stage = layoutStages.find((candidate) => candidate.id === stageId);
  if (!stage) {
    throw new Error(`Unknown layout stage ${stageId}`);
  }
  return stage;
}
