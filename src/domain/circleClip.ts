interface Point2D {
  readonly x: number;
  readonly z: number;
}

export function isInsideCircle(p: Point2D, radius: number): boolean {
  return p.x * p.x + p.z * p.z <= radius * radius;
}

/** Find intersections of line segment A→B with circle of given radius. */
function lineCircleIntersections(
  a: Point2D,
  b: Point2D,
  radius: number
): Array<{ x: number; z: number }> {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const aCoeff = dx * dx + dz * dz;
  if (aCoeff === 0) return [];
  const bCoeff = 2 * (a.x * dx + a.z * dz);
  const cCoeff = a.x * a.x + a.z * a.z - radius * radius;
  const disc = bCoeff * bCoeff - 4 * aCoeff * cCoeff;
  if (disc < 0) return [];
  const sqrtDisc = Math.sqrt(disc);
  const results: Array<{ x: number; z: number }> = [];
  for (const t of [(-bCoeff - sqrtDisc) / (2 * aCoeff), (-bCoeff + sqrtDisc) / (2 * aCoeff)]) {
    if (t >= 0 && t <= 1) {
      results.push({ x: a.x + t * dx, z: a.z + t * dz });
    }
  }
  return results;
}

/**
 * Clip a polygon to a circle centered at origin.
 * Handles all cases including edges that enter and exit the circle
 * while both endpoints are outside.
 */
export function clipPolygonToCircle(
  polygon: ReadonlyArray<Point2D>,
  radius: number
): Array<{ x: number; z: number }> {
  if (polygon.length < 3) return [];

  const output: Array<{ x: number; z: number }> = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currentInside = isInsideCircle(current, radius);
    const nextInside = isInsideCircle(next, radius);

    if (currentInside) {
      output.push({ x: current.x, z: current.z });
    }

    if (currentInside && !nextInside) {
      // Exiting circle: add exit intersection
      const hits = lineCircleIntersections(current, next, radius);
      if (hits.length > 0) output.push(hits[0]);
    } else if (!currentInside && nextInside) {
      // Entering circle: add entry intersection
      const hits = lineCircleIntersections(current, next, radius);
      if (hits.length > 0) output.push(hits[0]);
    } else if (!currentInside && !nextInside) {
      // Both outside: edge might still pass through circle
      const hits = lineCircleIntersections(current, next, radius);
      for (const hit of hits) {
        output.push(hit);
      }
    }
    // If both inside: next vertex will be added in next iteration
  }

  return output;
}
