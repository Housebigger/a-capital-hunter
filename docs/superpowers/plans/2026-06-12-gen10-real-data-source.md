# Gen10: Real Data Source (AkShare) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock data with real A-share sector capital flow data from AkShare via Flask microservice.

**Architecture:** Flask API wraps AkShare calls, serves JSON. Vite proxy forwards `/api/*` to Flask. Frontend `DataProvider` fetches from API with auto-fallback to mock.

**Tech Stack:** Python 3.9+, Flask, AkShare, flask-cors / TypeScript, Vite proxy

---

### Task 1: Create Flask backend scaffold

**Files:**
- Create: `server/requirements.txt`
- Create: `server/app.py`

- [ ] **Step 1: Create `server/requirements.txt`**

```
flask>=3.0
flask-cors>=4.0
akshare>=1.16
flask-caching>=2.1
gunicorn>=22.0
```

- [ ] **Step 2: Create `server/app.py`**

```python
"""
AkShare Capital Flow Flask API
Serves real A-share sector capital flow data for A Capital Hunter.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_caching import Cache
import akshare as ak
import traceback

app = Flask(__name__)
CORS(app)

# Cache config: 5min during trading hours, 30min after
cache = Cache(app, config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "akshare_version": ak.__version__})


# ---------------------------------------------------------------------------
# Sector name → our sectorId mapping
# ---------------------------------------------------------------------------

# Maps East Money sector/concept names to our sectorIds
# Priority: concept板块 names first, then industry板块
SECTOR_MAP = {
    # AI算力
    "光模块": "optical-modules",
    "CPO": "cpo",
    "光通信": "optical-modules",
    "液冷": "liquid-cooled-servers",
    "算力": "data-centers",
    "国产芯片": "domestic-chips",
    "AI芯片": "ai-chip-design",
    "人工智能": "ai-applications",
    "AIGC": "ai-applications",
    # 机器人/物理AI
    "机器人概念": "robotics-core",
    "减速器": "robotics-core",
    "机器视觉": "perception-layer",
    "传感器": "perception-layer",
    "人形机器人": "application-scenarios",
    # 低空经济
    "低空经济": "aircraft-control",
    "无人机": "drone-ops",
    "通用航空": "aircraft-control",
    # 半导体
    "半导体": "semiconductor-equipment",
    "半导体概念": "semiconductor-equipment",
    "芯片": "domestic-chips",
    "集成电路": "design-manufacturing",
    "先进封装": "advanced-packaging",
    "光刻胶": "materials-process",
    # 新能源
    "光伏设备": "power-generation",
    "太阳能": "power-generation",
    "储能": "storage-battery",
    "锂电池": "storage-battery",
    "充电桩": "charging-infra",
    # 军工/商业航天
    "航天概念": "launch-communication",
    "卫星导航": "navigation-electronics",
    "北斗": "navigation-electronics",
    "军工": "defense-informatics",
    "商业航天": "launch-communication",
    # 创新药/医药
    "创新药": "drug-rd",
    "CRO": "device-biology",
    "医疗器械": "device-biology",
    "中药": "traditional-medicine",
    # 新能源汽车/智能驾驶
    "新能源车": "vehicle-powertrain",
    "自动驾驶": "autonomous-driving",
    "智能驾驶": "autonomous-driving",
    "车联网": "v2x",
    "汽车芯片": "chip-arch",
    # 消费电子/VR
    "消费电子": "terminal-devices",
    "VR": "vr-ar",
    "AR": "vr-ar",
    "虚拟现实": "vr-ar",
    "苹果概念": "terminal-devices",
    # 数字经济
    "数据要素": "data-elements",
    "信创": "xinchuang",
    "云计算": "cloud-software",
    "网络安全": "security-software",
    # 金融科技
    "数字货币": "digital-finance",
    "金融科技": "fin-infra",
}


def map_to_sector_ids(df):
    """Map AkShare DataFrame rows to our sectorIds.

    Returns list of { sectorId, sectorName, netInflow, pctChange }.
    Uses keyword matching: if any SECTOR_MAP key is a substring of the
    sector name, we use that mapping.
    """
    results = []
    seen_ids = set()

    for _, row in df.iterrows():
        name = str(row.get("名称", ""))
        net_inflow = row.get("主力净流入-净额", 0)
        pct_change = row.get("今日涨跌幅", 0)

        # Skip if net inflow is NaN
        if net_inflow != net_inflow:
            continue

        matched_id = None
        for keyword, sector_id in SECTOR_MAP.items():
            if keyword in name:
                matched_id = sector_id
                break

        if matched_id and matched_id not in seen_ids:
            seen_ids.add(matched_id)
            results.append({
                "sectorId": matched_id,
                "sectorName": name,
                "netInflow": round(float(net_inflow), 2),
                "pctChange": round(float(pct_change), 2) if pct_change == pct_change else 0,
            })

    return results


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.route("/api/capital-flow/realtime")
@cache.cached(timeout=300, query_string=True)
def capital_flow_realtime():
    """Today's sector capital flow ranking from East Money."""
    try:
        df = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")
        points = map_to_sector_ids(df)

        # Also fetch concept板块 for AI/robotics etc
        try:
            df_concept = ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="概念资金流")
            concept_points = map_to_sector_ids(df_concept)
            # Merge: concept points override industry points for same sectorId
            industry_ids = {p["sectorId"] for p in points}
            for cp in concept_points:
                if cp["sectorId"] not in industry_ids:
                    points.append(cp)
        except Exception:
            pass  # Concept fetch failure is non-fatal

        return jsonify({
            "date": str(df.columns[0]) if len(df) > 0 else "",
            "source": "eastmoney",
            "points": points,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "fallback": True}), 503


@app.route("/api/capital-flow/history")
@cache.cached(timeout=600, query_string=True)
def capital_flow_history():
    """Multi-day sector capital flow. Uses indicator='5日' for 5-day aggregate."""
    try:
        days = request.args.get("days", "5")
        indicator = f"{days}日" if days in ("3", "5", "10") else "5日"

        df = ak.stock_sector_fund_flow_rank(indicator=indicator, sector_type="行业资金流")
        points = map_to_sector_ids(df)

        try:
            df_concept = ak.stock_sector_fund_flow_rank(indicator=indicator, sector_type="概念资金流")
            concept_points = map_to_sector_ids(df_concept)
            industry_ids = {p["sectorId"] for p in points}
            for cp in concept_points:
                if cp["sectorId"] not in industry_ids:
                    points.append(cp)
        except Exception:
            pass

        return jsonify({
            "indicator": indicator,
            "source": "eastmoney",
            "scenarios": [
                {
                    "id": f"history-{indicator}",
                    "label": f"近{days}日累计",
                    "story": f"东方财富行业板块近{days}个交易日主力资金净流入",
                    "points": points,
                }
            ],
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "fallback": True}), 503


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"AkShare Capital Flow API — version {ak.__version__}")
    app.run(host="0.0.0.0", port=5001, debug=True)
```

