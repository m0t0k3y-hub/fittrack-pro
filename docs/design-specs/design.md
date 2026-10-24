## 1. 画面設計

### 画面一覧

1. **認証画面 (`/login`, `/signup`)**: メール・パスワード入力、ログイン/サインアップ切り替え
2. **ホーム・カレンダー画面 (`/`)**:
* 月間カレンダー（予定/実績のステータスバッジ付き）
* 日付タップ時の当日サマリー表示（未完了予定／完了実績／体重）
* 「記録・予定を追加」FAB（フローティングアクションボタン）


3. **ワークアウト記録・編集画面 (`/workouts/[id]` または `/workouts/new`)**:
* 日付選択、ステータス切替トグル（「予定」⇄「実績」）
* 種目追加ドロップダウン / 検索
* セット入力リスト（`セット数`、`kg`、`reps`、前回の重量目安、完了チェックボックス）
* メモ欄（自由記述）


4. **身体計測入力モーダル/画面 (`/metrics/new`)**:
* 日付、体重(kg)、体脂肪率(%)のクイック入力


5. **分析・ダッシュボード画面 (`/analytics`)**:
* 体重・体脂肪率の折れ線グラフ（期間セレクター：1W / 1M / 3M / 全期間）
* 種目別ボリューム・MAX重量推移グラフ（種目セレクター付き）


6. **設定・種目マスタ画面 (`/settings/exercises`)**:
* デフォルト種目一覧、カスタム種目の追加・編集・削除
* 身長・基本プロフィール編集



### 画面遷移フロー

```text
[ 未認証 ]
  └── ログイン / サインアップ画面
        └── 認証成功 ──> [ カレンダー画面 (ホーム) ]

[ 認証済み (ホーム) ]
  ├── 日付選択 ──> ワークアウト記録・編集画面 (予定の消化 / 実績編集)
  ├── (+) ボタン ──> ワークアウト新規作成 または 身体計測入力モーダル
  ├── ナビゲーションバー
  │     ├── カレンダー (ホーム)
  │     ├── 分析 (グラフ)
  │     └── 設定 (カスタム種目・プロフィール)
  └── ログアウト ──> ログイン画面

```

---

## 2. システム構成

```text
[ ブラウザ (スマホ主体) ]
   │  HTTPS
[ Vercel: Next.js (App Router) ]
   ├─ Server Components / Server Actions … データ取得・更新
   └─ Client Components … カレンダー操作、入力フォーム、Recharts グラフ
   │  supabase-js / @supabase/ssr (ユーザーのJWTで接続)
[ Supabase ]
   ├─ Auth … メール・パスワード認証、セッション(Cookie)
   └─ PostgreSQL … データ + Row Level Security
```

| 項目 | 方針 |
| --- | --- |
| フレームワーク | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| グラフ | Recharts（折れ線のみ。軽量でReactと相性が良いため） |
| データアクセス | 独自APIサーバーは作らず、Server Actions / Server Components から Supabase を直接呼ぶ。service_role キーは使用しない |
| バリデーション | zod（フォーム入力・Server Action 入力の双方で共通スキーマを使う） |
| 環境 | local (Supabase CLI) / production (Vercel + Supabase)。DBスキーマは `supabase/migrations` で管理 |

---

## 3. 認証・認可設計

* 認証は Supabase Auth（メール＋パスワード、メール確認あり、パスワードリセットを含む）。
* セッションは `@supabase/ssr` で Cookie 管理。`middleware.ts` で未認証アクセスを `/login` へ、認証済みの `/login` `/signup` アクセスを `/` へリダイレクトする。
* ユーザー情報は `auth.users`（認証）＋ `profiles`（ニックネーム・身長）に分離する。`profiles.id = auth.users.id`。サインアップ時に DB トリガーで `profiles` を自動作成。
* **データ分離は RLS で担保**する（アプリ側の絞り込みに依存しない）。
  * `workout_logs` / `body_metrics` / `profiles`: `user_id = auth.uid()` の行のみ SELECT/INSERT/UPDATE/DELETE 可。
  * `workout_sets`: 親の `workout_logs.user_id = auth.uid()` を EXISTS で判定。
  * `exercises`: SELECT は `user_id IS NULL OR user_id = auth.uid()`。INSERT/UPDATE/DELETE は `user_id = auth.uid()` のみ（デフォルト種目は変更不可）。

---

## 4. データベース設計

