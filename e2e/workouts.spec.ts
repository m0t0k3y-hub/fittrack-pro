import { addDays, createWorkout, expect, formError, go, test, todayJst } from "./helpers";

const summary = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "選択日のサマリー" });

test.describe("ワークアウト", () => {
  test("実績を保存すると、サマリー・メモ・カレンダーのバッジに反映される", async ({ page }) => {
    const today = todayJst();
    await createWorkout(page, {
      date: today,
      status: "done",
      exercise: "ベンチプレス",
      sets: [
        { weight: 60, reps: 10, done: true },
        { weight: 62.5, reps: 8, done: true },
      ],
      memo: "調子よい",
    });

    await expect(summary(page)).toContainText("実績");
    await expect(summary(page)).toContainText("ベンチプレス");
    await expect(summary(page)).toContainText("60kg × 10 / 62.5kg × 8");
    await expect(summary(page)).toContainText("調子よい");
    await expect(page.getByRole("link", { name: new RegExp(`^${Number(today.slice(8))}日、実績あり`) })).toBeVisible();
  });

  test("予定は予定バッジで表示され、実績に切り替えて保存できる", async ({ page }) => {
    const date = addDays(todayJst(), 1);
    await createWorkout(page, {
      date,
      status: "planned",
      exercise: "スクワット",
      sets: [{ weight: 80, reps: 5 }],
    });
    await expect(summary(page)).toContainText("予定");
    await expect(page.getByRole("link", { name: new RegExp(`^${Number(date.slice(8))}日、予定あり`) })).toBeVisible();

    await summary(page).getByRole("link").first().click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "実績", exact: true }).click();
    await page.getByLabel("1セット目を完了").check();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/\?month=/);
    await expect(summary(page)).toContainText("実績");
    await expect(page.getByRole("link", { name: new RegExp(`^${Number(date.slice(8))}日、実績あり`) })).toBeVisible();
  });

  test("同じ日に予定と実績を両方持てる", async ({ page }) => {
    const today = todayJst();
    await createWorkout(page, { date: today, status: "planned", exercise: "ベンチプレス", sets: [{ weight: 60, reps: 10 }] });
    await createWorkout(page, { date: today, status: "done", exercise: "スクワット", sets: [{ weight: 80, reps: 5, done: true }] });
    await expect(page.getByRole("link", { name: new RegExp(`^${Number(today.slice(8))}日、実績あり、予定あり`) })).toBeVisible();
    await expect(summary(page).getByRole("link")).toHaveCount(2);
  });

  test("編集できる。削除すると消える", async ({ page }) => {
    const today = todayJst();
    await createWorkout(page, {
      date: today,
      status: "done",
      exercise: "ベンチプレス",
      sets: [
        { weight: 60, reps: 10, done: true },
        { weight: 60, reps: 10, done: true },
      ],
    });

    await summary(page).getByRole("link").first().click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel(/セット目の重量\(kg\)/)).toHaveCount(2);
    await page.getByLabel("2セット目の重量(kg)").fill("65");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/\?month=/);
    await expect(summary(page)).toContainText("60kg × 10 / 65kg × 10");

    await summary(page).getByRole("link").first().click();
    await page.waitForURL(/\/workouts\/[0-9a-f-]{36}$/);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "このワークアウトを削除" }).click();
    await page.waitForURL(/\/\?month=/);
    await expect(page.getByText("この日の記録はありません")).toBeVisible();
  });

  test("入力補助: セット数の増減、0.5kg刻みの±、前回の重量目安", async ({ page }) => {
    await createWorkout(page, {
      date: addDays(todayJst(), -3),
      status: "done",
      exercise: "ベンチプレス",
      sets: [{ weight: 62.5, reps: 8, done: true }],
    });

    await go(page, `/workouts/new?date=${todayJst()}`);
    await page.getByLabel("追加する種目").selectOption({ label: "ベンチプレス" });
    await page.getByRole("button", { name: "追加", exact: true }).click();

    // 前回の最終セットが目安として表示され、初期値になる
    await expect(page.getByText(/前回（.*）: 62.5kg × 8/)).toBeVisible();
    await expect(page.getByLabel("1セット目の重量(kg)")).toHaveValue("62.5");
    await expect(page.getByLabel("1セット目の回数")).toHaveValue("8");

    await page.getByRole("button", { name: "セットを増やす" }).click();
    await expect(page.getByLabel("2セット目の重量(kg)")).toHaveValue("62.5");

    await page.getByRole("button", { name: "重量を0.5kg増やす" }).first().click();
    await expect(page.getByLabel("1セット目の重量(kg)")).toHaveValue("63");
    await page.getByRole("button", { name: "重量を0.5kg減らす" }).nth(1).click();
    await expect(page.getByLabel("2セット目の重量(kg)")).toHaveValue("62");

    await page.getByRole("button", { name: "セットを減らす" }).click();
    await expect(page.getByLabel(/セット目の重量\(kg\)/)).toHaveCount(1);

    // テンキーが出る入力モード
    await expect(page.getByLabel("1セット目の重量(kg)")).toHaveAttribute("inputmode", "decimal");
    await expect(page.getByLabel("1セット目の回数")).toHaveAttribute("inputmode", "numeric");
  });

  test("検証: 未入力、0.5kg刻みでない値は保存できない", async ({ page }) => {
    await go(page, `/workouts/new?date=${todayJst()}`);
    await page.getByLabel("追加する種目").selectOption({ label: "ベンチプレス" });
    await page.getByRole("button", { name: "追加", exact: true }).click();

    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(formError(page)).toContainText("重量と回数をすべてのセットに入力");

    await page.getByLabel("1セット目の重量(kg)").fill("60.3");
    await page.getByLabel("1セット目の回数").fill("10");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(formError(page)).toContainText("0.5kg刻み");
  });

  test("種目がないと保存できない", async ({ page }) => {
    await go(page, `/workouts/new?date=${todayJst()}`);
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  });

  test("前回メニューのコピー: セット構成だけが引き継がれ、完了チェックとメモは引き継がれない", async ({ page }) => {
    const today = todayJst();
    await createWorkout(page, {
      date: today,
      status: "done",
      exercise: "ベンチプレス",
      sets: [
        { weight: 60, reps: 10, done: true },
        { weight: 62.5, reps: 8, done: true },
        { weight: 65, reps: 6, done: true },
      ],
      memo: "引き継がれないメモ",
    });

    const tomorrow = addDays(today, 1);
    await go(page, `/workouts/new?date=${tomorrow}`);
    await page.getByRole("region", { name: "過去の記録からコピー" }).getByRole("link").first().click();
    await page.waitForURL(/copy=/);

    await expect(page.getByLabel(/セット目の重量\(kg\)/)).toHaveCount(3);
    await expect(page.getByLabel("2セット目の重量(kg)")).toHaveValue("62.5");
    await expect(page.getByLabel("3セット目の回数")).toHaveValue("6");
    for (const n of [1, 2, 3]) await expect(page.getByLabel(`${n}セット目を完了`)).not.toBeChecked();
    await expect(page.getByLabel("メモ")).toHaveValue("");
    await expect(page.getByLabel("日付")).toHaveValue(tomorrow);
    await expect(page.getByRole("button", { name: "予定", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/\?month=/);
    await expect(summary(page)).toContainText("予定");
    await expect(summary(page)).toContainText("60kg × 10 / 62.5kg × 8 / 65kg × 6");
  });

  test("存在しない/不正なIDは not-found 画面になり、編集フォームは出ない", async ({ page }) => {
    // ストリーミング応答のため HTTP ステータスは 200 だが、画面は not-found になる
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      await go(page, `/workouts/${id}`);
      await expect(page.getByText("This page could not be found")).toBeVisible();
      await expect(page.getByRole("button", { name: "保存", exact: true })).toHaveCount(0);
    }
  });
});
