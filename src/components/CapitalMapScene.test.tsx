import { describe, expect, it, vi } from "vitest";
import type { RenderNode } from "../domain/types";
import {
  applyCameraPreset,
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
    dimmed: !visible
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

  it("resets OrbitControls after applying a camera preset", () => {
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

    expect(camera.position.set).toHaveBeenCalledWith(14, 5, 0);
    expect(camera.lookAt).toHaveBeenCalledWith(0, 0, 0);
    expect(camera.updateProjectionMatrix).toHaveBeenCalledOnce();
    expect(controls.target.set).toHaveBeenCalledWith(0, 0, 0);
    expect(controls.update).toHaveBeenCalledOnce();
  });
});
