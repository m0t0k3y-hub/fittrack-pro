import { addDays, createWorkout, expect, go, saveMetric, test, todayJst } from "./helpers";

test.describe("分析", () => {
  test("記録がない状態では、各グラフが空状態を表示する", async ({ page }) => {
    await go(page, "/analytics");
    await expect(page.getByText("この期間の体重の記録がありません")).toBeVisible();
    await expect(page.getByText("この期間の体脂肪率の記録がありません")).toBeVisible();
    await expect(page.getByText("まだ該当する記録がありません")).toBeVisible();
  });

  test("体重グラフ: 最新値と、欠損日の線形補間（実測点のみマーカー）", async ({ page }) => {
    const today = todayJst();
    await saveMetric(page, addDays(today, -4), { weight: 65 });
    await saveMetric(page, today, { weight: 70 });

    await go(page, "/analytics?range=1w");
    const weight = page.getByRole("region", { name: "体重", exact: true });
    await expect(weight.locator("svg.recharts-surface")).toBeVisible();
    await expect(weight).toContainText("70.0");

    // 実測は2点だけ。間の3日は補間で線がつながる（1週間 = 7日分: −6日〜今日。実測は −4日 と 今日）
    await expect(weight.locator("svg.recharts-surface circle")).toHaveCount(2);

    // −2日（7日分のうち左から5番目）は、65 と 70 の中間 67.5 の補間値
    const box = (await weight.locator("svg.recharts-surface").boundingBox())!;
    const plotLeft = box.x + 44; // Y軸の幅
    const plotRight = box.x + box.width - 12; // 右マージン
    await page.mouse.move(plotLeft + ((plotRight - plotLeft) * 4) / 6, box.y + box.height / 2);
    const tip = page.locator(".recharts-tooltip-wrapper").first();
    await expect(tip).toContainText("67.5kg");
    await expect(tip).toContainText("補間");

    // 表では実測値のみ
    await weight.getByText("表で見る").click();
    await expect(weight.locator("tbody tr")).toHaveCount(2);

    // 体脂肪率は未記録
    await expect(page.getByText("この期間の体脂肪率の記録がありません")).toBeVisible();
  });

  test("期間の切替: 範囲外の記録は含まれず、全期間では含まれる", async ({ page }) => {
    const today = todayJst();
    await saveMetric(page, addDays(today, -60), { weight: 80 });

    await go(page, "/analytics?range=1m");
    await expect(page.getByText("この期間の体重の記録がありません")).toBeVisible();

    await page.getByRole("link", { name: "3ヶ月" }).click();
    await page.waitForURL(/range=3m/);
    await expect(page.getByRole("region", { name: "体重", exact: true })).toContainText("80.0");

    await page.getByRole("link", { name: "全期間" }).click();
    await page.waitForURL(/range=all/);
    await expect(page.getByRole("region", { name: "体重", exact: true })).toContainText("80.0");
    await expect(page.getByRole("navigation", { name: "期間" }).getByRole("link", { name: "全期間" })).toHaveAttribute("aria-current", "true");
  });

  test("筋トレ実績: 最大挙上重量と総負荷量。集計対象は実績ログの完了済みセットのみ", async ({ page }) => {
    const today = todayJst();
    await createWorkout(page, {
      date: today,
      status: "done",
      exercise: "ベンチプレス",
      sets: [
        { weight: 60, reps: 10, done: true },
        { weight: 62.5, reps: 8, done: true },
        { weight: 65, reps: 6, done: true },
        { weight: 100, reps: 1, done: false }, // 完了チェックなし → 対象外
      ],
    });
    // 予定ログ、完了チェックのない実績ログの種目は、選択肢に出ない
    await createWorkout(page, { date: addDays(today, 1), status: "planned", exercise: "スクワット", sets: [{ weight: 80, reps: 5, done: true }] });
    await createWorkout(page, { date: today, status: "done", exercise: "懸垂", sets: [{ weight: 0, reps: 10 }] });

    await go(page, "/analytics?range=1m");
    const options = await page.getByLabel("種目").locator("option").allInnerTexts();
    expect(options).toEqual(["ベンチプレス"]);

    const card = page.getByRole("region", { name: "ベンチプレスの最大挙上重量" });
    await expect(card).toContainText("65.0");

    await page.getByRole("link", { name: "総負荷量" }).click();
    await page.waitForURL(/metric=volume/);
    // 60×10 + 62.5×8 + 65×6 = 1490（100kg×1 は含まれない）
    await expect(page.getByRole("region", { name: "ベンチプレスの総負荷量" })).toContainText("1490");
  });

  test("種目を切り替えるとグラフが切り替わり、期間・指標は保持される", async ({ page }) => {
    const today = todayJst();
    await createWorkout(page, { date: addDays(today, -1), status: "done", exercise: "ベンチプレス", sets: [{ weight: 60, reps: 10, done: true }] });
    await createWorkout(page, { date: today, status: "done", exercise: "スクワット", sets: [{ weight: 100, reps: 5, done: true }] });

    await go(page, "/analytics?range=3m&metric=volume");
    // 直近に実施した種目が既定で選ばれる
    await expect(page.getByLabel("種目")).toHaveValue(await page.getByLabel("種目").locator("option", { hasText: "スクワット" }).getAttribute("value") ?? "");
    await expect(page.getByRole("region", { name: "スクワットの総負荷量" })).toContainText("500");

    await page.getByLabel("種目").selectOption({ label: "ベンチプレス" });
    await page.waitForURL(/ex=/);
    await expect(page).toHaveURL(/range=3m/);
    await expect(page).toHaveURL(/metric=volume/);
    await expect(page.getByRole("region", { name: "ベンチプレスの総負荷量" })).toContainText("600");
  });

  test("不正なパラメータでも既定値で表示される", async ({ page }) => {
    const res = await page.goto("/analytics?range=zzz&metric=zzz&ex=not-a-uuid");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "分析" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "期間" }).getByRole("link", { name: "1ヶ月" })).toHaveAttribute("aria-current", "true");
  });
});