- [ ] **Step 3: Install Python deps and test**

```bash
cd server && pip install -r requirements.txt && python -c "import akshare; print('akshare', akshare.__version__)"
```

Expected: `akshare x.y.z` printed without error.

- [ ] **Step 4: Start Flask and test health endpoint**

```bash
cd server && python app.py &
curl http://localhost:5001/api/health
```

Expected: `{"status":"ok","akshare_version":"..."}`

- [ ] **Step 5: Commit**

```bash
git add server/ && git commit -m "feat: add Flask backend with AkShare capital flow API"
```

---

### Task 2: Add Vite proxy + startup scripts

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Update `vite.config.ts`**

Add `server.proxy` config:

```typescript
/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = {
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    exclude: ["node_modules", "dist", ".worktrees/**", "tests/e2e/**"],
  },
};

export default defineConfig(config);
```

- [ ] **Step 2: Add scripts to `package.json`**

Add `concurrently` to devDependencies and two scripts:

```bash
npm install --save-dev concurrently
```

Add to `package.json` scripts:
```json
"dev:full": "concurrently \"npm run dev\" \"cd server && python app.py\"",
"dev:backend": "cd server && python app.py"
```

- [ ] **Step 3: Run `npm run build` to verify no regressions**

Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json package-lock.json && git commit -m "feat: add Vite proxy to Flask backend and dev:full script"
```

---

### Task 3: Create frontend AkShareDataProvider

**Files:**
- Create: `src/data/akShareDataProvider.ts`
- Create: `src/data/akShareDataProvider.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/data/akShareDataProvider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAkShareDataProvider } from "./akShareDataProvider";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("akShareDataProvider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns realtime scenario from API response", async () => {
    const apiResponse = {
      date: "2026-06-12",
      source: "eastmoney",
      points: [
        { sectorId: "optical-modules", sectorName: "光模块", netInflow: 45.2, pctChange: 3.1 },
        { sectorId: "data-centers", sectorName: "算力", netInflow: -12.5, pctChange: -0.8 },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    });

    const provider = createAkShareDataProvider();
    const scenarios = provider.getScenarios();

    // getScenarios returns a function result — it fetches synchronously from cache
    // or returns mock fallback
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/capital-flow/realtime",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("falls back to mock data when API fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const provider = createAkShareDataProvider();
    // Should not throw — falls back gracefully
    const scenarios = provider.getScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back when response has fallback flag", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: "timeout", fallback: true }),
    });

    const provider = createAkShareDataProvider();
    const scenarios = provider.getScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(1);
  });

  it("maps API points to ScenarioPoint format", async () => {
    const apiResponse = {
      date: "2026-06-12",
      source: "eastmoney",
      points: [
        { sectorId: "optical-modules", sectorName: "光模块", netInflow: 45.2, pctChange: 3.1 },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    });

    const provider = createAkShareDataProvider();
    const scenarios = provider.getScenarios();
    const scenario = scenarios[0];

    // Scenario should have standard MarketScenario shape
    expect(scenario).toHaveProperty("id");
    expect(scenario).toHaveProperty("label");
    expect(scenario).toHaveProperty("story");
    expect(scenario).toHaveProperty("points");
    expect(scenario.points[0]).toHaveProperty("sectorId", "optical-modules");
    expect(scenario.points[0]).toHaveProperty("netInflow", 45.2);
  });

  it("checks health endpoint to detect backend availability", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "ok", akshare_version: "1.16" }),
    });

    const provider = createAkShareDataProvider();
    const available = await provider.isAvailable();
    expect(available).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/data/akShareDataProvider.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/data/akShareDataProvider.ts`**

```typescript
import type { DataProvider, MarketScenario, ReadonlyNonEmptyArray } from "../domain/types";
import { createScenarioDataProvider } from "../domain/scenarioDataProvider";

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
  error?: string;
}

