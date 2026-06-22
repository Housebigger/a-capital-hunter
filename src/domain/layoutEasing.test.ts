import { describe, it, expect } from "vitest";
import { approach } from "./layoutEasing";

describe("approach", () => {
  it("moves toward target and converges", () => {
    let v = 0;
    // 300 frames @60fps = 5s ≈ 8 time constants → essentially settled.
    for (let i = 0; i < 300; i++) v = approach(v, 10, 1 / 60, 0.6);
    expect(v).toBeCloseTo(10, 1);
  });
  it("does not overshoot in one large step", () => {
    const v = approach(0, 10, 100, 0.6); // huge dt
    expect(v).toBeLessThanOrEqual(10);
    expect(v).toBeGreaterThanOrEqual(0);
  });
  it("returns target when already there", () => {
    expect(approach(5, 5, 0.016, 0.6)).toBeCloseTo(5);
  });
  it("moves a meaningful fraction in a ~0.6s window over a typical frame", () => {
    // one 60fps frame should close a small but nonzero fraction
    const v = approach(0, 10, 1 / 60, 0.6);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(10);
  });
});
