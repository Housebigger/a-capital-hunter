import { describe, expect, it, vi } from "vitest";
import type { RenderNode, StockRenderNode, VoronoiCell, VoronoiLayout } from "../domain/types";
import {
  applyCameraPreset,
  cameraPositions,
  getColumnRenderGeometry,
  handleBaseCellClick
} from "./CapitalMapScene";

function buildNode(visible: boolean): RenderNode {
  return {
    sector: {
      id: "ai-computing",
      name: "AI Computing",
      shortName: "AI",
      primaryThemeId: "ai-computing",
      subThemeId: "ai-computing-infra",
      relatedThemeIds: ["ai-computing"],
      aliases: [],
      industrialChainRole: "theme center",
      isThemeCenter: true,
      relationshipNote: "center"
    },
    theme: {
      id: "ai-computing",
      name: "AI Computing",
      shortName: "AI",
      color: "#55aaff"
    },
    cell: {
      sectorId: "ai-computing",
      x: 0,
      z: 0,
      role: "theme-center",
      relationshipStrength: 3
    },
    metric: {
      rawValue: 10,
      height: 1.2,
      direction: "inflow",
      color: "#e64646",
      intensity: 0.8,
      labelValue: "+10.0亿"
    },
    visible,
    dimmed: !visible,
    isSubThemeCenter: false
  };
}

function buildVoronoiCell(subThemeId: string, themeId: string): VoronoiCell {
  return {
    subThemeId,
    themeId,
    center: { x: 0, z: 0 },
    polygon: [
      { x: -1, z: -1 },
      { x: 1, z: -1 },
      { x: 1, z: 1 },
      { x: -1, z: 1 }
    ]
  };
}

function buildStockRenderNode(
  subThemeId = "ai-computing-infra",
  visible = true
): StockRenderNode {
  return {
    stock: {
      id: "test-stock",
      name: "Test Stock",
      shortName: "Test",
      subThemeId,
      code: "000001.SZ"
    },
    subTheme: {
      id: subThemeId,
      name: "AI Computing Infra",
      shortName: "AI",
      themeId: "ai-computing",
      displayOrder: 1,
      primarySectorId: "ai-computing",
      areaWeight: 0.85
    },
    theme: {
      id: "ai-computing",
      name: "AI Computing",
      shortName: "AI",
      color: "#55aaff"
    },
    position: { x: 0, z: 0 },
    metric: {
      rawValue: 10,
      height: 1.2,
      direction: "inflow",
      color: "#e64646",
      intensity: 0.8,
      labelValue: "+10.0亿"
    },
    visible,
    cell: buildVoronoiCell(subThemeId, "ai-computing")
  };
}

describe("CapitalMapScene helpers", () => {
  it("anchors column geometry outside the base slab", () => {
    expect(getColumnRenderGeometry({ height: 2.4, direction: "inflow" })).toMatchObject({
      height: 2.4
    });
    expect(getColumnRenderGeometry({ height: 2.4, direction: "inflow" }).positionY).toBeCloseTo(
      1.23
    );

    expect(getColumnRenderGeometry({ height: -1.6, direction: "outflow" })).toMatchObject({
      height: 1.6
    });
    expect(getColumnRenderGeometry({ height: -1.6, direction: "outflow" }).positionY).toBeCloseTo(
      -0.83
    );

    expect(getColumnRenderGeometry({ height: 0, direction: "flat" })).toMatchObject({
      height: 0.08
    });
    expect(getColumnRenderGeometry({ height: 0, direction: "flat" }).positionY).toBeCloseTo(0.07);
  });

  it("does not select filtered-out base cells", () => {
    const event = { stopPropagation: vi.fn() };
    const onSelectSector = vi.fn();

    handleBaseCellClick(event, buildNode(false), onSelectSector);

    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onSelectSector).not.toHaveBeenCalled();
  });

  it("selects visible base cells", () => {
    const event = { stopPropagation: vi.fn() };
    const onSelectSector = vi.fn();

    handleBaseCellClick(event, buildNode(true), onSelectSector);

    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onSelectSector).toHaveBeenCalledWith("ai-computing");
  });

  it("resets OrbitControls after applying a camera preset (Gen4 positions)", () => {
    const camera = {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn()
    };
    const controls = {
      target: { set: vi.fn() },
      update: vi.fn()
    };

    applyCameraPreset(camera, "side", controls);

    expect(camera.position.set).toHaveBeenCalledWith(24, 9, 0);
    expect(camera.lookAt).toHaveBeenCalledWith(0, 0, 0);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledOnce();
    expect(controls.target.set).toHaveBeenCalledWith(0, 0, 0);
    expect(controls.update).toHaveBeenCalledOnce();
  });

  it("applies angled camera preset correctly", () => {
    const camera = {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn()
    };

    applyCameraPreset(camera, "angled");

    expect(camera.position.set).toHaveBeenCalledWith(18, 18, 22);
  });

  it("applies top camera preset correctly", () => {
    const camera = {
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn()
    };

    applyCameraPreset(camera, "top");

    expect(camera.position.set).toHaveBeenCalledWith(0, 28, 0.1);
  });
});

describe("Gen4 camera positions", () => {
  it("has updated positions for the larger Voronoi map", () => {
    expect(cameraPositions.angled).toEqual([18, 18, 22]);
    expect(cameraPositions.top).toEqual([0, 28, 0.1]);
    expect(cameraPositions.side).toEqual([24, 9, 0]);
  });
});

describe("Voronoi data structures", () => {
  it("VoronoiCell has required fields", () => {
    const cell = buildVoronoiCell("test-id", "theme-id");
    expect(cell.subThemeId).toBe("test-id");
    expect(cell.themeId).toBe("theme-id");
    expect(cell.center).toEqual({ x: 0, z: 0 });
    expect(cell.polygon.length).toBe(4);
  });

  it("StockRenderNode has required fields", () => {
    const node = buildStockRenderNode("test-sub", true);
    expect(node.stock.id).toBe("test-stock");
    expect(node.subTheme.id).toBe("test-sub");
    expect(node.visible).toBe(true);
    expect(node.metric.height).toBe(1.2);
  });

  it("StockRenderNode can be invisible", () => {
    const node = buildStockRenderNode("test-sub", false);
    expect(node.visible).toBe(false);
  });

  it("VoronoiLayout has required fields", () => {
    const layout: VoronoiLayout = {
      cells: [buildVoronoiCell("a", "t1"), buildVoronoiCell("b", "t2")],
      boundary: { width: 30, height: 22 },
      version: "voronoi-v1",
      stageId: "stage-1"
    };
    expect(layout.cells.length).toBe(2);
    expect(layout.boundary.width).toBe(30);
    expect(layout.boundary.height).toBe(22);
    expect(layout.version).toBe("voronoi-v1");
  });
});