interface HistoryResponse {
  indicator?: string;
  source?: string;
  scenarios?: Array<{
    id: string;
    label: string;
    story: string;
    points: ApiPoint[];
  }>;
  fallback?: boolean;
}

const FALLBACK_PROVIDER = createScenarioDataProvider();

/**
 * Create a DataProvider that fetches real capital flow data from the Flask API.
 * Falls back to mock data if the API is unavailable.
 */
export function createAkShareDataProvider(): DataProvider & { isAvailable(): Promise<boolean> } {
  let cachedScenarios: MarketScenario[] | null = null;
  let fetchPromise: Promise<MarketScenario[]> | null = null;

  async function isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("/api/health", { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async function fetchRealtimeScenarios(): Promise<MarketScenario[]> {
    if (cachedScenarios) return cachedScenarios;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch("/api/capital-flow/realtime", { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          return FALLBACK_PROVIDER.getScenarios();
        }

        const data: ApiResponse = await res.json();
        if (data.fallback || !data.points) {
          return FALLBACK_PROVIDER.getScenarios();
        }

        const scenario: MarketScenario = {
          id: `realtime-${data.date ?? "today"}`,
          label: `实时 ${data.date ?? ""}`,
          story: "东方财富行业板块主力资金实时净流入",
          points: data.points.map((p) => ({
            sectorId: p.sectorId,
            netInflow: p.netInflow,
          })),
        };

        cachedScenarios = [scenario];
        return cachedScenarios;
      } catch {
        return FALLBACK_PROVIDER.getScenarios();
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }

  // Start fetching immediately
  fetchRealtimeScenarios().catch(() => {});

  return {
    getScenarios: (): ReadonlyNonEmptyArray<MarketScenario> => {
      if (cachedScenarios) {
        return cachedScenarios as unknown as ReadonlyNonEmptyArray<MarketScenario>;
      }
      // Still loading — return mock as temporary fallback
      return FALLBACK_PROVIDER.getScenarios();
    },
    isAvailable,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/data/akShareDataProvider.test.ts
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Run all tests to verify no regressions**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/data/ && git commit -m "feat: add AkShareDataProvider with auto-fallback to mock"
```

---

### Task 4: Integrate AkShareDataProvider into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx imports and provider logic**

At the top of App.tsx, add import:

```typescript
import { createAkShareDataProvider } from "./data/akShareDataProvider";
```

Replace the `dataProvider` and `scenarios` lines (currently lines 17-19):

```typescript
const dataProvider = createAkShareDataProvider();
const scenarios = dataProvider.getScenarios();
const scenarioIds = getScenarioIds(scenarios);
```

This is a drop-in replacement — `DataProvider` interface is the same, so no downstream changes needed.

The auto-fallback is built in: if the API is unavailable, `getScenarios()` returns mock data.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (including existing App.test.tsx)

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx && git commit -m "feat: wire AkShareDataProvider into App with auto-fallback"
```

---

### Task 5: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Start both services**

```bash
npm run dev:full
```

- [ ] **Step 2: Verify health endpoint**

```bash
curl http://localhost:5173/api/health
```

Expected: `{"status":"ok","akshare_version":"..."}` — proves proxy works.

- [ ] **Step 3: Verify realtime endpoint**

```bash
curl http://localhost:5173/api/capital-flow/realtime
```

Expected: JSON with `points` array containing `{sectorId, netInflow}` objects.

- [ ] **Step 4: Open browser http://localhost:5173**

Expected: App loads with real data (if market day) or mock fallback (if API error).

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run && npm run build
```

Expected: All tests pass, build succeeds.
