import { expect, test as base, type Locator, type Page } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const PASSWORD = "password123";

// アプリは日本時間で「今日」を判定する (lib/date.ts)
export const todayJst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Suspense のフォールバックと本体が一時的に並ぶため、読み込み完了まで待ってから操作する
export async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

// Next.js の経路アナウンサーも role="alert" を持つため、フォームのエラー表示だけを指す
export const formError = (page: Page): Locator => page.locator('p[role="alert"]');

export type Account = { email: string; password: string; nickname: string };

async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json();
    const msg = list.messages.find((m: { To: { Address: string }[] }) => m.To.some((t) => t.Address === email));
    if (msg) {
      const full = await (await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)).json();
      const href = /href="([^"]+)"/.exec(full.HTML)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`確認メールが届きませんでした: ${email}`);
}

export function newAccount(): Account {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { email: `e2e-${id}@example.com`, password: PASSWORD, nickname: `テスト${id.slice(-4)}` };
}

// 新規登録 → 確認メールのリンクを開く。成功するとログイン済みでカレンダーに着地する
export async function registerAndLogin(page: Page): Promise<Account> {
  const account = newAccount();
  await go(page, "/signup");
  await page.getByLabel("ニックネーム").fill(account.nickname);
  await page.getByLabel("メールアドレス").fill(account.email);
  await page.getByLabel(/パスワード/).fill(account.password);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByText("確認メールを送信しました")).toBeVisible();

  await page.goto(await confirmationLink(account.email));
  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "Bodymenter" })).toBeVisible();
  return account;
}

export async function login(page: Page, account: Pick<Account, "email" | "password">) {
  await go(page, "/login");
  await page.getByLabel("メールアドレス").fill(account.email);
  await page.getByLabel(/パスワード/).fill(account.password);
  await page.getByRole("button", { name: "ログイン" }).first().click();
}

export { confirmationLink };

type SetInput = { weight: number; reps: number; done?: boolean };

// ワークアウトを新規作成して保存する（保存後はカレンダーに戻る）
export async function createWorkout(
  page: Page,
  opts: { date: string; status: "planned" | "done"; exercise: string; sets: SetInput[]; memo?: string },
) {
  await go(page, `/workouts/new?date=${opts.date}`);
  await page.getByLabel("追加する種目").selectOption({ label: opts.exercise });
  await page.getByRole("button", { name: "追加", exact: true }).click();
  for (let i = 1; i < opts.sets.length; i++) {
    await page.getByRole("button", { name: "セットを増やす" }).click();
  }
  for (const [i, s] of opts.sets.entries()) {
    const n = i + 1;
    await page.getByLabel(`${n}セット目の重量(kg)`).fill(String(s.weight));
    await page.getByLabel(`${n}セット目の回数`).fill(String(s.reps));
    if (s.done) await page.getByLabel(`${n}セット目を完了`).check();
  }
  await page.getByRole("button", { name: opts.status === "done" ? "実績" : "予定", exact: true }).click();
  if (opts.memo) await page.getByLabel("メモ").fill(opts.memo);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForURL(/\/\?month=/);
}

export async function saveMetric(page: Page, date: string, m: { weight?: number; bodyFat?: number }) {
  await go(page, `/metrics/new?date=${date}`);
  if (m.weight !== undefined) await page.getByLabel("体重 (kg)").fill(String(m.weight));
  if (m.bodyFat !== undefined) await page.getByLabel("体脂肪率 (%)").fill(String(m.bodyFat));
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForURL(/\/\?month=/);
}

// ログイン済みの状態から始めるテスト用フィクスチャ。
// auto: true なので、テスト本体で参照しなくても必ず実行される（未ログインで始めたいテストは
// @playwright/test の test を直接使う）
export const test = base.extend<{ account: Account }>({
  account: [
    async ({ page }, use) => {
      await use(await registerAndLogin(page));
    },
    { auto: true },
  ],
});

export { expect };
