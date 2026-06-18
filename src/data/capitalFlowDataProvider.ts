/**
 * Async provider for capital flow snapshots.
 *
 * This is the only frontend module that talks to the Flask snapshot API. It
 * validates every response and throws on any failure — it NEVER falls back to
 * demo/mock data, because silently showing simulated numbers as "real" is the
 * exact problem this JQData rewrite exists to fix.
 */

import {
  parseSnapshot,
  parseStatus,
  InvalidSnapshotError,
  type CapitalFlowSnapshot,
  type CapitalFlowStatus,
} from "./capitalFlowSnapshot";

export type CapitalFlowWindowKey = "1d" | "5d" | "10d" | "20d";

const LATEST_URL = "/api/capital-flow/snapshot/latest";
const STATUS_URL = "/api/capital-flow/status";
const FETCH_TIMEOUT_MS = 10_000;

interface BackendError {
  readonly error: { readonly code: string; readonly message: string };
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new Error("Capital flow API returned a non-JSON response");
  }
}

async function request<T>(
  url: string,
  parse: (raw: unknown) => T
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await readBody(res);
    if (!res.ok) {
      const err = (body as BackendError | null)?.error;
      const code = err?.code ?? "unknown_error";
      throw new Error(code);
    }
    try {
      return parse(body);
    } catch (parseError) {
      if (parseError instanceof InvalidSnapshotError) throw parseError;
      throw new InvalidSnapshotError("Invalid capital flow snapshot");
    }
  } catch (err) {
    if (err instanceof InvalidSnapshotError || (err instanceof Error && err.message)) {
      // Surface structured error codes (e.g. snapshot_unavailable) verbatim so
      // the UI can branch on them; collapse AbortError/network noise.
      if ((err as Error).name === "AbortError") {
        throw new Error("request_timeout");
      }
      throw err;
    }
    throw new Error("network_error");
  } finally {
    clearTimeout(timer);
  }
}

export interface CapitalFlowDataProvider {
  fetchLatest(window?: CapitalFlowWindowKey): Promise<CapitalFlowSnapshot>;
  fetchDate(tradeDate: string): Promise<CapitalFlowSnapshot>;
  fetchStatus(): Promise<CapitalFlowStatus>;
}

export function createCapitalFlowDataProvider(): CapitalFlowDataProvider {
  return {
    fetchLatest(window: CapitalFlowWindowKey = "1d"): Promise<CapitalFlowSnapshot> {
      return request(`${LATEST_URL}?window=${window}`, parseSnapshot);
    },
    fetchDate(tradeDate: string): Promise<CapitalFlowSnapshot> {
      const url = `/api/capital-flow/snapshot?trade_date=${encodeURIComponent(tradeDate)}`;
      return request(url, parseSnapshot);
    },
    fetchStatus(): Promise<CapitalFlowStatus> {
      return request(STATUS_URL, parseStatus);
    },
  };
}
