/**
 * Capital flow snapshot API contract and runtime validation.
 *
 * This module is the single place that knows the wire shape served by the
 * Flask Blueprint under /api/capital-flow/*. Components consume the validated
 * TypeScript types; they never see raw JSON.
 *
 * Validation rejects: missing metadata, non-finite money values, invalid
 * status/role literals, and non-array points — anything that would let a
 * malformed payload silently become "real" data on the map.
 */

export type SnapshotStatus = "ready" | "partial" | "failed";
export type AggregationRole = "primary" | "related";

export interface StockCapitalFlowPoint {
  readonly stockId: string;
  readonly securityCode: string;
  readonly stockName: string;
  readonly subThemeId: string;
  readonly themeId: string;
  readonly aggregationRole: AggregationRole;
  readonly netAmountMain: number;
  readonly tradeDate: string;
}

export interface CapitalFlowSnapshot {
  readonly tradeDate: string;
  readonly fetchedAt: string;
  readonly source: "jqdata";
  readonly metric: "net_amount_main";
  readonly unit: "CNY";
  readonly status: SnapshotStatus;
  readonly coverage: Readonly<{ requested: number; succeeded: number; failed: number }>;
  readonly points: readonly StockCapitalFlowPoint[];
  readonly failures: readonly Readonly<{
    securityCode?: string;
    stockId?: string;
    reason: string;
  }>[];
}

export interface CapitalFlowStatus {
  readonly databaseAvailable: boolean;
  readonly latestTradeDate?: string;
  readonly latestStatus?: SnapshotStatus;
  readonly source: "jqdata";
  readonly metric: "net_amount_main";
  readonly availableTradeDates: readonly string[];
}

const SNAPSHOT_STATUSES = new Set(["ready", "partial", "failed"]);
const AGGREGATION_ROLES = new Set(["primary", "related"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export class InvalidSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSnapshotError";
  }
}

function parseCoverage(raw: unknown): CapitalFlowSnapshot["coverage"] {
  if (!isObject(raw)) throw new InvalidSnapshotError("Invalid capital flow snapshot: coverage missing");
  const { requested, succeeded, failed } = raw;
  if (!Number.isFinite(requested) || !Number.isFinite(succeeded) || !Number.isFinite(failed)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: coverage must be finite numbers");
  }
  return {
    requested: Number(requested),
    succeeded: Number(succeeded),
    failed: Number(failed),
  };
}

function parsePoint(raw: unknown): StockCapitalFlowPoint {
  if (!isObject(raw)) throw new InvalidSnapshotError("Invalid capital flow snapshot: point is not an object");
  const {
    stockId, securityCode, stockName, subThemeId, themeId,
    aggregationRole, netAmountMain, tradeDate,
  } = raw;
  if (!isString(stockId) || !isString(securityCode) || !isString(stockName) ||
      !isString(subThemeId) || !isString(themeId) || !isString(tradeDate)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: point missing string fields");
  }
  if (!AGGREGATION_ROLES.has(aggregationRole as string)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: invalid aggregationRole");
  }
  if (!isFiniteNumber(netAmountMain)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: non-finite netAmountMain");
  }
  return {
    stockId,
    securityCode,
    stockName,
    subThemeId,
    themeId,
    aggregationRole: aggregationRole as AggregationRole,
    netAmountMain,
    tradeDate,
  };
}

function parseFailures(raw: unknown): CapitalFlowSnapshot["failures"] {
  if (!Array.isArray(raw)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: failures is not an array");
  }
  return raw.map((f) => {
    if (!isObject(f) || !isString(f.reason)) {
      throw new InvalidSnapshotError("Invalid capital flow snapshot: malformed failure");
    }
    return {
      reason: f.reason as string,
      ...(typeof f.securityCode === "string" && f.securityCode
        ? { securityCode: f.securityCode }
        : {}),
      ...(typeof f.stockId === "string" && f.stockId
        ? { stockId: f.stockId }
        : {}),
    };
  });
}

export function parseSnapshot(raw: unknown): CapitalFlowSnapshot {
  if (!isObject(raw)) throw new InvalidSnapshotError("Invalid capital flow snapshot: not an object");
  const {
    tradeDate, fetchedAt, source, metric, unit, status, coverage, points, failures,
  } = raw;

  if (!isString(tradeDate) || !isString(fetchedAt)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: missing tradeDate/fetchedAt");
  }
  if (source !== "jqdata") {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: source must be jqdata");
  }
  if (metric !== "net_amount_main") {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: metric must be net_amount_main");
  }
  if (unit !== "CNY") {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: unit must be CNY");
  }
  if (!SNAPSHOT_STATUSES.has(status as string)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: invalid status");
  }
  if (!Array.isArray(points)) {
    throw new InvalidSnapshotError("Invalid capital flow snapshot: points is not an array");
  }

  return {
    tradeDate,
    fetchedAt,
    source,
    metric,
    unit,
    status: status as SnapshotStatus,
    coverage: parseCoverage(coverage),
    points: points.map(parsePoint),
    failures: parseFailures(failures),
  };
}

export function parseStatus(raw: unknown): CapitalFlowStatus {
  if (!isObject(raw)) throw new InvalidSnapshotError("Invalid capital flow status: not an object");
  const {
    databaseAvailable, latestTradeDate, latestStatus, source, metric, availableTradeDates,
  } = raw;
  if (typeof databaseAvailable !== "boolean") {
    throw new InvalidSnapshotError("Invalid capital flow status: databaseAvailable missing");
  }
  if (source !== "jqdata" || metric !== "net_amount_main") {
    throw new InvalidSnapshotError("Invalid capital flow status: source/metric mismatch");
  }
  if (!Array.isArray(availableTradeDates) || !availableTradeDates.every((d) => typeof d === "string")) {
    throw new InvalidSnapshotError("Invalid capital flow status: availableTradeDates malformed");
  }
  if (latestStatus !== undefined && !SNAPSHOT_STATUSES.has(latestStatus as string)) {
    throw new InvalidSnapshotError("Invalid capital flow status: invalid latestStatus");
  }
  return {
    databaseAvailable,
    ...(typeof latestTradeDate === "string" && latestTradeDate ? { latestTradeDate } : {}),
    ...(latestStatus !== undefined ? { latestStatus: latestStatus as SnapshotStatus } : {}),
    source,
    metric,
    availableTradeDates,
  };
}
