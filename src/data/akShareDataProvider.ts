import { createScenarioDataProvider } from "../domain/scenarioDataProvider";
import type { DataProvider, MarketScenario, ReadonlyNonEmptyArray, ScenarioPoint } from "../domain/types";

const FALLBACK_PROVIDER = createScenarioDataProvider();
const DATA_URL = "/api/capital-flow/realtime";
const HEALTH_URL = "/api/health";
const DATA_TIMEOUT_MS = 10_000;
const HEALTH_TIMEOUT_MS = 5_000;

interface ApiPoint {
  sectorId: string;
  sectorName: string;
  netInflow: number;
  pctChange: number;
}

interface ApiResponse {
  date?: string;
  source?: string;
  points?: ApiPoint[];
  fallback?: boolean;
}

interface AkShareDataProvider extends DataProvider {
  isAvailable(): Promise<boolean>;
}

function toScenario(data: ApiResponse): MarketScenario {
  const date = data.date ?? "today";
  return {
    id: `realtime-${date}`,
    label: `实时 ${data.date ?? ""}`,
    story: "东方财富行业板块主力资金实时净流入",
    points: (data.points ?? []).map(
      (p): ScenarioPoint => ({ sectorId: p.sectorId, netInflow: p.netInflow })
    ),
  };
}

export function createAkShareDataProvider(): AkShareDataProvider {
  let cached: MarketScenario | null = null;

  const fetchData = async (): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DATA_TIMEOUT_MS);
    try {
      const res = await fetch(DATA_URL, { signal: controller.signal });
      const data: ApiResponse = await res.json();
      if (data.fallback) {
        return; // keep cached null → fallback provider used
      }
      cached = toScenario(data);
    } catch {
      // fetch error, parse error, timeout → fallback
    } finally {
      clearTimeout(timer);
    }
  };

  // Kick off background fetch immediately
  fetchData();

  return {
    getScenarios(): ReadonlyNonEmptyArray<MarketScenario> {
      if (cached) {
        return [cached];
      }
      return FALLBACK_PROVIDER.getScenarios();
    },

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
