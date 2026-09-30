# AI Lattice 完成に向けた実装・検証計画

更新: 2026-09-30

## 目標

AIで業務アプリを作り、実データで運用し、人が承認・管理できるシステムとして完成度を高める。既存の仕様・実装は変更可能だが、実装済みの業務機能と保存済みデータは検証しながら引き継ぐ。部分的なテスト成功をシステム全体の完成とは扱わない。

## 実施順序と完了の証拠

1. **導入・認証・ユーザー運用（進行中）**: デモデータなしで初期管理者を作成できる。テナントと利用者の停止、セッション期限、認証情報の変更、権限不足を適切に処理する。初期設定の重複・同時実行、別テナントアクセス、失効済みセッションをAPIと実DBで検証する。
2. **アプリ設計と日常業務（未完了）**: 作成・編集・公開、フォームとビュー、検索・絞り込み・集計、レコード・添付・コメント、モバイル操作を一連の実操作で確認する。モック依存や機能しない操作を実機能へ置換する。
3. **ワークフロー・承認（進行中）**: `workflow-requirements.md` のA1〜A6・R1〜R9と受け入れ条件を実装・検証する。グラフの分岐、承認による停止と再開、同時判断、重複防止、失敗の追跡までを含む。
4. **AIと外部連携（未完了）**: Model Gateway、提案の確認と適用、実行履歴、類似検索・分類、Prompt to Workflow、Webhook・API連携を評価する。実モデルや外部サービスの検証ができない箇所は明記し、完了としない。
5. **運用・完成監査（未完了）**: 初期導入、DB migration、production build、権限別E2E、バックアップ・復旧手順、監査・エラー表示、性能上の制限を確認する。利用者向け・運用者向け文書を実装と一致させる。

## 初回調査で確認した問題

- productionでも既定でデモユーザーが作成され、ログイン画面にデモ認証情報が固定表示される。
- デモを無効にした環境で最初のテナント・管理者を作成する導線がない。
- セッション読み取り時にCookieを削除しており、Server Componentから呼ぶと期限切れ時に失敗する。
- productionでPrismaClientを使い回さず、呼び出しごとに接続プールを作る。
- 同一メールアドレスが複数テナントに存在しうるDB設計に対し、ログインが最初の1件を選んでいる。
- 権限のDB delegateがない場合に許可するフォールバックがある。
- ワークフロー定義にはedgeがあるが、仕様書に記載されたグラフ実行・承認再開の不足は再検証が必要。
- ローカルには既存のサイドバー変更などの未コミット作業がある。これを引き継ぐ。

## 検証記録

- 導入・認証: デモなし初期導入、ユーザー追加、パスワード変更・全セッション失効、停止ユーザーの拒否、RBACのfail-closed、期限切れCookieのServer Component互換性を実装。`workspace-onboarding.spec.ts` は実PostgreSQL・ブラウザーで成功。
- 初期設定の同時実行: productionサーバーに同時送信し201/409を確認。Prisma PG adapterのcommit時競合を500ではなく409へ変換した。`setup-concurrency.spec.ts` 成功。
- ワークフロー: `workflow_runs` とapprovalのrun/node識別をadditive migrationで追加。グラフ定義snapshot、分岐、承認停止・再開、複数承認ノード、同時判断ロック、承認方式4種、実行履歴UI・再開APIを実装。
- `graph.integration.test.ts`: 新規の実PostgreSQL DBに15 migrationを適用後、10件成功。false分岐、イベント重複、二段階承認、定義snapshot、非承認者の拒否、同時判断、app policy/all/any/sequential/quorum、失敗ポリシー、保存済み判断からの再開を検証。
- `workflow-graph.spec.ts` / `governance-workflow.spec.ts` / `runtime-smoke.spec.ts`: ブラウザーで3件成功。二段階の承認ボタン操作、後続レコード更新、実行履歴、既存レコード・添付・コメント・管理画面操作を確認。
- `npm run quality`: 2026年9月30日の確認で47ファイル・241件成功、実DB専用2ファイル・11件skip。文字化けチェック、TypeScript、ESLintにエラーなし（既存の外部フォント警告1件）。`git diff --check` 成功。
- production build: Node 22・Cドライブ検証コピーでワークフロー追加後も成功（43 static pages生成）。その成果物を `next start` で起動し、`workflow-graph.spec.ts` が再度成功。Dドライブ直接buildには既知のEISDIR/readlink障害がある。
- ローカル実DB検証はloopback専用・テスト専用のembedded PostgreSQL 16を使用。アプリの依存関係には追加していない。9月30日には専用スキーマ指定で統合テスト10件も成功。
- 2026年9月30日: Supabaseの復元完了を確認し、既存の介護DBとは別の `ai_lattice` スキーマに28テーブル・15 migrationを配置。承認済みの専用DBロール・公式CA検証付きの接続を設定し、Supabase上のE2E3件と診断API HTTP 200を確認。構成と運用は [DB構成と運用](database-setup.md) に記録。
- GitHub PR #30の初回リモートCIは4件成功、E2Eのみ起動前のデモseed確認で失敗。スキーマ診断の順序を修正した `0bbf84f8` のCI run `36660891586` は5ジョブすべて成功。PR #30がマージ済みであることもGitHubから確認した。
- 9月30日: ワークフロー編集で7種のノードの追加・移動・複製・削除・接続、接続ラベル編集、全ノードのインスペクタ、名前・trigger・状態、空/アプリ承認テンプレート、未保存表示・切替確認を実装。権限不足は閲覧専用となる。
- config検証を強化し、有効化時に同一アプリのtable/field・有効ユーザー・アプリ承認設定・Prompt Template・API許可先を現在のDBと照合する。APIのJSONテンプレート・安全なヘッダー・timeout、AIのmodel/prompt・コメント/フィールド出力も実行側へ接続した。外部通信そのものはモック検証であり実サービス評価は残る。
- 編集後の `npm run quality` は50ファイル・273件成功（実DB専用2ファイル・11件skip）、TypeScript・ESLintエラーなし、既存フォント警告1件。実DB統合10件とサービス単体11件も成功。統合検証でイベント同時登録のP2002競合を確認し、既存の同一イベント実行を取得するよう修正した。
- Node 22・Cドライブコピーで編集追加後のproduction build成功（43 static pages）。その `next start` 成果物で `workflow-editor.spec.ts` / `workflow-graph.spec.ts` / `governance-workflow.spec.ts` / `runtime-smoke.spec.ts` が4件成功。ポートをドラッグした接続、座標移動、接続ラベル編集、保存再読込、保存した二分岐の実レコード実行まで確認した。開発時のReact Flow Strict Mode警告と並行build時の一時的なdev manifest読取エラーは本番実行では再現しなかった。

