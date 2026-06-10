import type { SubTheme } from "./types";

const freezeSubTheme = (st: SubTheme): Readonly<SubTheme> => Object.freeze(st);

const subThemeConfig = [
  // AI算力 (3)
  { id: "ai-computing-infra", name: "算力基础设施", shortName: "算力基建", themeId: "ai-computing", displayOrder: 1, primarySectorId: "optical-modules", areaWeight: 0.90 },
  { id: "domestic-substitution", name: "国产替代", shortName: "国产替代", themeId: "ai-computing", displayOrder: 2, primarySectorId: "domestic-computing", areaWeight: 0.70 },
  { id: "ai-applications", name: "AI应用", shortName: "AI应用", themeId: "ai-computing", displayOrder: 3, primarySectorId: "aigc", areaWeight: 0.80 },
  // 机器人/物理AI (3)
  { id: "core-components", name: "核心零部件", shortName: "核心零部件", themeId: "robotics-physical-ai", displayOrder: 1, primarySectorId: "reducers", areaWeight: 0.75 },
  { id: "perception-layer", name: "感知层", shortName: "感知层", themeId: "robotics-physical-ai", displayOrder: 2, primarySectorId: "sensors", areaWeight: 0.60 },
  { id: "application-scenarios", name: "应用场景", shortName: "应用场景", themeId: "robotics-physical-ai", displayOrder: 3, primarySectorId: "industrial-robotics", areaWeight: 0.65 },
  // 低空经济 (2)
  { id: "aircraft-control", name: "航空器与控制", shortName: "航空器控制", themeId: "low-altitude-economy", displayOrder: 1, primarySectorId: "evtol", areaWeight: 0.70 },
  { id: "operations-infra", name: "运营与基础设施", shortName: "运营基建", themeId: "low-altitude-economy", displayOrder: 2, primarySectorId: "general-aviation-operations", areaWeight: 0.45 },
  // 半导体 (3)
  { id: "design-manufacturing", name: "设计与制造", shortName: "设计制造", themeId: "semiconductors", displayOrder: 1, primarySectorId: "chip-design", areaWeight: 0.85 },
  { id: "equipment-materials", name: "设备与材料", shortName: "设备材料", themeId: "semiconductors", displayOrder: 2, primarySectorId: "semiconductor-equipment", areaWeight: 0.65 },
  { id: "advanced-packaging-st", name: "先进封装", shortName: "先进封装", themeId: "semiconductors", displayOrder: 3, primarySectorId: "advanced-packaging", areaWeight: 0.60 },
  // 新能源 (3)
  { id: "power-generation", name: "发电", shortName: "发电", themeId: "new-energy", displayOrder: 1, primarySectorId: "photovoltaics", areaWeight: 0.70 },
  { id: "storage-battery", name: "储能与电池", shortName: "储能电池", themeId: "new-energy", displayOrder: 2, primarySectorId: "energy-storage", areaWeight: 0.75 },
  { id: "charging-infra", name: "补能设施", shortName: "补能设施", themeId: "new-energy", displayOrder: 3, primarySectorId: "charging-infrastructure", areaWeight: 0.40 },
  // 军工/商业航天 (3)
  { id: "launch-communication", name: "航天发射与通信", shortName: "航天通信", themeId: "defense-aerospace", displayOrder: 1, primarySectorId: "commercial-aerospace", areaWeight: 0.60 },
  { id: "navigation-electronics", name: "导航与电子", shortName: "导航电子", themeId: "defense-aerospace", displayOrder: 2, primarySectorId: "navigation-systems", areaWeight: 0.55 },
  { id: "materials-equipment", name: "材料与装备", shortName: "材料装备", themeId: "defense-aerospace", displayOrder: 3, primarySectorId: "aerospace-materials", areaWeight: 0.45 },
  // 创新药/医药 (3)
  { id: "drug-rd", name: "药物研发", shortName: "药物研发", themeId: "innovative-medicine", displayOrder: 1, primarySectorId: "innovative-drugs", areaWeight: 0.65 },
  { id: "device-biology", name: "器械与生物", shortName: "器械生物", themeId: "innovative-medicine", displayOrder: 2, primarySectorId: "medical-devices", areaWeight: 0.55 },
  { id: "traditional-medicine", name: "传统医药", shortName: "传统医药", themeId: "innovative-medicine", displayOrder: 3, primarySectorId: "traditional-chinese-medicine", areaWeight: 0.35 },
  // 新能源汽车/智能驾驶 (3)
  { id: "vehicle-powertrain", name: "整车与三电", shortName: "整车三电", themeId: "new-energy-vehicles", displayOrder: 1, primarySectorId: "vehicle-manufacturing", areaWeight: 0.80 },
  { id: "autonomous-driving-st", name: "智能驾驶", shortName: "智能驾驶", themeId: "new-energy-vehicles", displayOrder: 2, primarySectorId: "autonomous-driving", areaWeight: 0.85 },
  { id: "v2x", name: "车联网", shortName: "车联网", themeId: "new-energy-vehicles", displayOrder: 3, primarySectorId: "v2x-communication", areaWeight: 0.50 },
  // 消费电子/VR (2)
  { id: "terminal-devices", name: "终端设备", shortName: "终端设备", themeId: "consumer-electronics", displayOrder: 1, primarySectorId: "smartphones", areaWeight: 0.65 },
  { id: "core-components-ce", name: "核心零部件", shortName: "核心零部件", themeId: "consumer-electronics", displayOrder: 2, primarySectorId: "display-panels", areaWeight: 0.55 },
  // 数字经济/数据要素 (3)
  { id: "data-elements-st", name: "数据要素", shortName: "数据要素", themeId: "digital-economy", displayOrder: 1, primarySectorId: "data-elements", areaWeight: 0.70 },
  { id: "cloud-software", name: "云计算与软件", shortName: "云计算", themeId: "digital-economy", displayOrder: 2, primarySectorId: "cloud-computing", areaWeight: 0.60 },
  { id: "xinchuang", name: "信创", shortName: "信创", themeId: "digital-economy", displayOrder: 3, primarySectorId: "xinchuang", areaWeight: 0.65 },
  // 金融科技 (2)
  { id: "fin-infra", name: "金融基础设施", shortName: "金融基建", themeId: "fintech", displayOrder: 1, primarySectorId: "brokerage-it", areaWeight: 0.55 },
  { id: "fin-applications", name: "金融应用", shortName: "金融应用", themeId: "fintech", displayOrder: 2, primarySectorId: "payment-systems", areaWeight: 0.50 }
] satisfies readonly SubTheme[];

export const subThemes: readonly Readonly<SubTheme>[] = Object.freeze(subThemeConfig.map(freezeSubTheme));