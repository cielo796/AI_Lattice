# DB構成と運用

## Supabaseの配置

2026年9月30日に、Supabaseプロジェクト `kvtijxfjsollfskxcjfq`（表示名 `Kaigo`、東京リージョン）の復元完了を確認し、AI Latticeの構成を追加しました。

| 対象 | 用途 |
| --- | --- |
| `public` | 既存の介護アプリ用26テーブル。変更していません。 |
| `ai_lattice` | AI Lattice専用の28業務テーブルとPrisma migration履歴（全29テーブル）。 |
| `auth` / `storage` など | Supabaseが管理する内部スキーマ。 |

既存の `public.audit_logs` とAI Latticeの監査テーブルは構成が違うため、スキーマを分離しています。AI Latticeは独自のユーザー・セッション・ロールを管理し、Supabase Authのユーザーとは別です。

## 接続と権限

- アプリ接続は `ai_lattice_app` ロール、Session pooler `aws-1-ap-northeast-1.pooler.supabase.com:5432` を使用します。
- ロールは `ai_lattice` の所有者です。アプリの読み書きと同スキーマのmigrationを実行できます。superuser・DB作成・ロール作成・`BYPASSRLS` は付与していません。
- 既存の `public` テーブルへの読み書き権限と `auth` スキーマの利用権限がないことを確認しました。
- 全29テーブルでRLSを有効にしています。テーブル所有者のアプリロールはPostgreSQLの仕様によりRLSの対象外です。テナント・ユーザー・アプリ単位のアクセス制御はサーバーのRBACで行います。
- Supabaseの `anon` / `authenticated` には専用スキーマの利用権限を付与していません。Data APIの公開スキーマにも追加していません。

接続文字列はGit管理対象外の `app/.env.local` に保存します。パスワードをREADMEやCIへ直接記載しないでください。接続例の `PASSWORD` は実際の値へ置き換え、特殊文字はURLエンコードします。

```dotenv
DATABASE_URL="postgresql://ai_lattice_app.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres?schema=ai_lattice&sslmode=verify-full&sslrootcert=PATH_TO_CA"
DIRECT_URL="postgresql://ai_lattice_app.PROJECT_REF:PASSWORD@POOLER_HOST:5432/postgres?schema=ai_lattice&sslmode=verify-full&sslrootcert=PATH_TO_CA"
```

アプリは `DATABASE_URL`、Prisma CLIは `DIRECT_URL`（空なら `DATABASE_URL`）を使用します。両方で同じDB・スキーマを指定してください。Session poolerはIPv4に対応し、migrationのセッション機能を利用できます。serverless用Transaction poolerへ変更する場合も、migration用の `DIRECT_URL` はSession poolerのままにします。[SupabaseのPrisma接続ガイド](https://supabase.com/docs/guides/database/prisma)

証明書とホスト名を検証する `sslmode=verify-full` を使用します。公式のDatabase Settingsから取得したCA証明書は、この作業環境の `.cache/supabase-ca/prod-ca-2021.crt` に保存しています。別環境へ配置する場合はCA証明書も配置し、`sslrootcert` のパスを更新してください。証明書エラー時に検証を無効化する必要はありません。[SupabaseのSSL設定](https://supabase.com/docs/guides/platform/ssl-enforcement)

`SECRET_ENCRYPTION_KEY` もローカル設定に保存しています。保存済みOpenAIキーの復号に使用するため、再起動や配置先変更で値を変えないでください。

## テーブルの構成

| 分類 | テーブル |
| --- | --- |
| 組織・認証 | `tenants`, `users`, `sessions`, `roles`, `user_roles` |
| アプリ定義 | `apps`, `app_versions`, `app_tables`, `app_fields`, `app_views`, `app_forms` |
| レコード | `app_records`, `record_comments`, `attachments` |
| ワークフロー・承認 | `workflows`, `workflow_runs`, `app_approval_settings`, `app_approval_approvers`, `approvals`, `approval_assignees` |
| AI | `tenant_openai_settings`, `prompt_templates`, `prompt_template_versions`, `ai_execution_logs` |
| 通知・監査 | `notifications`, `user_notification_preferences`, `audit_logs` |
| migration履歴 | `_prisma_migrations` |

## migrationと診断

通常は `app/` で以下を実行します。

```powershell
npm run db:migrate:deploy
npm run db:health -- --schema-only
npm run db:health
```

初期設定前の空DBでは、`DEMO_AUTO_SEED=false` にして初期導入画面を使用できます。現在の作業環境ではサンプル検証のため `DEMO_AUTO_SEED=true` を明示しています。通常のDB診断はデモ有効時だけデモ組織・ユーザーも確認します。

DBパスワードを取得できない場合でも、新規スキーマへの初回導入はログイン済みSupabase SQL Editorから実行できます。

```powershell
npm run db:supabase:export -- ../.cache/supabase-bootstrap.sql ai_lattice_app
```

このコマンドは既存migrationから、専用スキーマ・RLS・正しいchecksum付きのPrisma履歴を含むSQLを生成します。指定ロールは事前に作成済みで、SQL Editorの実行ロールがそのロールへ切り替えられる必要があります。省略時は実行ロールが所有者になります。

生成SQLは **新規の `ai_lattice` スキーマ専用** です。既存スキーマではCREATEが失敗し、トランザクション全体が戻ります。既存DBへ再適用したり、migrationを飛ばすために履歴だけ追加したりしないでください。以後の更新は `db:migrate:deploy` を使用します。

## 今回の確認

- 専用スキーマの29テーブル、18件のmigration履歴、全テーブルのRLSを確認しました。9月30日の永続実行追加はlease列・索引、スケジュール追加は `workflow_schedule_states`・レコード走査索引・revisionです。既存のmigrationは編集せず、additive migrationを適用しました。
- 追加前後で既存 `public` の26テーブルの名前・所有者・列・RLSのメタデータが一致することを確認しました。アプリ用29テーブルの所有者はすべて `ai_lattice_app`、`anon` / `authenticated` は引き続き専用スキーマにアクセスできません。
- migrationのchecksumをリポジトリのSQLと照合し、全件一致しました。
- migration SQLの改行は `.gitattributes` で固定します。新規SQLはLF、既存9本はSupabaseに適用したバイト列と同じCRLFを指定し、Windows/Linuxのcheckoutによるchecksum差を防ぎます。SQL本文やDBの適用済みchecksumは書き換えていません。
- `prisma migrate status` は適用済み、`prisma migrate diff` は差分なしでした。
- Session poolerへのクライアント接続でTLSとCA・ホスト名検証を確認しました。
- 接続の時刻設定はUTCです。実行期限はタイムゾーン付き列で保存し、DBの時計を用いて延長します。[ワークフローの永続実行と復旧](workflow-operations.md) にworkerの起動・復旧判断・配置時のdrain手順を記載しています。
- Supabaseを接続先にした管理・レコード操作・二段階承認のブラウザーE2Eは3件成功しました。検証用アプリはテスト終了時に削除され、デモデータは残しています。
- `npm run quality` は241件成功（実DB専用11件skip）、専用スキーマを使うローカル実DB統合テストは10件成功しました。診断API `/api/health/db` はHTTP 200・正常を返しました。
- GitHub ActionsのE2EはSupabaseではなく、ジョブ内の一時PostgreSQLを使います。前回の失敗はデモ作成前のDB診断によるもので、Supabaseの停止とは別です。CIの診断順序を修正しています。
