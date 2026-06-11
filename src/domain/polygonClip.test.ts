import { describe, expect, it } from "vitest";
import {
  clipPolygonToConvexPolygon,
  isInsideEdge,
  lineIntersection,
  type Point2D,
} from "./polygonClip";

describe("polygonClip", () => {
  // -----------------------------------------------------------------------
  // isInsideEdge
  // -----------------------------------------------------------------------

  describe("isInsideEdge", () => {
    it("returns true for point on the left side of a directed edge", () => {
      // Edge goes right along x-axis: (0,0) → (1,0)
      // Point above (z > 0) is on the left/inside
      expect(isInsideEdge({ x: 0.5, z: 1 }, { x: 0, z: 0 }, { x: 1, z: 0 })).toBe(true);
    });

    it("returns false for point on the right side of a directed edge", () => {
      expect(isInsideEdge({ x: 0.5, z: -1 }, { x: 0, z: 0 }, { x: 1, z: 0 })).toBe(false);
    });

    it("returns true for point exactly on the edge", () => {
      expect(isInsideEdge({ x: 0.5, z: 0 }, { x: 0, z: 0 }, { x: 1, z: 0 })).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // lineIntersection
  // -----------------------------------------------------------------------

  describe("lineIntersection", () => {
    it("finds intersection of two perpendicular lines", () => {
      const result = lineIntersection(
        { x: 0, z: 0 },
        { x: 2, z: 0 },
        { x: 1, z: -1 },
        { x: 1, z: 1 }
      );
      expect(result.x).toBeCloseTo(1);
      expect(result.z).toBeCloseTo(0);
    });

    it("finds intersection of two diagonal lines", () => {
      const result = lineIntersection(
        { x: 0, z: 0 },
        { x: 2, z: 2 },
        { x: 0, z: 2 },
        { x: 2, z: 0 }
      );
      expect(result.x).toBeCloseTo(1);
      expect(result.z).toBeCloseTo(1);
    });
  });

  // -----------------------------------------------------------------------
  // clipPolygonToConvexPolygon
  // -----------------------------------------------------------------------

  describe("clipPolygonToConvexPolygon", () => {
    it("returns subject unchanged when fully inside clip polygon", () => {
      // Small square inside larger square
      const subject: Point2D[] = [
        { x: -1, z: -1 },
        { x: 1, z: -1 },
        { x: 1, z: 1 },
        { x: -1, z: 1 },
      ];
      const clip: Point2D[] = [
        { x: -3, z: -3 },
        { x: 3, z: -3 },
        { x: 3, z: 3 },
        { x: -3, z: 3 },
      ];

      const result = clipPolygonToConvexPolygon(subject, clip);
      expect(result.length).toBe(4);
      // Vertices may be reordered but all should be present
      const xs = result.map((p) => p.x).sort();
      const zs = result.map((p) => p.z).sort();
      expect(xs).toEqual([-1, -1, 1, 1]);
      expect(zs).toEqual([-1, -1, 1, 1]);
    });

    it("clips subject that extends outside clip polygon", () => {
      // Large square clipped to smaller square
      const subject: Point2D[] = [
        { x: -5, z: -5 },
        { x: 5, z: -5 },
        { x: 5, z: 5 },
        { x: -5, z: 5 },
      ];
      const clip: Point2D[] = [
        { x: -2, z: -2 },
        { x: 2, z: -2 },
        { x: 2, z: 2 },
        { x: -2, z: 2 },
      ];

      const result = clipPolygonToConvexPolygon(subject, clip);
      expect(result.length).toBe(4);
      // All result points should be on or within the clip boundary
      for (const p of result) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(2.01);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(2.01);
      }
    });

    it("returns empty when subject is entirely outside clip polygon", () => {
      const subject: Point2D[] = [
        { x: 5, z: 5 },
        { x: 7, z: 5 },
        { x: 7, z: 7 },
        { x: 5, z: 7 },
      ];
      const clip: Point2D[] = [
        { x: -2, z: -2 },
        { x: 2, z: -2 },
        { x: 2, z: 2 },
        { x: -2, z: 2 },
      ];

      const result = clipPolygonToConvexPolygon(subject, clip);
      expect(result.length).toBe(0);
    });

    it("clips triangle to overlapping triangle", () => {
      // Subject triangle
      const subject: Point2D[] = [
        { x: 0, z: 3 },
        { x: -3, z: -2 },
        { x: 3, z: -2 },
      ];
      // Clip triangle (smaller, overlapping)
      const clip: Point2D[] = [
        { x: 0, z: 2 },
        { x: -2, z: -1 },
        { x: 2, z: -1 },
      ];

      const result = clipPolygonToConvexPolygon(subject, clip);
      expect(result.length).toBeGreaterThanOrEqual(3);
      // All points should be within the clip triangle (check approximate bounds)
      for (const p of result) {
        expect(p.z).toBeGreaterThanOrEqual(-1.01);
        expect(p.z).toBeLessThanOrEqual(2.01);
      }
    });

    it("returns empty for degenerate inputs (< 3 vertices)", () => {
      expect(
        clipPolygonToConvexPolygon(
          [{ x: 0, z: 0 }, { x: 1, z: 0 }],
          [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }]
        )
      ).toEqual([]);
      expect(
        clipPolygonToConvexPolygon(
          [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }],
          [{ x: 0, z: 0 }, { x: 1, z: 0 }]
        )
      ).toEqual([]);
    });

    it("handles subject polygon partially overlapping one edge of clip", () => {
      // Subject crosses only the right edge of the clip square
      const subject: Point2D[] = [
        { x: 1, z: -1 },
        { x: 5, z: -1 },
        { x: 5, z: 1 },
        { x: 1, z: 1 },
      ];
      const clip: Point2D[] = [
        { x: -3, z: -3 },
        { x: 3, z: -3 },
        { x: 3, z: 3 },
        { x: -3, z: 3 },
      ];

      const result = clipPolygonToConvexPolygon(subject, clip);
      expect(result.length).toBeGreaterThanOrEqual(3);
      // All result points should have x <= 3
      for (const p of result) {
        expect(p.x).toBeLessThanOrEqual(3.01);
      }
    });
  });
});
