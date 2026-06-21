import { describe, it, expect } from "vitest";
import { createThemeLayoutProvider } from "./themeVoronoiLayoutProvider";

const dist = (c: { center: { x: number; z: number } }) =>
  Math.hypot(c.center.x, c.center.z);

describe("createThemeLayoutProvider heat", () => {
  it("places a hot theme closer to center than when it is cold", () => {
    const provider = createThemeLayoutProvider();
    const hot = provider.getLayout(undefined, { "ai-computing": 1 });
    const cold = provider.getLayout(undefined, { "ai-computing": 0 });
    const hotCell = hot.cells.find((c) => c.themeId === "ai-computing")!;
    const coldCell = cold.cells.find((c) => c.themeId === "ai-computing")!;
    expect(dist(hotCell)).toBeLessThan(dist(coldCell));
  });
});
