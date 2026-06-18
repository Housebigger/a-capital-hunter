import { sourceLabel } from "./sourceLabel";

describe("sourceLabel", () => {
  it("maps known sources to display names", () => {
    expect(sourceLabel("tushare")).toBe("Tushare");
    expect(sourceLabel("jqdata")).toBe("JQData");
  });
  it("echoes an unknown source unchanged", () => {
    expect(sourceLabel("eastmoney")).toBe("eastmoney");
  });
});
