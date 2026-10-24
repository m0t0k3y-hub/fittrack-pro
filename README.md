# Bodymenter

トレーニング（予定・実績）と体組成を記録・可視化する、スマートフォン主体のレスポンシブ Web アプリ。

- 仕様: [docs/spec.md](docs/spec.md) / 設計: [docs/design-specs/design.md](docs/design-specs/design.md)
- 技術: Next.js 16 (App Router) / Tailwind CSS / Recharts / Supabase (PostgreSQL + Auth) / Vercel

## 開発のはじめ方

前提: Node.js、Docker、[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

```bash
npm install
supabase start          # ローカルの Supabase を起動（初回はイメージ取得に時間がかかる）
cp .env.example .env.local
# .env.local の NEXT_PUBLIC_SUPABASE_ANON_KEY に、`supabase status` の anon key を設定する
npm run dev             # http://localhost:3000
```

- DB スキーマは [supabase/migrations/](supabase/migrations/) で管理（テーブル、RLS、RPC、デフォルト種目）。
  `supabase db reset` で初期化できる。
- 確認メールはローカルの Mailpit (http://127.0.0.1:54324) で受信できる。
- 確認メールのリンクをアプリの `/auth/confirm` に向けるため、メールテンプレートを
  [supabase/templates/confirmation.html](supabase/templates/confirmation.html) で差し替えている。
  **本番の Supabase プロジェクトにも同じテンプレート（Authentication → Email Templates → Confirm signup）を設定すること。**

## E2E テスト (Playwright)

```bash
npx playwright install chromium   # 初回のみ
supabase start                    # Supabase とメール受信箱 (Mailpit) が必要
npm run test:e2e                  # 開発サーバーを自動起動して実行
E2E_PROD=1 npm run test:e2e       # 本番ビルドで実行（速く、並列でも安定する。CI ではこちら）
npm run test:e2e:ui               # UI モード
```

- テストごとに新規ユーザーを登録するため、DB のリセットは不要（互いに独立して並列実行できる）。
- ポートは `localhost:3000` 固定（Supabase の `site_url` / リダイレクト設定が前提）。
- 画面は日本時間で「今日」を判定する。テストも日本時間で日付を組み立てている。
- テストの構成: `e2e/auth` / `calendar` / `metrics` / `workouts` / `analytics` / `settings` / `isolation`（ユーザー間のデータ分離）。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm start` | 本番ビルド / 起動 |
| `npm run lint` | ESLint |
| `npm run test:e2e` | E2E テスト |
