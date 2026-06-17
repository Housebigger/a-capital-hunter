import { expect, test } from "@playwright/test";

const snapshotFixture = {
  tradeDate: "2026-06-12",
  fetchedAt: "2026-06-12T16:00:00Z",
  source: "jqdata",
  metric: "net_amount_main",
  unit: "CNY",
  status: "ready",
  coverage: { requested: 168, succeeded: 160, failed: 8 },
  points: [
    {
      stockId: "aci-zjxc",
      securityCode: "300308.XSHE",
      stockName: "中际旭创",
      subThemeId: "optical-interconnect",
      themeId: "ai-computing",
      aggregationRole: "primary",
      netAmountMain: 12_345_600,
      tradeDate: "2026-06-12",
    },
  ],
  failures: [],
};

const statusFixture = {
  databaseAvailable: true,
  latestTradeDate: "2026-06-12",
  latestStatus: "ready",
  source: "jqdata",
  metric: "net_amount_main",
  availableTradeDates: ["2026-06-12"],
};

test("renders the 3D capital hunter with a JQData snapshot", async ({ page }) => {
  // Intercept the snapshot API so the e2e run does not depend on a synced DB.
  await page.route("**/api/capital-flow/status", (route) =>
    route.fulfill({ json: statusFixture })
  );
  await page.route("**/api/capital-flow/snapshot/latest", (route) =>
    route.fulfill({ json: snapshotFixture })
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "A Capital Hunter" })).toBeVisible();
  await expect(page.getByLabel("A Capital Hunter 3D资金峰面")).toBeVisible();
  await expect(page.getByText("二维位置 = 关系")).toBeVisible();

  // Real-data provenance bar
  await expect(page.getByText("数据截至 2026-06-12")).toBeVisible();
  await expect(page.getByText(/JQData · 主力净流入/)).toBeVisible();

  // The three view levels
  await expect(page.getByRole("button", { name: /P1 主线/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /P2 子题材/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /P3 个股/ })).toBeVisible();

  // Snapshot date selector is populated from status
  await expect(page.getByLabel("资金流快照日期")).toHaveValue("2026-06-12");

  // Never shows demo-data labeling when a real snapshot is available
  await expect(page.getByText(/演示数据/)).toHaveCount(0);
});
