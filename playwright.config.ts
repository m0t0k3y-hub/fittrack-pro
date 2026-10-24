import { defineConfig, devices } from "@playwright/test";

// E2E_PROD=1 または CI では本番ビルドで検証する。開発サーバーは初回アクセス時に各ルートを
// コンパイルするため、並列実行するとタイムアウトしやすい。
const useProd = !!(process.env.CI || process.env.E2E_PROD);

// 前提: `supabase start` でローカルの Supabase が起動していること（README の「E2E テスト」参照）。
// テストごとに新規ユーザーを作るため、DB のリセットは不要。
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: useProd ? 4 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    // スマートフォン操作が主想定のため、モバイルのビューポートで検証する
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: useProd ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    // Supabase の site_url / リダイレクト設定が localhost:3000 前提のためポートは固定
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
