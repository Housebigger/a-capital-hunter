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
  { id: "low-altitude-economy", name: "低空经济", shortName: "低空经济", color: "#3b82c4" }
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
    isThemeCenter: false,
    relationshipNote: "低空飞行秩序和基础设施分支。"
  }
] satisfies readonly Sector[];

export const sectors: readonly Readonly<Sector>[] = Object.freeze(sectorConfig.map(freezeSector));
