import type { LayoutProvider, SectorLayout } from "./types";

const manualLayout: SectorLayout = {
  cells: [
    { sectorId: "ai-computing", x: -5, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "optical-modules", x: -6, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "cpo", x: -4, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "liquid-cooled-servers", x: -6, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "domestic-computing", x: -4, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "data-centers", x: -5, z: 2, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "robotics-physical-ai", x: 0, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "reducers", x: -1, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "servo-systems", x: 1, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "sensors", x: -1, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "machine-vision", x: 1, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "actuators", x: 0, z: 2, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "low-altitude-economy", x: 5, z: 0, role: "theme-center", relationshipStrength: 3 },
    { sectorId: "evtol", x: 4, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "flight-control-systems", x: 6, z: -1, role: "related-sector", relationshipStrength: 3 },
    { sectorId: "drones", x: 4, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "general-aviation-operations", x: 6, z: 1, role: "related-sector", relationshipStrength: 2 },
    { sectorId: "air-traffic-systems", x: 5, z: 2, role: "related-sector", relationshipStrength: 2 }
  ]
};

const cloneLayout = (layout: SectorLayout): SectorLayout => ({
  cells: layout.cells.map((cell) => ({ ...cell }))
});

export function createManualLayoutProvider(): LayoutProvider {
  return {
    getLayout: () => cloneLayout(manualLayout)
  };
}
