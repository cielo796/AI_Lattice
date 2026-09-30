# AI Lattice

自然言語から業務アプリを設計し、レコード・承認・通知・権限・監査を管理する Next.js / React / PostgreSQL アプリケーションです。機能の使い方は [システムマニュアル](../docs/system-manual.md)、未完了領域と検証状況は [完成計画](../docs/completion-plan.md) を参照してください。

## 前提

- Node.js 22、npm、PostgreSQL 16以降
- ローカルDBをDockerで起動する場合はDocker Engine / Docker Desktop
- AI機能を利用する場合は管理画面から設定するOpenAI APIキー

以下のコマンドは `app/` で実行します。

## 初期導入

```powershell
npm ci
Copy-Item .env.example .env
npm run db:start
npm run db:generate
npm run db:migrate:deploy
```

Dockerを使わない場合は、用意したPostgreSQLへの `DATABASE_URL` を `.env` に設定して `db:start` を省略してください。既存データを消すmigration resetは必要ありません。

### Supabase

Supabaseの構成・接続設定・確認結果は [DB構成と運用](../docs/database-setup.md) を参照してください。既存の別アプリと共有する場合は、`DATABASE_URL` の `schema=ai_lattice` で専用スキーマを使用できます。アプリのPrismaクエリ、承認ロック用SQL、DB診断は同じスキーマを参照します。

`DIRECT_URL` を設定すると、Prismaのmigrationはそちらを使用します。アプリの `DATABASE_URL` と同じDB・スキーマを指定し、migrationにはSession pooler（5432）かdirect connectionを使用してください。テスト用DBへ切り替える場合は `DIRECT_URL` も切り替えてください。未設定なら `DATABASE_URL` を使用します。

`.env` で `DEMO_AUTO_SEED=false` とし、`SETUP_TOKEN` と `SECRET_ENCRYPTION_KEY` にそれぞれ別のランダム値を設定します。値の生成例（2回実行）:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`SECRET_ENCRYPTION_KEY` は保存済みAPIキーの復号に使うため、再起動時に変更せず、DBとは別に安全に保管してください。既存の環境で暗号化キーが未設定だった場合は `DATABASE_URL` 由来のキーが使われています。新しいキーへ切り替える際は、保存済みAPIキーの再登録も必要です。

```powershell
npm run dev
```

1. `http://localhost:3000/setup` を開きます。
2. `SETUP_TOKEN`、組織名・コード、最初の管理者名・メール・パスワードを入力します。
3. 登録後、ログイン画面からサインインします。
4. 初期設定が成功したら、環境変数の `SETUP_TOKEN` を削除してサーバーを再起動します。

初期設定はDBに組織がまだ存在しない場合だけ有効です。組織・管理者・管理者ロール・監査ログは同一トランザクションで作られます。同時実行・再実行では既存組織を上書きしません。

## ユーザーとログイン

- 管理 → ユーザー管理から、名前・メール・初期パスワード・ロールを指定して利用者を追加できます。`admin:users` と `admin:roles` の両方が必要です。
- 初期ロールは組織全体に適用されます。アプリ単位の権限はロール管理・アプリ権限設定で調整してください。
- パスワードは12〜256文字です。利用者へ初期パスワードを安全に渡し、プロフィール画面で変更してもらってください。
- 同じメールアドレスが複数組織にある場合は、ログイン画面の「組織コードを指定する」で対象組織を入力します。
- パスワード変更時は全セッションを失効させます。現在の端末でも再ログインが必要です。
- 無効なユーザー・組織はログインできません。期限切れ・削除済みセッションはログイン画面に戻ります。
- メールによる招待・パスワード再発行・SSOは未実装です。

## デモ

開発用の使い捨てDBで `DEMO_AUTO_SEED=true` を明示するとデモデータを作成できます。アカウントはログイン画面に表示されます。本番では通常 `false` を指定してください。未指定の場合も `NODE_ENV=production` では自動作成しません。

デモデータの再読み込みは、既存ユーザーの状態・パスワードやロール設定を上書きしません。以前のデモ設定で作成したアカウントは、環境変数を無効化してもDBから削除されません。本番データへ移行する際はデモアカウントの無効化も確認してください。

## ビルドと検証

```powershell
npm run quality
npm run build
npm run start
npm run db:health
npm run e2e
```

`quality` は文字化け・ESLint・Vitest・TypeScriptを確認します。E2Eはテストデータを書き込むため、専用のDBで実行してください。通常のE2Eでは `DEMO_AUTO_SEED=true` を使用します。WindowsのE2EランナーはNode 22を使用し、ソースと依存関係をユーザーの一時ディレクトリにコピーして起動します。

デモ自動作成前は `npm run db:health -- --schema-only` で接続・全28テーブル・migrationだけを確認できます。通常の `db:health` はデモ有効時にデモ組織・ユーザーの存在も確認します。CIでは起動前にスキーマを確認し、E2E後にデモデータを含む診断を実行します。

