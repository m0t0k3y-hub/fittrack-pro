# デプロイ手順

構成: **Vercel**（Next.js）＋ **Supabase**（PostgreSQL + Auth）。独自のサーバーは無く、DB のデータ分離は
PostgreSQL の Row Level Security (RLS) で担保している。

リポジトリ側で用意済みのもの:

| ファイル | 内容 |
| --- | --- |
| [vercel.json](../vercel.json) | Vercel のリージョンを東京 (`hnd1`) に固定 |
| [next.config.ts](../next.config.ts) | セキュリティヘッダー（nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy / HSTS） |
| [supabase/migrations/](../supabase/migrations/) | テーブル・RLS・RPC・デフォルト種目 |
| [supabase/config.toml](../supabase/config.toml) | ローカル設定。`[remotes.production]` に本番用の上書き（Site URL など） |
| [supabase/templates/confirmation.html](../supabase/templates/confirmation.html) | 確認メールのテンプレート（**任意**。独自 SMTP の設定後に使える） |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | lint / ビルド / E2E |

以下は、アカウントの操作が必要なので手動で行う。**順番どおりに進めること**（4 で本番のURLが決まらないと 3 の設定ができない）。

---

## 1. Supabase の本番プロジェクトを作る

1. https://supabase.com/dashboard で New project。
   - **Region は Tokyo (`ap-northeast-1`)**（Vercel の `hnd1` と近くに置く）。
   - Database password を控える（後で `supabase link` に使う）。
2. Project Settings → API から次を控える。
   - Project URL（`https://<ref>.supabase.co`）
   - anon / publishable key
   - Project ref（URL の `<ref>` 部分）

> `service_role` / secret key は **どこにも設定しない**。このアプリは使わない。

## 2. マイグレーションを適用する

```bash
supabase login
supabase link --project-ref <ref>        # DB パスワードを聞かれる
supabase db push --dry-run               # 適用されるマイグレーションを確認
supabase db push                         # 適用
```

- `supabase db push` は、デフォルト種目（`exercises` の seed）も含めて適用する。
- マイグレーションは**前に進めるだけ**。適用済みのファイルは書き換えず、変更は新しいファイルで足す。
- Auth の設定は `supabase config push` で反映する（次の 3）。`supabase/config.toml` のローカル用の値（`site_url = http://localhost:3000` など）で
  本番を上書きしないよう、**本番用の値は `[remotes.production]` に書いてある**。`project_id` が一致するときだけ適用される。
  必ず先に `supabase config diff --project-ref <ref>` で差分を確認すること。

適用後に RLS が全テーブルで有効なことを確認する（SQL Editor で実行。**0 行が正しい**）。

```sql
select tablename from pg_tables where schemaname = 'public' and not rowsecurity;
```

## 3. Supabase の Auth を設定する

`supabase/config.toml` の `[remotes.production]` に、本番の Site URL とリダイレクト URL を書いてある
（`project_id` と URL は、自分のプロジェクトのものに書き換える）。反映:

```bash
supabase config diff --project-ref <ref>     # 差分の確認（読み取りのみ）
supabase config push --project-ref <ref>     # 反映（差分が表示され、確認を求められる）
```

反映される項目:

| 項目 | 値 |
| --- | --- |
| Site URL | 本番の URL（例: `https://bodymenter.vercel.app`）。確認メールのリンクの基準になる |
| Redirect URLs | `https://<本番ドメイン>/**` |
| Minimum password length | **8**（アプリの検証と合わせる） |
| Confirm email | 有効（新規プロジェクトの既定） |

`[remotes.production]` には、ローカル用の値で本番の設定を変えないよう、本番の現在値に揃えた項目
（メールの再送間隔、OTP の桁数、MFA、プール設定など）も書いてある。`config diff` の結果が上の項目だけになっていることを確認する。

### 確認メールのテンプレートについて

**無料プラン＋既定のメール送信では、メールテンプレートを変更できない**（`config push` が 400 で失敗する）。
そのため既定のテンプレートで動くようにしてある:

1. 確認メールのリンクは Supabase の `/auth/v1/verify` を経由して、アプリの `/auth/confirm?code=…` に戻る。
2. アプリが `code` をセッションに交換してログインする。

