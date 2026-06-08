import type { RelationshipEdge, Sector } from "./types";

const edge = (
  sourceSectorId: string,
  targetSectorId: string,
  type: RelationshipEdge["type"],
  weight: number,
  note: string
): Readonly<RelationshipEdge> =>
  Object.freeze({ sourceSectorId, targetSectorId, type, weight, note });

export const relationshipEdges: readonly RelationshipEdge[] = Object.freeze([
  edge("ai-computing", "optical-modules", "industrial-chain", 0.95, "AI数据中心高速互联"),
  edge("ai-computing", "cpo", "industrial-chain", 0.9, "光互联技术共振"),
  edge("ai-computing", "liquid-cooled-servers", "industrial-chain", 0.82, "高功耗算力散热"),
  edge("ai-computing", "domestic-computing", "industrial-chain", 0.78, "国产算力替代"),
  edge("ai-computing", "data-centers", "industrial-chain", 0.8, "算力基础设施"),
  edge("optical-modules", "cpo", "market-comovement", 0.88, "光通信分支联动"),
  edge("data-centers", "liquid-cooled-servers", "industrial-chain", 0.76, "数据中心和液冷配套"),
  edge("ai-computing", "semiconductors", "market-comovement", 0.72, "AI拉动半导体景气"),
  edge("domestic-computing", "chip-design", "industrial-chain", 0.74, "国产芯片设计支撑算力"),
  edge("cpo", "advanced-packaging", "market-comovement", 0.56, "高速封装叙事交叉"),

  edge("robotics-physical-ai", "reducers", "industrial-chain", 0.9, "机器人关节核心部件"),
  edge("robotics-physical-ai", "servo-systems", "industrial-chain", 0.88, "机器人运动控制"),
  edge("robotics-physical-ai", "sensors", "industrial-chain", 0.82, "机器人感知层"),
  edge("robotics-physical-ai", "machine-vision", "industrial-chain", 0.8, "视觉感知"),
  edge("robotics-physical-ai", "actuators", "industrial-chain", 0.86, "执行层"),
  edge("sensors", "machine-vision", "market-comovement", 0.62, "感知链共振"),
  edge("servo-systems", "actuators", "industrial-chain", 0.7, "控制到执行"),
  edge("robotics-physical-ai", "ai-computing", "market-comovement", 0.66, "物理AI承接AI能力"),
  edge("sensors", "flight-control-systems", "industrial-chain", 0.55, "低空与机器人共用感知控制"),
  edge("machine-vision", "chip-design", "market-comovement", 0.48, "AI识别和芯片设计交叉"),

  edge("low-altitude-economy", "evtol", "industrial-chain", 0.95, "低空航空器核心载体"),
  edge("low-altitude-economy", "flight-control-systems", "industrial-chain", 0.9, "飞行控制系统"),
  edge("low-altitude-economy", "drones", "industrial-chain", 0.86, "成熟低空应用"),
  edge("low-altitude-economy", "general-aviation-operations", "industrial-chain", 0.76, "运营场景"),
  edge("low-altitude-economy", "air-traffic-systems", "industrial-chain", 0.78, "空域基础设施"),
  edge("evtol", "flight-control-systems", "industrial-chain", 0.82, "航空器控制系统"),
  edge("drones", "flight-control-systems", "industrial-chain", 0.72, "无人机飞控"),
  edge("air-traffic-systems", "satellite-internet", "market-comovement", 0.52, "低空通信和空管"),
  edge("evtol", "power-batteries", "industrial-chain", 0.58, "eVTOL电池需求"),
  edge("drones", "navigation-systems", "industrial-chain", 0.54, "无人机导航定位"),

  edge("semiconductors", "chip-design", "industrial-chain", 0.9, "半导体设计"),
  edge("semiconductors", "wafer-fabrication", "industrial-chain", 0.9, "晶圆制造"),
  edge("semiconductors", "semiconductor-equipment", "industrial-chain", 0.88, "制造装备"),
  edge("semiconductors", "photoresist", "industrial-chain", 0.82, "关键材料"),
  edge("semiconductors", "advanced-packaging", "industrial-chain", 0.78, "先进封装"),
  edge("wafer-fabrication", "semiconductor-equipment", "industrial-chain", 0.82, "设备驱动制造"),
  edge("photoresist", "wafer-fabrication", "industrial-chain", 0.72, "材料进入制造"),
  edge("advanced-packaging", "chip-design", "market-comovement", 0.55, "设计和封装协同"),
  edge("semiconductor-equipment", "defense-electronics", "market-comovement", 0.46, "自主可控硬科技"),

  edge("new-energy", "power-batteries", "industrial-chain", 0.9, "新能源核心储能部件"),
  edge("new-energy", "energy-storage", "industrial-chain", 0.86, "储能系统"),
  edge("new-energy", "photovoltaics", "industrial-chain", 0.84, "光伏发电"),
  edge("new-energy", "wind-power", "industrial-chain", 0.76, "风电发电"),
  edge("new-energy", "charging-infrastructure", "industrial-chain", 0.7, "补能基础设施"),
  edge("power-batteries", "energy-storage", "market-comovement", 0.78, "电池和储能联动"),
  edge("photovoltaics", "energy-storage", "industrial-chain", 0.68, "光储配套"),
  edge("wind-power", "energy-storage", "industrial-chain", 0.6, "风储配套"),
  edge("charging-infrastructure", "power-batteries", "market-comovement", 0.48, "新能源车链条"),

  edge("defense-aerospace", "commercial-aerospace", "industrial-chain", 0.9, "航天发射应用"),
  edge("defense-aerospace", "satellite-internet", "industrial-chain", 0.86, "卫星通信"),
  edge("defense-aerospace", "navigation-systems", "industrial-chain", 0.82, "导航定位"),
  edge("defense-aerospace", "aerospace-materials", "industrial-chain", 0.78, "高端材料"),
  edge("defense-aerospace", "defense-electronics", "industrial-chain", 0.84, "军工电子"),
  edge("commercial-aerospace", "satellite-internet", "industrial-chain", 0.76, "发射和卫星互联网"),
  edge("navigation-systems", "satellite-internet", "market-comovement", 0.62, "空间信息链"),
  edge("aerospace-materials", "advanced-packaging", "market-comovement", 0.42, "高端制造交叉"),

  edge("innovative-medicine", "innovative-drugs", "industrial-chain", 0.92, "创新药研发"),
  edge("innovative-medicine", "cro-cdmo", "industrial-chain", 0.86, "研发生产外包"),
  edge("innovative-medicine", "medical-devices", "industrial-chain", 0.72, "医疗科技"),
  edge("innovative-medicine", "synthetic-biology", "industrial-chain", 0.74, "生物制造"),
  edge("innovative-medicine", "traditional-chinese-medicine", "market-comovement", 0.5, "医药防御属性"),
  edge("innovative-drugs", "cro-cdmo", "industrial-chain", 0.82, "药物研发服务链"),
  edge("synthetic-biology", "innovative-drugs", "market-comovement", 0.58, "生物技术创新"),
  edge("medical-devices", "sensors", "market-comovement", 0.38, "精密感知器件交叉")
]);

export function validateRelationshipEdges(
  edges: readonly RelationshipEdge[],
  sectorList: readonly Pick<Sector, "id">[]
): { valid: boolean; errors: string[] } {
  const validSectorIds = new Set(sectorList.map((sector) => sector.id));
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const candidate of edges) {
    const key = `${candidate.sourceSectorId}->${candidate.targetSectorId}`;
    if (seen.has(key)) {
      errors.push(`Duplicate relationship edge ${key}`);
    }
    seen.add(key);

    if (!validSectorIds.has(candidate.sourceSectorId)) {
      errors.push(`Unknown source sector ${candidate.sourceSectorId}`);
    }
    if (!validSectorIds.has(candidate.targetSectorId)) {
      errors.push(`Unknown target sector ${candidate.targetSectorId}`);
    }
    if (!Number.isFinite(candidate.weight) || candidate.weight <= 0 || candidate.weight > 1) {
      errors.push(`Invalid relationship weight ${candidate.weight} for ${key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
