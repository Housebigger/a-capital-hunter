/**
 * Polygon-to-convex-polygon clipping using the Sutherland-Hodgman algorithm.
 *
 * The `clip` polygon MUST be convex (e.g. Voronoi cells are always convex).
 * The `subject` polygon can be any simple polygon.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point2D {
  readonly x: number;
  readonly z: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `point` is on the inside (left side) of the directed edge
 * from `edgeStart` → `edgeEnd`. For a counter-clockwise convex polygon,
 * "inside" means the point is on the same side as the polygon interior.
 */
export function isInsideEdge(
  point: Point2D,
  edgeStart: Point2D,
  edgeEnd: Point2D
): boolean {
  // Cross product of edge vector and point-to-end vector.
  // Positive = left side (inside for CCW polygon).
  return (
    (edgeEnd.x - edgeStart.x) * (point.z - edgeStart.z) -
      (edgeEnd.z - edgeStart.z) * (point.x - edgeStart.x) >=
    0
  );
}

/**
 * Compute the intersection point of two line segments:
 *   p1→p2  and  p3→p4
 */
export function lineIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D {
  const d1x = p2.x - p1.x;
  const d1z = p2.z - p1.z;
  const d2x = p4.x - p3.x;
  const d2z = p4.z - p3.z;

  const denom = d1x * d2z - d1z * d2x;
  // Parallel lines should not occur in valid clipping scenarios
  if (Math.abs(denom) < 1e-12) {
    return { x: (p1.x + p2.x) / 2, z: (p1.z + p2.z) / 2 };
  }

  const t =
    ((p3.x - p1.x) * d2z - (p3.z - p1.z) * d2x) / denom;

  return {
    x: p1.x + t * d1x,
    z: p1.z + t * d1z,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Clip a subject polygon against a convex clip polygon using
 * Sutherland-Hodgman algorithm.
 *
 * @param subject The polygon to clip (any simple polygon).
 * @param clip    The convex clipping polygon (MUST be convex, e.g. a Voronoi cell).
 * @returns       The clipped polygon (may be empty if no overlap).
 */
export function clipPolygonToConvexPolygon(
  subject: ReadonlyArray<Point2D>,
  clip: ReadonlyArray<Point2D>
): Point2D[] {
  if (clip.length < 3 || subject.length < 3) return [];

  let output: Point2D[] = [...subject];

  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const input = output;
    output = [];

    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const next = input[(j + 1) % input.length];

      const currentInside = isInsideEdge(current, edgeStart, edgeEnd);
      const nextInside = isInsideEdge(next, edgeStart, edgeEnd);

      if (currentInside) {
        output.push(current);
        if (!nextInside) {
          output.push(lineIntersection(current, next, edgeStart, edgeEnd));
        }
      } else if (nextInside) {
        output.push(lineIntersection(current, next, edgeStart, edgeEnd));
      }
    }
  }

  return output;
}