### ER 図

```text
auth.users 1 ─── 1 profiles
auth.users 1 ─── * exercises (user_id NULL = デフォルト種目)
auth.users 1 ─── * workout_logs 1 ─── * workout_sets * ─── 1 exercises
auth.users 1 ─── * body_metrics
```

### テーブル定義

**profiles**

| カラム | 型 | 制約 / 備考 |
| --- | --- | --- |
| id | uuid | PK, FK → auth.users(id) ON DELETE CASCADE |
| nickname | text | NOT NULL |
| height_cm | numeric(4,1) | NULL可（未設定を許容）、CHECK 50〜250 |
| created_at / updated_at | timestamptz | default now() |

**exercises**

| カラム | 型 | 制約 / 備考 |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | NULL = デフォルト種目、FK → auth.users ON DELETE CASCADE |
| name | text | NOT NULL |
| target_muscle | text | NOT NULL, CHECK IN (`chest`,`back`,`legs`,`shoulders`,`arms`,`abs`,`other`) |
| archived_at | timestamptz | NULL = 有効。削除操作は論理削除（この列に日時を入れる） |
| created_at | timestamptz | default now() |

* UNIQUE (user_id, name) WHERE archived_at IS NULL（NULL の user_id は COALESCE で別途ユニーク扱い）。
* アーカイブ済み種目は、種目選択UIには出さないが、過去の記録・グラフでは名称を表示し続ける。

**workout_logs**（1回のトレーニング。1日に複数可）

| カラム | 型 | 制約 / 備考 |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | NOT NULL, FK |
| date | date | NOT NULL（ユーザーのローカル日付） |
| status | text | NOT NULL, CHECK IN (`planned`,`done`) |
| memo | text | インターバル・コンディション等 |
| created_at / updated_at | timestamptz | |

* INDEX (user_id, date)。`(user_id, date)` はユニークにしない。
* 予定→実績は **同一レコードの `status` を更新**する。予定値の履歴は保持しない（予定の重量・回数は実績入力時に上書き編集する）。

**workout_sets**

| カラム | 型 | 制約 / 備考 |
| --- | --- | --- |
| id | uuid | PK |
| workout_log_id | uuid | NOT NULL, FK ON DELETE CASCADE |
| exercise_id | uuid | NOT NULL, FK（論理削除のため参照は維持） |
| set_order | int | NOT NULL。ログ内の通し順（種目の並びもこれで表現） |
| weight_kg | numeric(5,1) | NOT NULL, CHECK >= 0 かつ 0.5の倍数（自重は 0） |
| reps | int | NOT NULL, CHECK > 0 |
| is_done | boolean | NOT NULL default false。セット単位の完了チェック |

* 1セット＝1行。UI の「セット数」入力は同一重量×回数のセット行を指定数だけ一括生成する操作とし、個別に編集可能。
* INDEX (workout_log_id, set_order)、INDEX (exercise_id)。
* 「前回の重量目安」は、同一ユーザー・同一種目の直近 `status='done'` ログの最終セットから取得する。

**body_metrics**

| カラム | 型 | 制約 / 備考 |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | NOT NULL, FK |
| date | date | NOT NULL |
| weight_kg | numeric(4,1) | NULL可、CHECK 20〜300 |
| body_fat_pct | numeric(3,1) | NULL可、CHECK 1〜70 |

* UNIQUE (user_id, date)。同日の再入力は upsert で上書き。
* 体重・体脂肪率はどちらか一方のみの入力も許容（少なくとも一方は必須）。

### 集計定義

| 指標 | 定義 |
| --- | --- |
| 最大挙上重量 (MAX) | 指定種目の `status='done'` かつ `is_done` のセットにおける日別 `MAX(weight_kg)` |
| 総負荷量 | 同上セットにおける日別 `SUM(weight_kg * reps)`（セット数は行数で反映済み） |
| カレンダーバッジ | 日内に `done` のログあり → 実績バッジ、`planned` のログあり → 予定バッジ。両方あれば両方表示 |

* 予定ログのセットは、グラフ集計の対象外とする。
* 集計は Postgres の VIEW（または RPC）で実装し、RLS が効くよう `security_invoker = true` とする。

---

## 5. 機能別の処理設計

