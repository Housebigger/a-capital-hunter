import { describe, expect, it } from "vitest";
import { sectors, themes } from "./themeRegistry";
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

  it("rejects non-finite weights", () => {
    const invalidEdge = { ...relationshipEdges[0], weight: Number.NaN };
    const result = validateRelationshipEdges([invalidEdge], sectors);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Invalid relationship weight NaN");
  });

  it("freezes the exported relationship graph", () => {
    expect(Object.isFrozen(relationshipEdges)).toBe(true);
    expect(relationshipEdges.every((candidate) => Object.isFrozen(candidate))).toBe(true);
  });

  it("has 150-180 relationship edges", () => {
    expect(relationshipEdges.length).toBeGreaterThanOrEqual(150);
    expect(relationshipEdges.length).toBeLessThanOrEqual(180);
  });

  it("every edge type is one of the 5 valid types", () => {
    const validTypes = new Set(["industrial-chain", "market-comovement", "heat-correction", "policy-linkage", "capital-flow"]);
    for (const edge of relationshipEdges) {
      expect(validTypes.has(edge.type), `Edge ${edge.sourceSectorId}->${edge.targetSectorId} has invalid type ${edge.type}`).toBe(true);
    }
  });

  it("every theme pair has at least one cross-theme edge", () => {
    const themeIds = themes.map((t) => t.id);
    const crossThemePairs = new Set<string>();
    for (const e of relationshipEdges) {
      const sourceSector = sectors.find((s) => s.id === e.sourceSectorId);
      const targetSector = sectors.find((s) => s.id === e.targetSectorId);
      if (!sourceSector || !targetSector) continue;
      if (sourceSector.primaryThemeId !== targetSector.primaryThemeId) {
        const pair = [sourceSector.primaryThemeId, targetSector.primaryThemeId].sort().join("<->");
        crossThemePairs.add(pair);
      }
    }
    for (let i = 0; i < themeIds.length; i++) {
      for (let j = i + 1; j < themeIds.length; j++) {
        const pair = [themeIds[i], themeIds[j]].sort().join("<->");
        expect(crossThemePairs.has(pair), `Missing cross-theme edge between ${themeIds[i]} and ${themeIds[j]}`).toBe(true);
      }
    }
  });
});
