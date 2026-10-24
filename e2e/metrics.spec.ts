import { addDays, expect, formError, go, saveMetric, test, todayJst } from "./helpers";

test.describe("身体計測", () => {
  test("保存するとカレンダーの日付サマリーに表示され、同日の再入力は上書きされる", async ({ page }) => {
    const today = todayJst();
    await saveMetric(page, today, { weight: 70.5, bodyFat: 18.2 });
    await expect(page.getByText("70.5kg / 18.2%")).toBeVisible();

    await go(page, `/metrics/new?date=${today}`);
    await expect(page.getByLabel("体重 (kg)")).toHaveValue("70.5");
    await expect(page.getByText("この日の記録があります")).toBeVisible();

    await page.getByLabel("体重 (kg)").fill("70");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/\?month=/);
    await expect(page.getByText("70kg / 18.2%")).toBeVisible();
  });

  test("体重だけでも保存できる", async ({ page }) => {
    await saveMetric(page, todayJst(), { weight: 65.3 });
    await expect(page.getByRole("region", { name: "選択日のサマリー" })).toContainText("65.3kg");
  });

  test("体重・体脂肪率がどちらも空だと保存できない", async ({ page }) => {
    await go(page, `/metrics/new?date=${todayJst()}`);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(formError(page)).toContainText("どちらかを入力してください");
  });

  test("範囲外・小数第2位の値は拒否される", async ({ page }) => {
    await go(page, `/metrics/new?date=${todayJst()}`);
    await page.getByLabel("体重 (kg)").fill("19");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(formError(page)).toContainText("20〜300kg");
  });

  test("日付を変えるとその日の既存値を読み込み直す。前回値が目安に出る", async ({ page }) => {
    const today = todayJst();
    const yesterday = addDays(today, -1);
    await saveMetric(page, yesterday, { weight: 71, bodyFat: 19 });

    await go(page, `/metrics/new?date=${today}`);
    await expect(page.getByText(`前回（${yesterday}）: 71kg / 19%`)).toBeVisible();

    await page.getByLabel("日付").fill(yesterday);
    await page.waitForURL(new RegExp(`date=${yesterday}`));
    await expect(page.getByLabel("体重 (kg)")).toHaveValue("71");
  });

  test("削除できる", async ({ page }) => {
    const today = todayJst();
    await saveMetric(page, today, { weight: 70 });
    await go(page, `/metrics/new?date=${today}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "この日の記録を削除" }).click();
    await page.waitForURL(/\/\?month=/);
    await expect(page.getByText("この日の記録はありません")).toBeVisible();
  });
});
