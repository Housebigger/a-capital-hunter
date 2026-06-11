import { describe, it, expect } from "vitest";
import { createVoronoiLayoutProvider } from "./voronoiLayoutProvider";
import { subThemes } from "./subThemeRegistry";

describe("voronoiLayoutProvider", () => {
  const provider = createVoronoiLayoutProvider();

  it("returns a VoronoiLayout with correct cell count", () => {
    const layout = provider.getLayout();
    expect(layout.cells.length).toBe(subThemes.length);
    expect(layout.boundary.radius).toBe(11);
  });

  it("is deterministic across calls", () => {
    const a = provider.getLayout();
    const b = provider.getLayout();
    expect(a.cells).toEqual(b.cells);
  });
});
