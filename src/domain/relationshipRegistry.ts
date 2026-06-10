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
  // ═══════════════════════════════════════════════════════════════════
  //  AI算力 — intra-theme (9 sectors → ~18 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("ai-computing", "optical-modules", "industrial-chain", 0.95, "AI数据中心高速互联"),
  edge("ai-computing", "cpo", "industrial-chain", 0.9, "光互联技术共振"),
  edge("ai-computing", "liquid-cooled-servers", "industrial-chain", 0.82, "高功耗算力散热"),
  edge("ai-computing", "domestic-computing", "industrial-chain", 0.78, "国产算力替代"),
  edge("ai-computing", "data-centers", "industrial-chain", 0.8, "算力基础设施"),
  edge("ai-computing", "ai-chip-design", "industrial-chain", 0.85, "AI芯片设计核心"),
  edge("ai-computing", "aigc", "industrial-chain", 0.76, "AIGC应用驱动算力需求"),
  edge("ai-computing", "ai-agent", "industrial-chain", 0.72, "AI Agent应用驱动算力"),
  edge("optical-modules", "cpo", "market-comovement", 0.88, "光通信分支联动"),
  edge("data-centers", "liquid-cooled-servers", "industrial-chain", 0.76, "数据中心和液冷配套"),
  edge("aigc", "ai-agent", "industrial-chain", 0.68, "AIGC与Agent应用层协同"),

  // ═══════════════════════════════════════════════════════════════════
  //  机器人 — intra-theme (8 sectors → ~16 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("robotics-physical-ai", "reducers", "industrial-chain", 0.9, "机器人关节核心部件"),
  edge("robotics-physical-ai", "servo-systems", "industrial-chain", 0.88, "机器人运动控制"),
  edge("robotics-physical-ai", "sensors", "industrial-chain", 0.82, "机器人感知层"),
  edge("robotics-physical-ai", "machine-vision", "industrial-chain", 0.8, "视觉感知"),
  edge("robotics-physical-ai", "actuators", "industrial-chain", 0.86, "执行层"),
  edge("robotics-physical-ai", "industrial-robotics", "industrial-chain", 0.78, "工业场景落地"),
  edge("robotics-physical-ai", "humanoid-robot", "industrial-chain", 0.84, "人形机器人整机集成"),
  edge("sensors", "machine-vision", "market-comovement", 0.62, "感知链共振"),
  edge("servo-systems", "actuators", "industrial-chain", 0.7, "控制到执行"),
  edge("industrial-robotics", "servo-systems", "industrial-chain", 0.66, "工业机器人伺服驱动"),
  edge("humanoid-robot", "sensors", "industrial-chain", 0.72, "人形机器人感知硬件"),

  // ═══════════════════════════════════════════════════════════════════
  //  低空经济 — intra-theme (7 sectors → ~13 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("low-altitude-economy", "evtol", "industrial-chain", 0.95, "低空航空器核心载体"),
  edge("low-altitude-economy", "flight-control-systems", "industrial-chain", 0.9, "飞行控制系统"),
  edge("low-altitude-economy", "drones", "industrial-chain", 0.86, "成熟低空应用"),
  edge("low-altitude-economy", "general-aviation-operations", "industrial-chain", 0.76, "运营场景"),
  edge("low-altitude-economy", "air-traffic-systems", "industrial-chain", 0.78, "空域基础设施"),
  edge("low-altitude-economy", "low-altitude-communication", "industrial-chain", 0.74, "低空通信基建"),
  edge("evtol", "flight-control-systems", "industrial-chain", 0.82, "航空器控制系统"),
  edge("drones", "flight-control-systems", "industrial-chain", 0.72, "无人机飞控"),
  edge("low-altitude-communication", "air-traffic-systems", "industrial-chain", 0.68, "通信支撑空域管理"),

  // ═══════════════════════════════════════════════════════════════════
  //  半导体 — intra-theme (8 sectors → ~16 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("semiconductors", "chip-design", "industrial-chain", 0.9, "半导体设计"),
  edge("semiconductors", "wafer-fabrication", "industrial-chain", 0.9, "晶圆制造"),
  edge("semiconductors", "semiconductor-equipment", "industrial-chain", 0.88, "制造装备"),
  edge("semiconductors", "photoresist", "industrial-chain", 0.82, "关键材料"),
  edge("semiconductors", "advanced-packaging", "industrial-chain", 0.78, "先进封装"),
  edge("semiconductors", "chiplet", "industrial-chain", 0.72, "Chiplet异构集成"),
  edge("semiconductors", "hbm", "industrial-chain", 0.76, "高带宽存储"),
  edge("wafer-fabrication", "semiconductor-equipment", "industrial-chain", 0.82, "设备驱动制造"),
  edge("photoresist", "wafer-fabrication", "industrial-chain", 0.72, "材料进入制造"),
  edge("advanced-packaging", "chiplet", "industrial-chain", 0.8, "Chiplet封装基础"),
  edge("hbm", "advanced-packaging", "industrial-chain", 0.78, "HBM依赖先进封装"),

  // ═══════════════════════════════════════════════════════════════════
  //  新能源 — intra-theme (7 sectors → ~12 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("new-energy", "power-batteries", "industrial-chain", 0.9, "新能源核心储能部件"),
  edge("new-energy", "energy-storage", "industrial-chain", 0.86, "储能系统"),
  edge("new-energy", "photovoltaics", "industrial-chain", 0.84, "光伏发电"),
  edge("new-energy", "wind-power", "industrial-chain", 0.76, "风电发电"),
  edge("new-energy", "charging-infrastructure", "industrial-chain", 0.7, "补能基础设施"),
  edge("new-energy", "solid-state-batteries", "industrial-chain", 0.72, "固态电池技术"),
  edge("power-batteries", "energy-storage", "market-comovement", 0.78, "电池和储能联动"),
  edge("photovoltaics", "energy-storage", "industrial-chain", 0.68, "光储配套"),
  edge("solid-state-batteries", "power-batteries", "industrial-chain", 0.74, "固态电池技术升级"),

  // ═══════════════════════════════════════════════════════════════════
  //  军工/商业航天 — intra-theme (7 sectors → ~12 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("defense-aerospace", "commercial-aerospace", "industrial-chain", 0.9, "航天发射应用"),
  edge("defense-aerospace", "satellite-internet", "industrial-chain", 0.86, "卫星通信"),
  edge("defense-aerospace", "navigation-systems", "industrial-chain", 0.82, "导航定位"),
  edge("defense-aerospace", "aerospace-materials", "industrial-chain", 0.78, "高端材料"),
  edge("defense-aerospace", "defense-electronics", "industrial-chain", 0.84, "军工电子"),
  edge("defense-aerospace", "defense-informatics", "industrial-chain", 0.76, "军工信息化"),
  edge("commercial-aerospace", "satellite-internet", "industrial-chain", 0.76, "发射和卫星互联网"),
  edge("navigation-systems", "satellite-internet", "market-comovement", 0.62, "空间信息链"),
  edge("defense-electronics", "defense-informatics", "industrial-chain", 0.7, "军工电子与信息化协同"),

  // ═══════════════════════════════════════════════════════════════════
  //  创新药/医药 — intra-theme (6 sectors → ~8 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("innovative-medicine", "innovative-drugs", "industrial-chain", 0.92, "创新药研发"),
  edge("innovative-medicine", "cro-cdmo", "industrial-chain", 0.86, "研发生产外包"),
  edge("innovative-medicine", "medical-devices", "industrial-chain", 0.72, "医疗科技"),
  edge("innovative-medicine", "synthetic-biology", "industrial-chain", 0.74, "生物制造"),
  edge("innovative-medicine", "traditional-chinese-medicine", "market-comovement", 0.5, "医药防御属性"),
  edge("innovative-drugs", "cro-cdmo", "industrial-chain", 0.82, "药物研发服务链"),
  edge("synthetic-biology", "innovative-drugs", "market-comovement", 0.58, "生物技术创新"),

  // ═══════════════════════════════════════════════════════════════════
  //  新能源汽车/智能驾驶 — intra-theme (8 sectors → ~14 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("new-energy-vehicles", "vehicle-manufacturing", "industrial-chain", 0.88, "整车制造"),
  edge("new-energy-vehicles", "electric-drive-systems", "industrial-chain", 0.86, "电驱动系统"),
  edge("new-energy-vehicles", "autonomous-driving", "industrial-chain", 0.84, "智能驾驶"),
  edge("new-energy-vehicles", "lidar", "industrial-chain", 0.76, "激光雷达"),
  edge("new-energy-vehicles", "automotive-chips", "industrial-chain", 0.78, "车规芯片"),
  edge("new-energy-vehicles", "smart-cockpit", "industrial-chain", 0.74, "智能座舱"),
  edge("new-energy-vehicles", "v2x-communication", "industrial-chain", 0.68, "V2X车联网"),
  edge("autonomous-driving", "lidar", "industrial-chain", 0.82, "智驾感知硬件"),
  edge("autonomous-driving", "automotive-chips", "industrial-chain", 0.78, "智驾计算芯片"),
  edge("electric-drive-systems", "vehicle-manufacturing", "industrial-chain", 0.72, "三电系统集成"),
  edge("lidar", "automotive-chips", "industrial-chain", 0.6, "雷达信号处理芯片"),

  // ═══════════════════════════════════════════════════════════════════
  //  消费电子/VR — intra-theme (7 sectors → ~13 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("consumer-electronics", "smartphones", "industrial-chain", 0.88, "核心终端设备"),
  edge("consumer-electronics", "vr-ar-devices", "industrial-chain", 0.78, "创新终端"),
  edge("consumer-electronics", "display-panels", "industrial-chain", 0.82, "核心显示组件"),
  edge("consumer-electronics", "acoustic-devices", "industrial-chain", 0.7, "声学组件"),
  edge("consumer-electronics", "optical-lenses", "industrial-chain", 0.72, "光学组件"),
  edge("consumer-electronics", "wearable-devices", "industrial-chain", 0.74, "可穿戴创新终端"),
  edge("smartphones", "display-panels", "industrial-chain", 0.76, "手机面板需求"),
  edge("smartphones", "optical-lenses", "industrial-chain", 0.64, "手机光学镜头"),
  edge("vr-ar-devices", "optical-lenses", "industrial-chain", 0.72, "VR光学模组"),
  edge("vr-ar-devices", "display-panels", "industrial-chain", 0.66, "VR显示需求"),

  // ═══════════════════════════════════════════════════════════════════
  //  数字经济/数据要素 — intra-theme (8 sectors → ~15 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("digital-economy", "data-elements", "industrial-chain", 0.82, "数据要素基础"),
  edge("digital-economy", "data-security", "industrial-chain", 0.76, "数据安全"),
  edge("digital-economy", "cloud-computing", "industrial-chain", 0.84, "云计算"),
  edge("digital-economy", "saas-enterprise-software", "industrial-chain", 0.72, "企业软件"),
  edge("digital-economy", "xinchuang", "industrial-chain", 0.8, "信创国产化"),
  edge("digital-economy", "os-database", "industrial-chain", 0.74, "操作系统/数据库"),
  edge("digital-economy", "cybersecurity", "industrial-chain", 0.72, "网络安全"),
  edge("data-elements", "data-security", "industrial-chain", 0.7, "数据确权与安全"),
  edge("cloud-computing", "saas-enterprise-software", "industrial-chain", 0.72, "SaaS云化部署"),
  edge("xinchuang", "os-database", "industrial-chain", 0.82, "信创基础软件"),

  // ═══════════════════════════════════════════════════════════════════
  //  金融科技 — intra-theme (6 sectors → ~9 edges)
  // ═══════════════════════════════════════════════════════════════════
  edge("fintech", "brokerage-it", "industrial-chain", 0.84, "券商IT"),
  edge("fintech", "payment-systems", "industrial-chain", 0.8, "支付系统"),
  edge("fintech", "digital-currency", "industrial-chain", 0.76, "数字货币"),
  edge("fintech", "financial-ai", "industrial-chain", 0.82, "金融AI"),
  edge("fintech", "insurance-tech", "industrial-chain", 0.7, "保险科技"),
  edge("payment-systems", "digital-currency", "market-comovement", 0.62, "支付与数字货币"),
  edge("financial-ai", "brokerage-it", "industrial-chain", 0.66, "AI赋能券商"),

  // ═══════════════════════════════════════════════════════════════════
  //  CROSS-THEME EDGES — 55 theme pairs, 1-3 edges each
  // ═══════════════════════════════════════════════════════════════════

  // ── ai-computing <-> robotics-physical-ai ──
  edge("robotics-physical-ai", "ai-computing", "market-comovement", 0.66, "物理AI承接AI能力"),
  edge("ai-agent", "humanoid-robot", "industrial-chain", 0.58, "AI Agent驱动机器人智能"),

  // ── ai-computing <-> low-altitude-economy ──
  edge("ai-computing", "low-altitude-economy", "capital-flow", 0.42, "AI算力资金外溢低空"),

  // ── ai-computing <-> semiconductors ──
  edge("ai-computing", "semiconductors", "market-comovement", 0.72, "AI拉动半导体景气"),
  edge("hbm", "ai-computing", "industrial-chain", 0.82, "AI算力HBM内存核心"),
  edge("cpo", "advanced-packaging", "market-comovement", 0.56, "高速封装叙事交叉"),

  // ── ai-computing <-> new-energy ──
  edge("liquid-cooled-servers", "energy-storage", "industrial-chain", 0.42, "液冷与储能温控"),

  // ── ai-computing <-> defense-aerospace ──
  edge("ai-chip-design", "defense-electronics", "industrial-chain", 0.52, "国产AI芯片军用"),
  edge("ai-computing", "defense-informatics", "capital-flow", 0.46, "军工信息化AI投入"),

  // ── ai-computing <-> innovative-medicine ──
  edge("ai-computing", "innovative-medicine", "heat-correction", 0.3, "科技 vs 防御资金跷跷板"),

  // ── ai-computing <-> new-energy-vehicles ──
  edge("ai-computing", "autonomous-driving", "industrial-chain", 0.68, "AI算力支撑智驾"),
  edge("ai-chip-design", "automotive-chips", "industrial-chain", 0.58, "AI芯片与车规芯片交叉"),

  // ── ai-computing <-> consumer-electronics ──
  edge("ai-computing", "consumer-electronics", "capital-flow", 0.58, "AI终端叙事切换"),

  // ── ai-computing <-> digital-economy ──
  edge("cloud-computing", "ai-computing", "industrial-chain", 0.78, "算力基础设施层"),
  edge("xinchuang", "domestic-computing", "policy-linkage", 0.52, "自主可控政策驱动"),

  // ── ai-computing <-> fintech ──
  edge("ai-computing", "financial-ai", "industrial-chain", 0.62, "金融AI算力基础"),

  // ── robotics-physical-ai <-> low-altitude-economy ──
  edge("sensors", "low-altitude-communication", "industrial-chain", 0.5, "低空感知通信共用"),

  // ── robotics-physical-ai <-> semiconductors ──
  edge("semiconductor-equipment", "defense-electronics", "market-comovement", 0.46, "自主可控硬科技"),
  edge("sensors", "chip-design", "market-comovement", 0.4, "传感器芯片需求"),

  // ── robotics-physical-ai <-> new-energy ──
  edge("industrial-robotics", "photovoltaics", "industrial-chain", 0.32, "机器人光伏产线自动化"),

  // ── robotics-physical-ai <-> defense-aerospace ──
  edge("robotics-physical-ai", "defense-aerospace", "industrial-chain", 0.52, "军用机器人"),

  // ── robotics-physical-ai <-> innovative-medicine ──
  edge("sensors", "medical-devices", "industrial-chain", 0.46, "医疗传感器共用"),
  edge("machine-vision", "medical-devices", "industrial-chain", 0.4, "视觉诊断交叉"),

  // ── robotics-physical-ai <-> new-energy-vehicles ──
  edge("sensors", "lidar", "industrial-chain", 0.54, "感知器件交叉"),

  // ── robotics-physical-ai <-> consumer-electronics ──
  edge("sensors", "wearable-devices", "industrial-chain", 0.44, "穿戴传感器需求"),

  // ── robotics-physical-ai <-> digital-economy ──
  edge("robotics-physical-ai", "saas-enterprise-software", "industrial-chain", 0.38, "机器人工业软件需求"),

  // ── robotics-physical-ai <-> fintech ──
  edge("humanoid-robot", "financial-ai", "market-comovement", 0.34, "机器人+金融AI叙事"),

  // ── low-altitude-economy <-> semiconductors ──
  edge("low-altitude-communication", "semiconductors", "industrial-chain", 0.46, "低空射频芯片"),

  // ── low-altitude-economy <-> new-energy ──
  edge("evtol", "power-batteries", "industrial-chain", 0.58, "eVTOL电池需求"),
  edge("evtol", "energy-storage", "industrial-chain", 0.52, "eVTOL储能需求"),

  // ── low-altitude-economy <-> defense-aerospace ──
  edge("air-traffic-systems", "satellite-internet", "market-comovement", 0.52, "低空通信和空管"),

  // ── low-altitude-economy <-> innovative-medicine ──
  edge("drones", "medical-devices", "industrial-chain", 0.36, "无人机医疗配送"),

  // ── low-altitude-economy <-> new-energy-vehicles ──
  edge("low-altitude-economy", "new-energy-vehicles", "policy-linkage", 0.44, "新能源产业政策协同"),

  // ── low-altitude-economy <-> consumer-electronics ──
  edge("drones", "optical-lenses", "industrial-chain", 0.44, "无人机光学镜头"),

  // ── low-altitude-economy <-> digital-economy ──
  edge("air-traffic-systems", "data-elements", "industrial-chain", 0.42, "空管数据要素"),

  // ── low-altitude-economy <-> fintech ──
  edge("drones", "insurance-tech", "market-comovement", 0.3, "无人机保险场景"),

  // ── semiconductors <-> new-energy ──
  edge("photovoltaics", "chip-design", "industrial-chain", 0.44, "光伏芯片工艺交叉"),

  // ── semiconductors <-> defense-aerospace ──
  edge("semiconductors", "defense-aerospace", "policy-linkage", 0.52, "自主可控半导体政策"),
  edge("chiplet", "defense-electronics", "industrial-chain", 0.46, "军用Chiplet封装"),
  edge("aerospace-materials", "advanced-packaging", "market-comovement", 0.42, "高端制造交叉"),

  // ── semiconductors <-> innovative-medicine ──
  edge("chip-design", "medical-devices", "industrial-chain", 0.42, "医疗芯片设计"),

  // ── semiconductors <-> new-energy-vehicles ──
  edge("semiconductors", "new-energy-vehicles", "industrial-chain", 0.58, "车载芯片需求"),
  edge("chip-design", "automotive-chips", "industrial-chain", 0.6, "车规芯片设计"),

  // ── semiconductors <-> consumer-electronics ──
  edge("semiconductors", "consumer-electronics", "industrial-chain", 0.62, "芯片终端需求"),

  // ── semiconductors <-> digital-economy ──
  edge("xinchuang", "chip-design", "industrial-chain", 0.58, "信创国产芯片"),

  // ── semiconductors <-> fintech ──
  edge("chip-design", "payment-systems", "industrial-chain", 0.38, "支付安全芯片"),

  // ── new-energy <-> defense-aerospace ──
  edge("energy-storage", "defense-electronics", "industrial-chain", 0.36, "军工储能需求"),

  // ── new-energy <-> innovative-medicine ──
  edge("synthetic-biology", "energy-storage", "market-comovement", 0.38, "生物制造储能交叉"),

  // ── new-energy <-> new-energy-vehicles ──
  edge("new-energy", "new-energy-vehicles", "industrial-chain", 0.72, "电池共用产业链"),
  edge("charging-infrastructure", "power-batteries", "market-comovement", 0.48, "新能源车链条"),
  edge("solid-state-batteries", "charging-infrastructure", "policy-linkage", 0.42, "固态电池新能源车政策"),

  // ── new-energy <-> consumer-electronics ──
  edge("power-batteries", "wearable-devices", "industrial-chain", 0.42, "穿戴设备电池"),

  // ── new-energy <-> digital-economy ──
  edge("data-centers", "photovoltaics", "industrial-chain", 0.42, "数据中心光伏供电"),
  edge("energy-storage", "data-elements", "industrial-chain", 0.38, "储能数据要素"),

  // ── new-energy <-> fintech ──
  edge("energy-storage", "insurance-tech", "market-comovement", 0.32, "储能保险场景"),

  // ── defense-aerospace <-> innovative-medicine ──
  edge("aerospace-materials", "medical-devices", "industrial-chain", 0.38, "高端材料医疗交叉"),

  // ── defense-aerospace <-> new-energy-vehicles ──
  edge("navigation-systems", "autonomous-driving", "industrial-chain", 0.52, "导航定位智驾共用"),

  // ── defense-aerospace <-> consumer-electronics ──
  edge("defense-aerospace", "consumer-electronics", "capital-flow", 0.36, "军工-消费资金轮动"),

  // ── defense-aerospace <-> digital-economy ──
  edge("defense-informatics", "digital-economy", "industrial-chain", 0.52, "军工信息化与数字经济"),

  // ── defense-aerospace <-> fintech ──
  edge("defense-informatics", "digital-currency", "market-comovement", 0.32, "军工信息化支付安全"),

  // ── innovative-medicine <-> new-energy-vehicles ──
  edge("innovative-medicine", "new-energy-vehicles", "capital-flow", 0.38, "医药-新能源车资金轮动"),

  // ── innovative-medicine <-> consumer-electronics ──
  edge("innovative-medicine", "consumer-electronics", "industrial-chain", 0.42, "医疗设备电子化"),

  // ── innovative-medicine <-> digital-economy ──
  edge("innovative-medicine", "digital-economy", "industrial-chain", 0.46, "医疗信息化"),

  // ── innovative-medicine <-> fintech ──
  edge("innovative-medicine", "fintech", "capital-flow", 0.42, "防御-进攻风格切换"),

  // ── new-energy-vehicles <-> consumer-electronics ──
  edge("new-energy-vehicles", "consumer-electronics", "industrial-chain", 0.52, "车载消费电子共用"),
  edge("smart-cockpit", "display-panels", "industrial-chain", 0.58, "座舱显示面板"),

  // ── new-energy-vehicles <-> digital-economy ──
  edge("v2x-communication", "data-elements", "industrial-chain", 0.44, "V2X数据要素"),

  // ── new-energy-vehicles <-> fintech ──
  edge("payment-systems", "v2x-communication", "industrial-chain", 0.38, "车联网支付场景"),

  // ── consumer-electronics <-> digital-economy ──
  edge("smartphones", "data-elements", "industrial-chain", 0.48, "手机数据要素"),

  // ── consumer-electronics <-> fintech ──
  edge("smartphones", "brokerage-it", "industrial-chain", 0.44, "手机券商交易"),

  // ── digital-economy <-> fintech ──
  edge("digital-economy", "fintech", "industrial-chain", 0.56, "数字经济金融基础设施"),
  edge("data-security", "brokerage-it", "industrial-chain", 0.46, "券商数据安全"),

  // ═══════════════════════════════════════════════════════════════════
  //  Additional heat-correction edges (opposing sectors)
  // ═══════════════════════════════════════════════════════════════════
  edge("new-energy-vehicles", "innovative-medicine", "heat-correction", 0.28, "新能源车 vs 医药跷跷板"),
  edge("defense-aerospace", "fintech", "heat-correction", 0.26, "军工 vs 金融风格跷跷板"),
  edge("semiconductors", "traditional-chinese-medicine", "heat-correction", 0.24, "进攻 vs 防御极值"),
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
