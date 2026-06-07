import { describe, expect, it } from "vitest";
import { normalizeCapitalValue } from "./metricNormalizer";

describe("normalizeCapitalValue", () => {
  it("maps positive values to upward red inflow columns", () => {
    expect(normalizeCapitalValue(120, 160)).toMatchObject({
      rawValue: 120,
      direction: "inflow",
      color: "#e64646",
      labelValue: "+120.0亿"
    });
    expect(normalizeCapitalValue(120, 160).height).toBeGreaterThan(0);
  });

  it("maps negative values to downward green outflow columns", () => {
    expect(normalizeCapitalValue(-80, 160)).toMatchObject({
      rawValue: -80,
      direction: "outflow",
      color: "#2fa66a",
      labelValue: "-80.0亿"
    });
    expect(normalizeCapitalValue(-80, 160).height).toBeLessThan(0);
  });

  it("maps near-zero values to flat neutral columns", () => {
    expect(normalizeCapitalValue(0.4, 160)).toMatchObject({
      direction: "flat",
      color: "#7b8794",
      labelValue: "+0.4亿"
    });
  });
});
