/**
 * Pure label-thinning helpers. On phones the 408-stock / 74-sub-theme map is too
 * dense to label everything, so the scenes label only the heaviest few. Pure:
 * sort is on a copy; same input → same output.
 */
export interface GroupedLabelCandidate {
  readonly id: string;
  readonly subThemeId: string;
  readonly weight: number; // typically |metric.height|
}

/** Ids of the top `perGroup` candidates (by weight, desc) within each sub-theme. */
export function selectTopLabelsPerGroup(
  candidates: readonly GroupedLabelCandidate[],
  perGroup: number
): Set<string> {
  const byGroup = new Map<string, GroupedLabelCandidate[]>();
  for (const c of candidates) {
    const arr = byGroup.get(c.subThemeId) ?? [];
    arr.push(c);
    byGroup.set(c.subThemeId, arr);
  }
  const ids = new Set<string>();
  for (const arr of byGroup.values()) {
    [...arr]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(0, perGroup))
      .forEach((c) => ids.add(c.id));
  }
  return ids;
}

/** Ids of the global top `n` candidates by weight, desc. */
export function selectTopLabels(
  candidates: readonly { id: string; weight: number }[],
  n: number
): Set<string> {
  return new Set(
    [...candidates]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, Math.max(0, n))
      .map((c) => c.id)
  );
}
