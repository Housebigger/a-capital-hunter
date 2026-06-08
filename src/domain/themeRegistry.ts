import type { Sector, Theme } from "./types";

const freezeTheme = (theme: Theme): Readonly<Theme> => Object.freeze(theme);

const freezeSector = (sector: Sector): Readonly<Sector> =>
  Object.freeze({
    ...sector,
    relatedThemeIds: Object.freeze([...sector.relatedThemeIds]),
    aliases: Object.freeze([...sector.aliases])
  });

const themeConfig = [
  { id: "ai-computing", name: "AI算力", shortName: "AI算力", color: "#d94a45" },
  { id: "robotics-physical-ai", name: "机器人（物理AI）", shortName: "机器人", color: "#d89a38" },
  { id: "low-altitude-economy", name: "低空经济", shortName: "低空经济", color: "#3b82c4" },
  { id: "semiconductors", name: "半导体", shortName: "半导体", color: "#b86adf" },
  { id: "new-energy", name: "新能源", shortName: "新能源", color: "#3aa66a" },
  { id: "defense-aerospace", name: "军工/商业航天", shortName: "军工航天", color: "#7f91a6" },
  { id: "innovative-medicine", name: "创新药/医药", shortName: "创新药", color: "#d86f8d" }
] satisfies readonly Theme[];

export const themes: readonly Readonly<Theme>[] = Object.freeze(themeConfig.map(freezeTheme));

