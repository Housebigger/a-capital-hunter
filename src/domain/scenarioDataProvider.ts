import type { DataProvider, MarketScenario, SectorId } from "./types";

interface ScenarioSeed {
  readonly id: string;
  readonly label: string;
  readonly story: string;
  readonly values: Readonly<Record<SectorId, number>>;
}

const valuesByScenario: readonly ScenarioSeed[] = Object.freeze([
  {
    id: "t1",
    label: "T1 AI算力主升",
    story: "AI算力领涨，光模块、CPO、液冷服务器共振。",
    values: Object.freeze({
      "ai-computing": 160,
      "optical-modules": 138,
      cpo: 126,
      "liquid-cooled-servers": 88,
      "domestic-computing": 74,
      "data-centers": 58,
      "robotics-physical-ai": 36,
      reducers: 18,
      "servo-systems": 16,
      sensors: 12,
      "machine-vision": 30,
      actuators: 8,
      "low-altitude-economy": -22,
      evtol: -16,
      "flight-control-systems": -12,
      drones: -20,
      "general-aviation-operations": -18,
      "air-traffic-systems": -10
    })
  },
  {
    id: "t2",
    label: "T2 机器人接力",
    story: "AI高位分歧，机器人（物理AI）开始成为新主峰。",
    values: Object.freeze({
      "ai-computing": 42,
      "optical-modules": -18,
      cpo: -26,
      "liquid-cooled-servers": 12,
      "domestic-computing": 24,
      "data-centers": 8,
      "robotics-physical-ai": 145,
      reducers: 118,
      "servo-systems": 104,
      sensors: 76,
      "machine-vision": 92,
      actuators: 64,
      "low-altitude-economy": 18,
      evtol: 22,
      "flight-control-systems": 26,
      drones: 10,
      "general-aviation-operations": 6,
      "air-traffic-systems": 4
    })
  },
  {
    id: "t3",
    label: "T3 机器人扩散",
    story: "机器人扩散到传感器和机器视觉，低空经济开始回流。",
    values: Object.freeze({
      "ai-computing": -34,
      "optical-modules": -46,
      cpo: -38,
      "liquid-cooled-servers": -12,
      "domestic-computing": 8,
      "data-centers": -18,
      "robotics-physical-ai": 98,
      reducers: 72,
      "servo-systems": 84,
      sensors: 112,
      "machine-vision": 126,
      actuators: 68,
      "low-altitude-economy": 70,
      evtol: 64,
      "flight-control-systems": 58,
      drones: 46,
      "general-aviation-operations": 34,
      "air-traffic-systems": 28
    })
  },
  {
    id: "t4",
    label: "T4 低空经济主升",
    story: "低空经济成为主峰，AI与机器人部分流出或震荡。",
    values: Object.freeze({
      "ai-computing": -58,
      "optical-modules": -62,
      cpo: -50,
      "liquid-cooled-servers": -24,
      "domestic-computing": -18,
      "data-centers": -30,
      "robotics-physical-ai": 16,
      reducers: -14,
      "servo-systems": 8,
      sensors: 22,
      "machine-vision": 18,
      actuators: -8,
      "low-altitude-economy": 152,
      evtol: 132,
      "flight-control-systems": 118,
      drones: 104,
      "general-aviation-operations": 82,
      "air-traffic-systems": 76
    })
  }
]);

const createScenario = (scenario: ScenarioSeed): MarketScenario => ({
  id: scenario.id,
  label: scenario.label,
  story: scenario.story,
  points: Object.entries(scenario.values).map(([sectorId, netInflow]) => ({
    sectorId: sectorId as SectorId,
    netInflow
  }))
});

export function createMockScenarioDataProvider(): DataProvider {
  return {
    getScenarios: () => valuesByScenario.map(createScenario)
  };
}
