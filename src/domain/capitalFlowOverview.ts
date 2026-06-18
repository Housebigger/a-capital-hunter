export interface OverviewEntry { readonly id: string; readonly name: string; readonly value: number; }
export interface CapitalFlowOverview {
  readonly totalNetInflow: number;
  readonly topInflow: readonly OverviewEntry[];
  readonly topOutflow: readonly OverviewEntry[];
}

export function buildOverview(
  totals: ReadonlyMap<string, number>,
  nameOf: (id: string) => string,
  topN = 5
): CapitalFlowOverview {
  const entries: OverviewEntry[] = [...totals.entries()].map(([id, value]) => ({ id, name: nameOf(id), value }));
  const desc = [...entries].sort((a, b) => b.value - a.value);
  const topInflow = desc.filter((e) => e.value > 0).slice(0, topN);
  const topOutflow = desc.filter((e) => e.value < 0).slice(-topN).reverse();
  const totalNetInflow = entries.reduce((sum, e) => sum + e.value, 0);
  return { totalNetInflow, topInflow, topOutflow };
}