初期導入のE2Eは、migration適用済みで組織がない専用DBを指定して別途実行します。

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/EMPTY_TEST_DB?schema=public'
$env:DEMO_AUTO_SEED = 'false'
$env:SETUP_TOKEN = 'local-test-token-with-at-least-32-characters'
$env:PLAYWRIGHT_SETUP_TEST = 'true'
npm run e2e -- workspace-onboarding.spec.ts
```

テストは初期設定、誤ったトークン、再登録拒否、ブラウザーログイン、利用者追加、閲覧者の管理操作拒否、パスワード変更・旧セッション失効、ユーザー無効化、不正セッションでの画面表示を検証します。終了後はこのシェルのテスト用環境変数を解除してください。

初期設定の競合テストは **別の空DB** に切り替え、同じ環境変数で `npm run e2e -- setup-concurrency.spec.ts` を実行します。初期導入テスト後のDBでは再実行できません。

ワークフローの実DB統合テストにも、migration適用済み・組織がない専用DBを用意します。

```powershell
$env:TEST_WORKFLOW_DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/EMPTY_WORKFLOW_TEST_DB?schema=public'
npx vitest run src/server/workflows/graph.integration.test.ts
Remove-Item Env:TEST_WORKFLOW_DATABASE_URL
```

このテストはDBを初期化・削除せず、検証データを残します。再実行には新しい専用DBを指定してください。通常の `npm test` では実DBテストはスキップします。ブラウザーでの二段階承認と実行履歴は `npm run e2e -- workflow-graph.spec.ts` で検証します。

## ワークフロー実行

- `20260928000000_workflow_runs` のmigrationが必要です。既存の承認データは保持します。
- 開始ノードから接続を辿り、条件の `yes` / `no`、承認の `approved` / `rejected` / `returned` で分岐します。承認ノードのラベルなし接続は全判断の共通後続です。
- 分岐先は接続ID順で決定的に逐次処理します。合流したノードは1実行につき1回処理します。循環・重複ID・不明な接続先は拒否します。並列実行や全経路の合流待ちは提供していません。
- 実行時の定義を保存し、承認待ちで停止します。定義を後から編集しても進行中の実行は元のグラフで再開します。承認依頼は実行ID・ノードID単位で識別され、二段階以上の承認にも対応します。
- 承認ノードは有効なアプリ承認設定を優先します。`config.policy="app"` は設定を必須とし、`"override"` はノード設定を明示的に使用します。設定のない旧定義は従来の承認者・ステータスで実行できます。
- `any` / `all` / `sequential` / `quorum` の判断をDBロックで直列化します。指定されていないユーザーは他人の承認を代行できません。quorumは申請時点の必要人数を保持します。
- エディタ左側の「実行履歴」に最新100件の実行、通過・未通過・失敗ノードを表示します。「再開を確認」は保存済み判断からのみ再開し、未判断の承認を飛ばしません。
- ノードの失敗は既定で停止します。`failurePolicy="continue"` を指定した副作用ノードのみ、失敗を記録して後続へ進めます。
- API送信は、管理者が `WORKFLOW_API_ALLOWED_ORIGINS` に指定したオリジンだけを許可します。例: `https://api.example.com,https://hooks.example.com`。未設定なら送信不可、リダイレクトには追従しません。信頼できる接続先のみ登録してください。
- 外部APIには実行・ノードごとの `Idempotency-Key` を付けます。ただし受信側の対応が必要で、外部副作用の厳密な一度限りの保証はありません。プロセス停止で `running` に残った実行は自動再送せず、管理者が接続先と履歴を確認します。
- グラフ編集では全7種のノードを追加・移動・複製・削除・接続でき、ノード設定、接続ラベル、名前・トリガー・状態を編集できます。空/アプリ承認テンプレートから作成し、有効化前にconfig・参照先を検証します。[ワークフロー編集ガイド](../docs/workflow-editor.md)を参照してください。
- 編集と保存したグラフの実行は `npm run e2e -- workflow-editor.spec.ts` で検証します。Webhook受信、Prompt to Workflowなどには未完成部分があります。AIコマンド欄は誤操作を避けるため準備中として無効化しています。

## 定期ワークフロー

`CRON_SECRET` を設定し、外部スケジューラから次のエンドポイントへPOSTします。

```powershell
Invoke-RestMethod -Method Post -Uri "https://your-host/api/internal/workflows/schedules/run?limit=100" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

有効な `schedule` ワークフローを、削除されていないレコードに対して実行します。Triggerの `tableId` または `tableCode` で対象テーブルを絞り込めます。未指定時はアプリの全テーブルが対象です。`limit` の上限は500件です。内部スケジューラはまだ搭載していません。

## 本番運用

HTTPSのリバースプロキシを使用し、DB・環境変数・アップロードデータをバックアップしてください。公開範囲、ログイン試行制限、パスワード復旧、ワークフローの実行保証などには追加検証・実装が残っています。現時点の完成範囲は完成計画の検証記録を確認してください。
