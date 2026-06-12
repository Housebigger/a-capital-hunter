import { createScenarioDataProvider } from "../domain/scenarioDataProvider";
import type { DataProvider, MarketScenario, ReadonlyNonEmptyArray, ScenarioPoint } from "../domain/types";

const FALLBACK_PROVIDER = createScenarioDataProvider();
const RANK_URL = "/api/capital-flow/rank";
const HEALTH_URL = "/api/health";
const FETCH_TIMEOUT_MS = 10_000;
const HEALTH_TIMEOUT_MS = 5_000;

export type PeriodIndicator = "今日" | "5日" | "10日";

export const PERIOD_OPTIONS: readonly { indicator: PeriodIndicator; label: string }[] = [
  { indicator: "今日", label: "今日" },
  { indicator: "5日", label: "近5日" },
  { indicator: "10日", label: "近10日" },
];

interface ApiPoint {
  sectorId: string;
  sectorName: string;
  netInflow: number;
  pctChange: number;
}

interface RankResponse {
  indicator?: string;
  source?: string;
  points?: ApiPoint[];
  fallback?: boolean;
}

function toScenario(indicator: string, data: RankResponse): MarketScenario {
  return {
    id: `rank-${indicator}`,
    label: `${indicator}资金流`,
    story: `东方财富行业板块主力资金${indicator}净流入`,
    points: (data.points ?? []).map(
      (p): ScenarioPoint => ({ sectorId: p.sectorId, netInflow: p.netInflow })
    ),
  };
}

export function createAkShareDataProvider(): DataProvider & {
  isAvailable(): Promise<boolean>;
  fetchPeriod(indicator: PeriodIndicator): Promise<MarketScenario>;
  getCachedPeriod(indicator: PeriodIndicator): MarketScenario | null;
} {
  const cache = new Map<string, MarketScenario>();

  const fetchPeriod = async (indicator: PeriodIndicator): Promise<MarketScenario> => {
    // Return cached if available
    const cached = cache.get(indicator);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const url = `${RANK_URL}?indicator=${encodeURIComponent(indicator)}`;
      const res = await fetch(url, { signal: controller.signal });
      const data: RankResponse = await res.json();
      if (data.fallback || !data.points) {
        // Return mock fallback scenario for this period
        return FALLBACK_PROVIDER.getScenarios()[0];
      }
      const scenario = toScenario(indicator, data);
      cache.set(indicator, scenario);
      return scenario;
    } catch {
      return FALLBACK_PROVIDER.getScenarios()[0];
    } finally {
      clearTimeout(timer);
    }
  };

  const getCachedPeriod = (indicator: PeriodIndicator): MarketScenario | null => {
    return cache.get(indicator) ?? null;
  };

  // Pre-fetch "今日" on creation
  fetchPeriod("今日").catch(() => {});

  return {
    getScenarios(): ReadonlyNonEmptyArray<MarketScenario> {
      const today = cache.get("今日");
      if (today) return [today];
      return FALLBACK_PROVIDER.getScenarios();
    },
    fetchPeriod,
    getCachedPeriod,
    async isAvailable(): Promise<boolean> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      try {
        const res = await fetch(HEALTH_URL, { signal: controller.signal });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
