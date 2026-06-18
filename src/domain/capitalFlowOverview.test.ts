import { buildOverview } from "./capitalFlowOverview";

const nameOf = (id: string) => ({ a: "甲", b: "乙", c: "丙", d: "丁" }[id] ?? id);

describe("buildOverview", () => {
  it("ranks inflow desc and outflow most-negative-first, totals all", () => {
    const totals = new Map([["a", 100], ["b", -50], ["c", 30], ["d", -80]]);
    const o = buildOverview(totals, nameOf, 2);
    expect(o.topInflow.map(e => e.id)).toEqual(["a", "c"]);
    expect(o.topOutflow.map(e => e.id)).toEqual(["d", "b"]);
    expect(o.totalNetInflow).toBe(0);
    expect(o.topInflow[0].name).toBe("甲");
  });
  it("omits the wrong sign when few entries", () => {
    const o = buildOverview(new Map([["a", 100]]), nameOf, 5);
    expect(o.topOutflow).toEqual([]);
  });
});
