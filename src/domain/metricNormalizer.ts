import type { CapitalDirection, NormalizedMetric } from "./types";

const MAX_COLUMN_HEIGHT = 4.8;
const FLAT_THRESHOLD = 1;

export function normalizeCapitalValue(value: number, maxAbsValue: number): NormalizedMetric {
  const direction: CapitalDirection =
    Math.abs(value) < FLAT_THRESHOLD ? "flat" : value > 0 ? "inflow" : "outflow";
  const safeMax = maxAbsValue <= 0 ? 1 : maxAbsValue;
  const magnitude = Math.min(Math.abs(value) / safeMax, 1);
  const height = direction === "flat" ? 0.08 : magnitude * MAX_COLUMN_HEIGHT * Math.sign(value);

  return {
    rawValue: value,
    height,
    direction,
    color: direction === "inflow" ? "#e64646" : direction === "outflow" ? "#2fa66a" : "#7b8794",
    intensity: direction === "flat" ? 0.35 : 0.45 + magnitude * 0.55,
    labelValue: `${value >= 0 ? "+" : ""}${value.toFixed(1)}亿`
  };
}
