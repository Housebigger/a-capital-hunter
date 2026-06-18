/** Display name for a capital-flow data source. Single source of truth shared
 *  by App header and DataStatus so the two never disagree. */
const LABELS: Record<string, string> = { tushare: "Tushare", jqdata: "JQData" };

export function sourceLabel(source: string): string {
  return LABELS[source] ?? source;
}