- 永続実行追加後の `npm run quality`: 52ファイル・295件成功、実DB専用2ファイル・22件skip。TypeScript・ESLintエラーなし、既存フォント警告1件。専用PostgreSQLスキーマに16 migrationを適用して統合21件成功。レコードとqueueのrollback、保存後dispatch障害、イベントsnapshot、同時更新、期限切れ回復の競合、行ロック中の回復回避、外部結果不明の隔離、管理者のretry/skip/fail・別テナント拒否、checkpoint失敗時のsnapshot整合性を確認。
- 永続実行追加後のブラウザーE2E: `workflow-recovery.spec.ts` / `workflow-graph.spec.ts` / `workflow-editor.spec.ts` / `governance-workflow.spec.ts` / `runtime-smoke.spec.ts` の5件成功。復旧理由・確認checkbox・画面からの処理済み判断・後続実行・監査ログ・重複判断409まで確認した。復旧用fixtureは明示許可したloopbackテストDBに限定し、CIでも実行する。
- 実DB検証でDB既定のAsia/TokyoとPrisma日時の差により実行期限が誤判定される問題を検出。接続のUTC統一、期限列のtimestamptz化、DB時計による期限延長で修正し、統合テストを再実行した。Supabaseの専用スキーマにも16番目のmigrationを適用し、28テーブル・全28テーブルRLS、checksum一致、UTC、TLS検証済み接続を再確認。既存の介護DBは変更していない。
- migrationの改行も監査。既存9本の適用済みchecksumはCRLF、他のSQLはLFだったため、`.gitattributes` にその改行を固定した。SQL本文やDB履歴を変更せず、Gitの改行設定が異なる場合もcheckout filterの出力が現在の適用済みSQLと一致することを確認した。
- 最新ソースのproduction buildはNode 22・Cドライブ検証コピー・webpackで成功（44 static pages）。Turbopackは検証コピーのnode_modules junctionをルート外として拒否したため、この環境ではwebpackを使用した。本番成果物の起動は実行ツールのポリシーで拒否され、今回の5件E2Eは通常の開発サーバー起動経路で検証した。本番成果物での追加E2E、React Flowの開発時の警告とレイアウト挙動の再監査は残る。

## 次に必要な実装・監査

- R1/R2: 基本的な編集UI・config/参照先検証・保存再読込E2Eは実装・検証済み。全画面遷移の未保存保護、全権限・モバイル操作、運用中の参照先変更、Prompt to Workflowを含む最終受け入れ監査は残る。操作と制約は [編集ガイド](workflow-editor.md) に記録。
- R3/R4/R7: recordイベントの永続outbox、token付き実行権、期限切れDBノードの回復、外部結果不明の隔離、管理者の復旧判断を実装。Webhook受信、スケジュールの公平性と重複イベント制御、実プロセス停止の長時間fault injection、配置先のworker定期実行・監視は残る。外部API/AIの厳密なexactly-onceは保証しない。[運用手順](workflow-operations.md) を参照。
- A1〜A6/R5: 関連レコード更新・加減算等の承認後アクション、申請条件・View同期・公開snapshotの全受け入れ条件を再監査する。手動アプリ申請の同時作成対策と代理承認ポリシーにも不足がある。
- R6/R8: 通知先roleのapp/table scope、全権限組み合わせ、別テナントのAPI E2E、ランタイムで操作できない承認ボタンの表示制御を監査する。
- AI: Prompt to Workflowは未接続を明示して無効化しただけで、生成preview/applyは未実装。Model Gateway・実モデル評価・外部連携は別途完成させる。
- 導入・運用: ログイン試行制限、パスワード復旧・招待、バックアップ復旧実験、性能制限、全ユーザー導線の確認が残る。

## 完成判定

上記各領域をソース、実DB、API、ブラウザー、テスト出力で照合する。未実装、未検証、外部接続待ちを残したまま全体完了とはしない。詳細な次作業と検証結果を本ファイルに継続記録する。
