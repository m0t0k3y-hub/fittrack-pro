import { expect, formError, go, test, todayJst } from "./helpers";

test.describe("設定", () => {
  test("プロフィール（ニックネーム・身長）を保存できる", async ({ page, account }) => {
    await go(page, "/settings/exercises");
    await expect(page.getByLabel("ニックネーム")).toHaveValue(account.nickname);

    await page.getByLabel("ニックネーム").fill("新しい名前");
    await page.getByLabel("身長 (cm)").fill("172.5");
    await page.getByRole("button", { name: "プロフィールを保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("ニックネーム")).toHaveValue("新しい名前");
    await expect(page.getByLabel("身長 (cm)")).toHaveValue("172.5");
  });

  test("プロフィールの検証: 範囲外の身長、空のニックネーム", async ({ page }) => {
    await go(page, "/settings/exercises");
    await page.getByLabel("身長 (cm)").fill("49");
    await page.getByRole("button", { name: "プロフィールを保存" }).click();
    await expect(formError(page)).toContainText("50〜250cm");

    await page.getByLabel("身長 (cm)").fill("170");
    await page.getByLabel("ニックネーム").fill("   ");
    await page.getByRole("button", { name: "プロフィールを保存" }).click();
    await expect(formError(page)).toContainText("ニックネームを入力");
  });

  test("デフォルト種目が部位別に表示される", async ({ page }) => {
    await go(page, "/settings/exercises");
    const defaults = page.getByRole("region", { name: "デフォルト種目" });
    await expect(defaults).toContainText("ベンチプレス");
    await expect(defaults).toContainText("デッドリフト");
    await expect(defaults).toContainText("スクワット");
  });

  test("カスタム種目: 追加→編集→削除。削除した種目は選択肢から消え、過去の記録の表示は残る", async ({ page }) => {
    await go(page, "/settings/exercises");

    await page.getByLabel("新しい種目名").fill("ケーブルフライ");
    await page.getByLabel("部位").first().selectOption("chest");
    await page.getByRole("button", { name: "種目を追加" }).click();
    await expect(page.getByRole("region", { name: "カスタム種目" })).toContainText("ケーブルフライ");

    // 編集
    await page.getByRole("button", { name: "ケーブルフライを編集" }).click();
    await page.getByLabel("種目名", { exact: true }).fill("ケーブルクロス");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("region", { name: "カスタム種目" })).toContainText("ケーブルクロス");

    // ワークアウトで使えて、記録を残す
    const today = todayJst();
    await go(page, `/workouts/new?date=${today}`);
    await page.getByLabel("追加する種目").selectOption({ label: "ケーブルクロス" });
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await page.getByLabel("1セット目の重量(kg)").fill("20");
    await page.getByLabel("1セット目の回数").fill("12");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/\?month=/);

    // 削除（論理削除）
    await go(page, "/settings/exercises");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "ケーブルクロスを削除" }).click();
    await expect(page.getByText("カスタム種目はまだありません")).toBeVisible();

    await go(page, `/workouts/new?date=${today}`);
    await expect(page.getByLabel("追加する種目").locator("option", { hasText: "ケーブルクロス" })).toHaveCount(0);

    // 過去の記録には種目名が残る
    await go(page, `/?date=${today}`);
    await expect(page.getByRole("region", { name: "選択日のサマリー" })).toContainText("ケーブルクロス");
  });

  test("同名の種目は追加できない（デフォルト種目と同名を含む）", async ({ page }) => {
    await go(page, "/settings/exercises");

    await page.getByLabel("新しい種目名").fill("ベンチプレス");
    await page.getByRole("button", { name: "種目を追加" }).click();
    await expect(formError(page)).toContainText("同じ名前");

    await page.getByLabel("新しい種目名").fill("オリジナル種目");
    await page.getByRole("button", { name: "種目を追加" }).click();
    await expect(page.getByRole("region", { name: "カスタム種目" })).toContainText("オリジナル種目");
    await page.getByLabel("新しい種目名").fill("オリジナル種目");
    await page.getByRole("button", { name: "種目を追加" }).click();
    await expect(formError(page)).toContainText("同じ名前");
  });
});
