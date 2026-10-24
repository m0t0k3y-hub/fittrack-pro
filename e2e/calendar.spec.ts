import { addDays, expect, test, todayJst } from "./helpers";

test.describe("カレンダー", () => {
  test("今月が表示され、前月・翌月に移動できる。日付をタップで選択できる", async ({ page }) => {
    const today = todayJst();
    const [y, m] = today.split("-").map(Number);

    await expect(page.getByRole("heading", { name: `${y}年${m}月` })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`^${Number(today.slice(8))}日`) })).toHaveAttribute("aria-current", "date");

    await page.getByRole("link", { name: "前の月" }).click();
    const prev = new Date(Date.UTC(y, m - 2, 1));
    await expect(page.getByRole("heading", { name: `${prev.getUTCFullYear()}年${prev.getUTCMonth() + 1}月` })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`month=${prev.toISOString().slice(0, 7)}`));

    await page.getByRole("link", { name: "15日" }).click();
    await expect(page.getByRole("region", { name: "選択日のサマリー" })).toContainText("15日");
    await expect(page.getByRole("link", { name: "15日" })).toHaveAttribute("aria-current", "date");
  });

  test("不正な month / date パラメータでも壊れない", async ({ page }) => {
    for (const q of ["month=2026-13", "date=2026-02-30", "month=abc&date=zzz"]) {
      const res = await page.goto(`/?${q}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Bodymenter" })).toBeVisible();
    }
  });

  test("FAB から身体計測・ワークアウトの入力へ、選択中の日付で遷移する", async ({ page }) => {
    const date = addDays(todayJst(), 0);
    await page.getByRole("button", { name: "記録・予定を追加" }).click();
    await page.getByRole("link", { name: "ワークアウトを記録・予定" }).click();
    await page.waitForURL(new RegExp(`/workouts/new\\?date=${date}`));
    await expect(page.getByLabel("日付")).toHaveValue(date);
  });

  test("下部ナビで画面を移動できる", async ({ page }) => {
    await page.getByRole("link", { name: "分析" }).click();
    await page.waitForURL(/\/analytics/);
    await expect(page.getByRole("heading", { name: "分析" })).toBeVisible();
    await page.getByRole("link", { name: "設定" }).click();
    await page.waitForURL(/\/settings\/exercises/);
    await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();
    await page.getByRole("link", { name: "カレンダー" }).click();
    await page.waitForURL("/");
  });
});