制限: この方式は **登録したのと同じブラウザでリンクを開く必要がある**（PKCE のため）。別の端末で開くと「確認リンクが無効」と表示される。
別端末でも開けるようにしたい場合は、独自 SMTP を設定した後に、`config.toml` のコメントアウトされた
`[auth.email.template.confirmation]`（[confirmation.html](../supabase/templates/confirmation.html)）を有効にして `config push` する。
このテンプレートは `token_hash` 方式のリンクで、アプリの `/auth/confirm` は両方の方式に対応している。

### SMTP（本番では必須）

Supabase の組み込みメール送信は、**送信数の上限が厳しく**、**チームメンバー以外の宛先に送れない**制限がある（本番利用は想定されていない）。
このままだと、一般のユーザーは確認メールを受け取れず、登録できない。
制限の最新の内容は公式ドキュメント（https://supabase.com/docs/guides/auth/auth-smtp）で確認すること。

Project Settings → Authentication → SMTP Settings で、独自の SMTP（Resend / SendGrid / Amazon SES など）を設定する。
送信元ドメインには SPF / DKIM を設定しておくこと（迷惑メール扱いを避けるため）。

## 4. Vercel にデプロイする

1. https://vercel.com/new で、GitHub リポジトリ（`m0t0k3y-hub/fittrack-pro`）を Import。
   Framework は Next.js が自動検出される。Build / Install コマンドは既定のままでよい。
2. Environment Variables を設定（**Production** と、使うなら **Preview**）。

   | 名前 | 値 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 手順 1 の Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 手順 1 の anon / publishable key |
   | `NEXT_PUBLIC_SITE_URL` | 本番の URL（例: `https://bodymenter.example.com`） |

   `NEXT_PUBLIC_` で始まる値は**ビルド時に埋め込まれる**。値を変えたら再デプロイする。
   CLI で追加するときは、anon key は公開前提の値なので `--type config` を指定する
   （`vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY --environment production --type config --value "<key>" --yes`）。
3. Deploy。カスタムドメインを使う場合は Settings → Domains で追加し、その URL を手順 3 の Site URL / Redirect URLs と
   `NEXT_PUBLIC_SITE_URL` に反映する。

### Preview デプロイについて

確認メールのリンクは **Supabase の Site URL（本番）** を基準にするため、Preview の URL では新規登録を完了できない。
Preview で登録まで試したい場合は、**別の Supabase プロジェクト（staging）** を用意して、Preview の環境変数をそちらに向ける。

## 5. 公開後の動作確認（手動）

- [ ] `/signup` で登録 → 確認メールが**実際のメールアドレスに届く** → **同じブラウザで**リンクを開くとカレンダーに入る
- [ ] 身体計測、ワークアウト（予定 / 実績）、前回メニューのコピーが保存できる
- [ ] 分析画面のグラフが表示される
- [ ] 設定画面でカスタム種目の追加・削除、プロフィール保存ができる
- [ ] 2 つ目のアカウントで、1 つ目のデータが見えない
- [ ] ログアウトして再ログインできる

---

## 運用メモ

- **CI**: `main` への push と PR で、lint / ビルド / E2E（ローカル Supabase を CI 内で起動）が動く。
  Vercel のデプロイを CI の成功に連動させたい場合は、GitHub のブランチ保護で `CI` を必須にする。
- **本番 DB へのマイグレーション適用は手動**（`supabase db push`）。誤った適用が取り返しにくいため、CI からの自動適用はしていない。
  適用はアプリのデプロイ**より先**に行う（新しいアプリが新しいカラムを前提にするため）。
- **ロールバック**: アプリは Vercel の Deployments から過去のデプロイを Promote で戻せる。DB は戻せないので、
  破壊的な変更（カラム削除など）は、アプリが使わなくなったことを確認した**後の別のマイグレーション**で行う。
- **バックアップ**: Supabase の無料プランには自動バックアップ（PITR）が無い。データが重要になったら有料プランにする。
- **CSP（Content-Security-Policy）は未設定**。Next.js のインラインスクリプトには nonce が必要で、設定の影響が大きいため。
  必要になったら、Report-Only で導入して違反を確認してから強制に切り替える。
- **取得上限**: 分析画面は 1 回あたり最大 1000 行（毎日記録して約 2.7 年分）を取得する。それを超える場合は、ページ分割が必要。
- **アカウント削除の UI は無い**（スコープ外）。必要になったら、`auth.users` の削除と、関連データの `ON DELETE CASCADE` で消える。
