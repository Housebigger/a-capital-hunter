import { describe, it, expect } from "vitest";
import { clipPolygonToCircle, isInsideCircle } from "./circleClip";

describe("circleClip", () => {
  it("keeps polygon fully inside circle unchanged", () => {
    const poly = [
      { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }, { x: 0, z: -1 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    expect(result.length).toBe(4);
  });

  it("clips polygon that extends outside circle", () => {
    // Horizontal strip: edges at z=±3 cross the circle at x=±4
    const poly = [
      { x: -10, z: -3 }, { x: 10, z: -3 }, { x: 10, z: 3 }, { x: -10, z: 3 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    for (const p of result) {
      expect(Math.sqrt(p.x * p.x + p.z * p.z)).toBeLessThanOrEqual(5.01);
    }
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty for polygon entirely outside circle", () => {
    const poly = [
      { x: 20, z: 20 }, { x: 22, z: 20 }, { x: 22, z: 22 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    expect(result.length).toBe(0);
  });

  it("handles polygon at circle edge", () => {
    const poly = [
      { x: 5, z: 0 }, { x: 0, z: 5 }, { x: -5, z: 0 }, { x: 0, z: -5 },
    ];
    const result = clipPolygonToCircle(poly, 5);
    expect(result.length).toBe(4);
  });

  it("isInsideCircle works correctly", () => {
    expect(isInsideCircle({ x: 0, z: 0 }, 5)).toBe(true);
    expect(isInsideCircle({ x: 4, z: 0 }, 5)).toBe(true);
    expect(isInsideCircle({ x: 5, z: 0 }, 5)).toBe(true);
    expect(isInsideCircle({ x: 6, z: 0 }, 5)).toBe(false);
  });
});
