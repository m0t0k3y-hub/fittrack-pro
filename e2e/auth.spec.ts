import { expect, test as base } from "@playwright/test";
import { confirmationLink, formError, go, login, newAccount, test } from "./helpers";

base.describe("認証", () => {
  base("メール確認前はログインできず、確認リンクを開くとログインできる", async ({ page }) => {
    const account = newAccount();
    await go(page, "/signup");
    await page.getByLabel("ニックネーム").fill(account.nickname);
    await page.getByLabel("メールアドレス").fill(account.email);
    await page.getByLabel(/パスワード/).fill(account.password);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page.getByText("確認メールを送信しました")).toBeVisible();

    await login(page, account);
    await expect(formError(page)).toContainText("正しくありません");
    await expect(page).toHaveURL(/\/login/);

    const link = await confirmationLink(account.email);
    expect(link).toContain("/auth/confirm?token_hash=");
    await page.goto(link);
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: "Bodymenter" })).toBeVisible();
  });

  base("短すぎるパスワードでは登録できない", async ({ page }) => {
    await go(page, "/signup");
    await page.getByLabel("ニックネーム").fill("x");
    await page.getByLabel("メールアドレス").fill(newAccount().email);
    await page.getByLabel(/パスワード/).fill("short");
    await page.getByRole("button", { name: "登録する" }).click();
    // ブラウザの minLength 検証で送信されない
    await expect(page.getByText("確認メールを送信しました")).toHaveCount(0);
    await expect(page).toHaveURL(/\/signup/);
  });

  base("無効な確認リンクはログイン画面に戻される", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=invalid&type=email");
    await page.waitForURL(/\/login\?error=confirm/);
    await expect(page.getByText("確認リンクが無効か期限切れです")).toBeVisible();
  });

  base("未ログインでは保護ページから /login へ移動する", async ({ page }) => {
    for (const path of ["/", "/analytics", "/settings/exercises", "/workouts/new", "/metrics/new"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("ログアウトして再ログインできる。誤ったパスワードは拒否される", async ({ page, account }) => {
    await go(page, "/settings/exercises");
    await page.getByRole("button", { name: "ログアウト" }).click();
    await page.waitForURL(/\/login/);

    await login(page, { email: account.email, password: "wrongpassword" });
    await expect(formError(page)).toContainText("正しくありません");

    await login(page, account);
    await page.waitForURL("/");
  });

  test("ログイン済みで /login を開くとホームへ移動する", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });
});
