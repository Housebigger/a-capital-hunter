import { describe, expect, it } from "vitest";
import { sectors } from "./themeRegistry";
import { relationshipEdges, validateRelationshipEdges } from "./relationshipRegistry";

describe("relationshipRegistry", () => {
  it("defines a medium-density relationship graph", () => {
    expect(relationshipEdges.length).toBeGreaterThanOrEqual(60);
  });

  it("references valid sector ids", () => {
    const result = validateRelationshipEdges(relationshipEdges, sectors);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects duplicate directed edges", () => {
    const duplicate = relationshipEdges[0];
    const result = validateRelationshipEdges([...relationshipEdges, duplicate], sectors);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(`${duplicate.sourceSectorId}->${duplicate.targetSectorId}`);
  });
});