| 機能 | 処理 | 備考 |
| --- | --- | --- |
| サインアップ | Auth signUp → 確認メール → トリガーで profiles 作成 | 初回ログイン後にニックネーム・身長入力を促す |
| カレンダー表示 | 表示月の `workout_logs` を `date` 範囲で取得し、日別にバッジ集約 | 月切替時に再取得 |
| 日付サマリー | 選択日の `workout_logs`（+種目名）と `body_metrics` を取得 | |
| ワークアウト保存 | ログ＋セット群を1トランザクションで保存（RPC `save_workout`） | 部分保存を避ける。編集時はセットを全入替 |
| 予定→実績 | 画面上のトグルで `status` を変更して保存 | 全セット完了チェックでの自動切替はしない（手動のみ） |
| 身体計測保存 | `(user_id, date)` で upsert | |
| グラフ取得 | 期間 (1W/1M/3M/全期間) と種目、指標を指定して集計を取得 | 全期間は日別集計済みデータのため件数は小さい想定 |
| 種目管理 | 追加・名称/部位編集・論理削除（`archived_at` 設定）。デフォルト種目は閲覧のみ | |
| プロフィール | ニックネーム・身長の更新 | 身長は体重グラフには影響しない（BMIは今回のスコープ外） |

---

## 6. 非機能要件への対応

| 要件 | 対応方針 |
| --- | --- |
| モバイル最適化 | モバイルファースト設計。重量は `inputmode="decimal"`、回数は `inputmode="numeric"` でテンキー起動。ボタンは最小44px、主要操作は画面下部（親指圏）に配置。ナビゲーションは下部タブ |
| セキュリティ | RLS による行レベル分離、Cookie は HttpOnly/Secure、service_role キーはクライアント・サーバーとも使用しない。入力は zod で検証 |
| 速度 (1秒未満) | 必要インデックスの付与、1画面1〜2クエリ、保存は1往復（RPC）。ジム内の通信不安定に備え、保存中表示と失敗時の再試行を提供 |
| 可用性・バックアップ | Supabase の自動バックアップ（プラン依存）に準拠。独自の冗長化は行わない |
| ブラウザ対応 | iOS Safari / Android Chrome の直近2メジャーバージョン |

---

## 7. 初期データ（デフォルト種目）

| 部位 | 種目例 |
| --- | --- |
| 胸 (chest) | ベンチプレス、ダンベルプレス、インクラインベンチプレス、ダンベルフライ |
| 背中 (back) | デッドリフト、懸垂、ラットプルダウン、ベントオーバーロウ |
| 脚 (legs) | スクワット、レッグプレス、レッグカール、カーフレイズ |
| 肩 (shoulders) | ショルダープレス、サイドレイズ |
| 腕 (arms) | アームカール、トライセプスエクステンション |
| 腹 (abs) | クランチ、レッグレイズ |

マイグレーションの seed で `user_id = NULL` として投入する。

---

## 8. 前提・スコープ外・未決事項

* **スコープ外:** ソーシャル機能・データ共有、エクスポート、通知/リマインダー、オフライン編集（PWA化）、BMI算出、複数言語対応（日本語のみ）、アカウント削除UI。
* **日付とタイムゾーン:** `date` 型はユーザーのローカル日付をそのまま保存する（タイムゾーン変換は行わない）。
* **決定事項:**
  * 重量入力は0.5kg刻み（入力欄は `step="0.5"`、±ボタンも0.5kg単位。DBは `numeric(5,1)`、CHECK で0.5の倍数を強制）。
  * 体重・体脂肪率グラフは欠損日を線形補間して連続した折れ線で描画する（補間は表示のみで、DBには保存しない。実測点はマーカー表示し、補間区間と区別できるようにする）。
  * 予定ログの日付移動（リスケ）機能は提供しない。日付を変えたい場合は、ワークアウト編集画面で日付を直接編集する。
  * 前回メニューのコピー機能を提供する（下記）。
* **前回メニューのコピー:**
  * 入口はワークアウト新規作成画面の「過去の記録からコピー」。コピー元は日付順の直近の `done` ログ一覧から選ぶ。
  * コピー内容は種目・セット構成（重量・回数・順序）。メモは複製しない。コピー先は新規ログ（`status='planned'`、日付は画面で指定した日付）とし、`is_done` はすべて false で作る。
  * アーカイブ済みの種目はコピー対象から除外し、除外した旨を画面に表示する。
  * 保存前に編集可能。保存は通常の `save_workout` を使い、専用のAPIは設けない。
* **未決事項:** なし
```