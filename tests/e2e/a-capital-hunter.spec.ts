import { expect, test } from "@playwright/test";

test("renders the desktop 3D capital hunter prototype", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "A Capital Hunter" })).toBeVisible();
  await expect(page.getByLabel("A Capital Hunter 3D资金峰面")).toBeVisible();
  await expect(page.getByText("二维位置 = 关系")).toBeVisible();

  await page.getByRole("button", { name: "T4 低空经济主升" }).click();
  await expect(page.getByText("低空经济成为主峰，AI与机器人部分流出或震荡。")).toBeVisible();

  await page.getByLabel("主题筛选").selectOption("low-altitude-economy");
  await expect(page.getByText("只看主线中心")).toBeVisible();
});