const sectorConfig = [
  {
    id: "ai-computing",
    name: "AI算力",
    shortName: "AI算力",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["人工智能算力", "算力主线"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "AI主线核心，承接大模型训练和推理需求。"
  },
  {
    id: "optical-modules",
    name: "光模块",
    shortName: "光模块",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["高速光模块"],
    industrialChainRole: "算力互联",
    isThemeCenter: false,
    relationshipNote: "AI数据中心高速互联的核心环节，常与算力主线共振。"
  },
  {
    id: "cpo",
    name: "CPO",
    shortName: "CPO",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["共封装光学"],
    industrialChainRole: "光互联技术",
    isThemeCenter: false,
    relationshipNote: "光互联技术分支，靠近光模块和AI算力。"
  },
  {
    id: "liquid-cooled-servers",
    name: "液冷服务器",
    shortName: "液冷",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["服务器液冷"],
    industrialChainRole: "算力基础设施",
    isThemeCenter: false,
    relationshipNote: "高功耗算力基础设施的散热分支。"
  },
  {
    id: "domestic-computing",
    name: "国产算力",
    shortName: "国产算力",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["国产AI芯片", "信创算力"],
    industrialChainRole: "国产替代",
    isThemeCenter: false,
    relationshipNote: "国产替代与AI算力需求叠加。"
  },
  {
    id: "data-centers",
    name: "数据中心",
    shortName: "数据中心",
    primaryThemeId: "ai-computing",
    relatedThemeIds: ["ai-computing"],
    aliases: ["IDC"],
    industrialChainRole: "算力载体",
    isThemeCenter: false,
    relationshipNote: "AI算力落地的基础设施载体。"
  },
  {
    id: "robotics-physical-ai",
    name: "机器人（物理AI）",
    shortName: "机器人",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai", "ai-computing"],
    aliases: ["物理AI", "人形机器人"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "AI能力向物理世界延伸的核心主线。"
  },
  {
    id: "reducers",
    name: "减速器",
    shortName: "减速器",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai"],
    aliases: ["谐波减速器"],
    industrialChainRole: "运动控制",
    isThemeCenter: false,
    relationshipNote: "机器人运动控制核心零部件。"
  },
  {
    id: "servo-systems",
    name: "伺服系统",
    shortName: "伺服",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai"],
    aliases: ["伺服电机"],
    industrialChainRole: "运动控制",
    isThemeCenter: false,
    relationshipNote: "机器人执行控制的重要分支。"
  },
  {
    id: "sensors",
    name: "传感器",
    shortName: "传感器",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai", "low-altitude-economy"],
    aliases: ["感知硬件"],
    industrialChainRole: "感知层",
    isThemeCenter: false,
    relationshipNote: "机器人和低空设备感知层的共用环节。"
  },
  {
    id: "machine-vision",
    name: "机器视觉",
    shortName: "机器视觉",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai", "ai-computing"],
    aliases: ["工业视觉"],
    industrialChainRole: "感知算法",
    isThemeCenter: false,
    relationshipNote: "AI识别能力和机器人感知能力的交叉分支。"
  },
  {
    id: "actuators",
    name: "执行器",
    shortName: "执行器",
    primaryThemeId: "robotics-physical-ai",
    relatedThemeIds: ["robotics-physical-ai"],
    aliases: ["线性执行器"],
    industrialChainRole: "执行层",
    isThemeCenter: false,
    relationshipNote: "机器人末端动作和关节控制的关键部件。"
  },
  {
    id: "low-altitude-economy",
    name: "低空经济",
    shortName: "低空经济",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["低空主线"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "政策、航空器、运营和空域基础设施共同构成的主题中心。"
  },
  {
    id: "evtol",
    name: "eVTOL",
    shortName: "eVTOL",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["电动垂直起降"],
    industrialChainRole: "航空器",
    isThemeCenter: false,
    relationshipNote: "低空经济最具辨识度的航空器分支。"
  },
  {
    id: "flight-control-systems",
    name: "飞控系统",
    shortName: "飞控",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy", "robotics-physical-ai"],
    aliases: ["飞行控制"],
    industrialChainRole: "控制系统",
    isThemeCenter: false,
    relationshipNote: "低空航空器控制核心，也与机器人控制逻辑相近。"
  },
  {
    id: "drones",
    name: "无人机",
    shortName: "无人机",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["工业无人机"],
    industrialChainRole: "应用载体",
    isThemeCenter: false,
    relationshipNote: "低空应用落地最成熟的载体。"
  },
  {
    id: "general-aviation-operations",
    name: "通航运营",
    shortName: "通航",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["低空运营"],
    industrialChainRole: "运营场景",
    isThemeCenter: false,
    relationshipNote: "低空商业化场景和运营网络。"
  },
  {
    id: "air-traffic-systems",
    name: "空管系统",
    shortName: "空管",
    primaryThemeId: "low-altitude-economy",
    relatedThemeIds: ["low-altitude-economy"],
    aliases: ["低空空管"],
    industrialChainRole: "基础设施",
    isThemeCenter: false,
    relationshipNote: "低空飞行秩序和基础设施分支。"
  },
  {
    id: "semiconductors",
    name: "半导体",
    shortName: "半导体",
    primaryThemeId: "semiconductors",
    relatedThemeIds: ["semiconductors"],
    aliases: ["芯片产业", "集成电路"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "半导体主线中心，连接芯片设计、制造、材料设备和封装环节。"
  },
  {
    id: "chip-design",
    name: "芯片设计",
    shortName: "芯片设计",
    primaryThemeId: "semiconductors",
    relatedThemeIds: ["semiconductors", "ai-computing"],
    aliases: ["IC设计", "Fabless"],
    industrialChainRole: "上游设计",
    isThemeCenter: false,
    relationshipNote: "半导体产业链上游设计环节，也承接AI算力芯片需求。"
  },
  {
    id: "wafer-fabrication",
    name: "晶圆制造",
    shortName: "晶圆制造",
    primaryThemeId: "semiconductors",
    relatedThemeIds: ["semiconductors"],
    aliases: ["晶圆代工", "Foundry"],
    industrialChainRole: "制造环节",
    isThemeCenter: false,
    relationshipNote: "将芯片设计转化为晶圆产品的核心制造环节。"
  },
  {
    id: "semiconductor-equipment",
    name: "半导体设备",
    shortName: "半导体设备",
    primaryThemeId: "semiconductors",
    relatedThemeIds: ["semiconductors"],
    aliases: ["芯片设备", "制造设备"],
    industrialChainRole: "制造装备",
    isThemeCenter: false,
    relationshipNote: "支撑晶圆制造和先进制程扩产的关键装备分支。"
  },
  {
    id: "photoresist",
    name: "光刻胶",
    shortName: "光刻胶",
    primaryThemeId: "semiconductors",
    relatedThemeIds: ["semiconductors"],
    aliases: ["半导体材料", "光刻材料"],
    industrialChainRole: "材料",
    isThemeCenter: false,
    relationshipNote: "半导体制造中的关键材料，直接关联光刻工艺国产化。"
  },
  {
    id: "advanced-packaging",
    name: "先进封装",
    shortName: "先进封装",
    primaryThemeId: "semiconductors",
    relatedThemeIds: ["semiconductors", "ai-computing"],
    aliases: ["Chiplet封装", "高端封装"],
    industrialChainRole: "后道封装",
    isThemeCenter: false,
    relationshipNote: "半导体后道能力升级分支，也服务AI芯片算力密度提升。"
  },
  {
    id: "new-energy",
    name: "新能源",
    shortName: "新能源",
    primaryThemeId: "new-energy",
    relatedThemeIds: ["new-energy"],
    aliases: ["能源转型", "绿色能源"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "新能源主线中心，覆盖发电、储能、动力电池和终端补能设施。"
  },
  {
    id: "power-batteries",
    name: "动力电池",
    shortName: "动力电池",
    primaryThemeId: "new-energy",
    relatedThemeIds: ["new-energy"],
    aliases: ["锂电池", "电池产业链"],
    industrialChainRole: "储能部件",
    isThemeCenter: false,
    relationshipNote: "新能源车和储能系统的核心部件，连接电化学储能需求。"
  },
  {
    id: "energy-storage",
    name: "储能",
    shortName: "储能",
    primaryThemeId: "new-energy",
    relatedThemeIds: ["new-energy"],
    aliases: ["新型储能", "储能系统"],
    industrialChainRole: "储能系统",
    isThemeCenter: false,
    relationshipNote: "承接新能源发电波动性的系统环节，是电网消纳的重要支撑。"
  },
  {
    id: "photovoltaics",
    name: "光伏",
    shortName: "光伏",
    primaryThemeId: "new-energy",
    relatedThemeIds: ["new-energy", "semiconductors"],
    aliases: ["太阳能", "光伏组件"],
    industrialChainRole: "发电设备",
    isThemeCenter: false,
    relationshipNote: "新能源发电设备分支，部分材料和制造工艺与半导体相关。"
  },
  {
    id: "wind-power",
    name: "风电",
    shortName: "风电",
    primaryThemeId: "new-energy",
    relatedThemeIds: ["new-energy"],
    aliases: ["风力发电", "海上风电"],
    industrialChainRole: "发电设备",
    isThemeCenter: false,
    relationshipNote: "新能源发电设备分支，提供集中式和海上清洁电力供给。"
  },
  {
    id: "charging-infrastructure",
    name: "充电基础设施",
    shortName: "充电桩",
    primaryThemeId: "new-energy",
    relatedThemeIds: ["new-energy"],
    aliases: ["充电桩", "补能设施"],
    industrialChainRole: "终端设施",
    isThemeCenter: false,
    relationshipNote: "新能源车终端补能设施，连接电网、储能和车端应用。"
  },
  {
    id: "defense-aerospace",
    name: "军工/商业航天",
    shortName: "军工航天",
    primaryThemeId: "defense-aerospace",
    relatedThemeIds: ["defense-aerospace"],
    aliases: ["军工航天", "国防航天"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "军工和商业航天主线中心，统合发射、卫星、导航、材料和电子分支。"
  },
  {
    id: "commercial-aerospace",
    name: "商业航天",
    shortName: "商业航天",
    primaryThemeId: "defense-aerospace",
    relatedThemeIds: ["defense-aerospace", "low-altitude-economy"],
    aliases: ["商业火箭", "民营航天"],
    industrialChainRole: "航天发射",
    isThemeCenter: false,
    relationshipNote: "航天发射和运载能力分支，与低空经济共同体现空天产业扩容。"
  },
  {
    id: "satellite-internet",
    name: "卫星互联网",
    shortName: "卫星互联网",
    primaryThemeId: "defense-aerospace",
    relatedThemeIds: ["defense-aerospace", "semiconductors"],
    aliases: ["低轨卫星", "星联网"],
    industrialChainRole: "通信网络",
    isThemeCenter: false,
    relationshipNote: "商业航天通信网络分支，对卫星制造和高可靠芯片有联动需求。"
  },
  {
    id: "navigation-systems",
    name: "导航系统",
    shortName: "导航",
    primaryThemeId: "defense-aerospace",
    relatedThemeIds: ["defense-aerospace", "low-altitude-economy"],
    aliases: ["北斗导航", "卫星导航"],
    industrialChainRole: "导航定位",
    isThemeCenter: false,
    relationshipNote: "空天导航定位分支，也支撑低空飞行器监管和路径规划。"
  },
  {
    id: "aerospace-materials",
    name: "航天材料",
    shortName: "航天材料",
    primaryThemeId: "defense-aerospace",
    relatedThemeIds: ["defense-aerospace"],
    aliases: ["高温合金", "复合材料"],
    industrialChainRole: "高端材料",
    isThemeCenter: false,
    relationshipNote: "军工航天装备的高端材料分支，支撑轻量化和极端环境可靠性。"
  },
  {
    id: "defense-electronics",
    name: "军工电子",
    shortName: "军工电子",
    primaryThemeId: "defense-aerospace",
    relatedThemeIds: ["defense-aerospace", "semiconductors"],
    aliases: ["国防电子", "军用电子"],
    industrialChainRole: "军工电子",
    isThemeCenter: false,
    relationshipNote: "国防信息化和航天装备电子化分支，与半导体国产化高度相关。"
  },
  {
    id: "innovative-medicine",
    name: "创新药/医药",
    shortName: "创新药",
    primaryThemeId: "innovative-medicine",
    relatedThemeIds: ["innovative-medicine"],
    aliases: ["创新医药", "医药主线"],
    industrialChainRole: "主线中心",
    isThemeCenter: true,
    relationshipNote: "医药创新主线中心，连接药物研发、外包服务、器械和生物制造。"
  },
  {
    id: "innovative-drugs",
    name: "创新药",
    shortName: "创新药",
    primaryThemeId: "innovative-medicine",
    relatedThemeIds: ["innovative-medicine"],
    aliases: ["新药研发", "Biotech"],
    industrialChainRole: "药物研发",
    isThemeCenter: false,
    relationshipNote: "医药主题的药物研发分支，聚焦新靶点、新机制和临床价值兑现。"
  },
  {
    id: "cro-cdmo",
    name: "CRO/CDMO",
    shortName: "CRO/CDMO",
    primaryThemeId: "innovative-medicine",
    relatedThemeIds: ["innovative-medicine"],
    aliases: ["医药外包", "CXO"],
    industrialChainRole: "研发外包",
    isThemeCenter: false,
    relationshipNote: "创新药研发和生产外包分支，服务从临床前到商业化生产的效率提升。"
  },
  {
    id: "medical-devices",
    name: "医疗器械",
    shortName: "医疗器械",
    primaryThemeId: "innovative-medicine",
    relatedThemeIds: ["innovative-medicine", "semiconductors"],
    aliases: ["高端器械", "医疗设备"],
    industrialChainRole: "医疗器械",
    isThemeCenter: false,
    relationshipNote: "医药健康硬件分支，高端设备和检测仪器与芯片及传感技术存在交叉。"
  },
  {
    id: "synthetic-biology",
    name: "合成生物",
    shortName: "合成生物",
    primaryThemeId: "innovative-medicine",
    relatedThemeIds: ["innovative-medicine", "new-energy"],
    aliases: ["生物制造", "合成生物学"],
    industrialChainRole: "生物制造",
    isThemeCenter: false,
    relationshipNote: "医药与制造交叉分支，可用于药物、材料和绿色制造场景。"
  },
  {
    id: "traditional-chinese-medicine",
    name: "中药",
    shortName: "中药",
    primaryThemeId: "innovative-medicine",
    relatedThemeIds: ["innovative-medicine"],
    aliases: ["中成药", "传统中药"],
    industrialChainRole: "防御医药",
    isThemeCenter: false,
    relationshipNote: "医药主题中的防御属性分支，体现品牌、渠道和稳健现金流特征。"
  }
] satisfies readonly Sector[];

export const sectors: readonly Readonly<Sector>[] = Object.freeze(sectorConfig.map(freezeSector));
