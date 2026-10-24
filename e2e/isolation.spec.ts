import { addDays, createWorkout, expect, go, registerAndLogin, saveMetric, test, todayJst } from "./helpers";

// 非機能要件「ユーザーごとのデータ完全分離」の回帰テスト。
// DB の RLS が効いていることを、画面経由で別ユーザーの操作として確認する。
test.describe("ユーザー間のデータ分離", () => {
  test("他のユーザーのワークアウト・身体計測・カスタム種目は見えず、操作もできない", async ({ page, browser }) => {
    const today = todayJst();

    // ユーザーA: 記録を作る
    await createWorkout(page, { date: today, status: "done", exercise: "ベンチプレス", sets: [{ weight: 60, reps: 10, done: true }], memo: "Aだけのメモ" });
    await saveMetric(page, today, { weight: 71.1 });
    await go(page, "/settings/exercises");
    await page.getByLabel("新しい種目名").fill("Aだけの種目");
    await page.getByRole("button", { name: "種目を追加" }).click();
    await expect(page.getByRole("region", { name: "カスタム種目" })).toContainText("Aだけの種目");

    await go(page, `/?date=${today}`);
    await page.getByRole("region", { name: "選択日のサマリー" }).getByRole("link").first().click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    const workoutUrl = new URL(page.url()).pathname;

    // ユーザーB
    const ctxB = await browser.newContext({ baseURL: "http://localhost:3000" });
    const b = await ctxB.newPage();
    await registerAndLogin(b);

    // Aのワークアウトの URL を直接開いても not-found（内容は見えない）
    await go(b, workoutUrl);
    await expect(b.getByText("This page could not be found")).toBeVisible();
    await expect(b.getByText("Aだけのメモ")).toHaveCount(0);

    // カレンダー・分析・種目一覧にAのデータは出ない
    await go(b, `/?date=${today}`);
    await expect(b.getByRole("region", { name: "選択日のサマリー" })).toContainText("この日の記録はありません");
    await expect(b.getByText("Aだけのメモ")).toHaveCount(0);

    await go(b, "/analytics?range=all");
    await expect(b.getByText("この期間の体重の記録がありません")).toBeVisible();
    await expect(b.getByText("まだ該当する記録がありません")).toBeVisible();

    await go(b, "/settings/exercises");
    await expect(b.getByText("Aだけの種目")).toHaveCount(0);
    await go(b, `/workouts/new?date=${addDays(today, 1)}`);
    await expect(b.getByLabel("追加する種目").locator("option", { hasText: "Aだけの種目" })).toHaveCount(0);
    // 前回メニューのコピー候補にも出ない
    await expect(b.getByRole("region", { name: "過去の記録からコピー" })).toHaveCount(0);

    // 身体計測の既存値も見えない
    await go(b, `/metrics/new?date=${today}`);
    await expect(b.getByLabel("体重 (kg)")).toHaveValue("");
    await ctxB.close();
  });
});
