# デザイン刷新

## 既存構成と方針

- 作成ページは `apps/new/ai/page.tsx`。説明・生成・編集・下書き保存を同じURLで切り替える。
- `FieldBuilder` と `blueprint-layout` が行・幅・Pointer Events・キーボード操作を管理する。
- 生成APIが既定モデル／有効なPrompt Templateを解決する。モデル選択や生成仕様は変更しない。
- `blueprint-views` をUIとサーバーが共用し、保存時に1テーブル・1〜10項目・サンプル3件を作る。
- 現状はグローバルCSSのクリーム／コーラルと作成画面の独自変数が重複。ホーム・アバター・Workflowにも多色の直書きがある。
- 共通Sidebar／TopBarを維持しつつ、グローバルトークン→アカウント・テナント表示設定→ホーム→回帰検証の順で更新する。

## 置換対応表（変更前の棚卸し）

| 既存用途／場所 | 変更後 |
| --- | --- |
| 主操作のcoral、primary、lavender／tertiary | `brand-strong` / `on-brand` |
| coral／purple選択面・AIチップ | `brand-tint` / `brand-ink` |
| クリームの画面、白カード、薄い凹面 | `surface-page` / `surface-card` / `surface-sunken` |
| グレー本文・補助文・薄いラベル | `ink` / `ink-muted` / `ink-subtle` |
| 通常罫線／入力枠／フォーカス | `border` / `border-control` / `focus` |
| 多色ホームアイコン・アバター・Workflowノード | 単色 `surface-sunken` / `ink-muted` |
| 公開・成功／警告・未作成／削除・失敗 | `success` / `warning` / `danger` と対応するtint。必ず状態語を併記 |
| 下書き | グレーのニュートラル表示 |
| Sidebarの面・文字・選択・作成 | 専用 `side-*` / `on-side-action` |
| rgba直書きの影・オーバーレイ | `shadow-card` / `shadow-pop` / `scrim` |
| ロゴ | `logo` のみコーラルを維持 |

添付 `reference/tokens.css` の3テーマを唯一の色定義として使用する。作成画面のローカル色定義を廃止し、全画面が同じテーマを継承する。

## 表示設定

DBのユーザー設定（navy / white / dark / system / 未設定）とテナント設定（navy / white、ユーザー変更許可）を保存する。ユーザー変更禁止→テナント既定、未設定→テナント既定→navy。OS設定は暗い場合のみdark、明るい場合はテナント既定。サーバーはDBの設定から初期HTMLを描画し、OS選択時だけ描画前スクリプトで端末の配色を反映する。localStorageは設定の保存先にしない。

## 未確定6点の確認結果

| 確認点 | 実装の前提 |
| --- | --- |
| 技術 | Next.js 16.2.3 / React 19.2.4 / Tailwind CSS 4。既存のクライアント状態とPointer Eventsを維持 |
| フォーム幅 | 保存値は文字列 `full` / `half`。行と空き枠は `rowIndex` で表し、ランタイムにも反映 |
| 自動ビュー | 一覧は常に。状態コードまたは選択式・真偽値でカンバン／チャート、日付・日時でカレンダー、数値で集計。UIと保存で `buildInitialViewsForTable` を共用 |
| モデル解決 | 有効なPrompt Templateのモデル指定→テナントの既定。GETとPOSTでサーバー共通解決。変更しない |
| 生成API | 一括JSON。進捗は経過時間の目安。AbortControllerで中断。変更しない |
| 表示設定 | 以前はグローバルなアカウント・テナント配色設定なし。今回User／Tenantの専用列を追加。Sidebarの折り畳みlocalStorageは既存のまま、テーマの保存には使用しない |

## 受け入れ条件

| # | 判定 | 確認方法 |
| --- | --- | --- |
| 1 | 維持・確認済み | 入力例は挿入のみ。生成API呼び出し回数をE2E検証 |
| 2 | 維持・確認済み | サーバー解決モデル表示のE2Eとモデルゲートウェイ単体テスト |
| 3 | 維持・確認済み | 純粋な配置関数の単体テスト、Pointer Events／EnterのE2E |
| 4 | 維持・確認済み | 左右配置／3列禁止の配置関数テストとドラッグE2E |
| 5 | 維持・確認済み | 空き枠保持・再配置・1列化の単体テストとE2E |
| 6 | 維持・確認済み | プロパティ／カード操作の幅変更E2E |
| 7 | 維持・確認済み | Alt＋矢印、読み上げ、Esc中断のE2E |
| 8 | 維持・確認済み | 10個制限・理由表示・最後の1項目削除禁止のE2E |
| 9 | 維持・確認済み | ChromiumのタッチPointer Events E2E。物理iPadは未検証 |
| 10 | 維持・確認済み | 保存後のビューを共通判定関数の結果とE2E比較 |
| 11 | 維持・確認済み | 実DBのフォーム幅・順序・選択肢・サンプル3件をE2E比較 |
| 12 | 維持・確認済み | 旧／不正layoutの全幅フォールバックを単体・E2E検証 |
| 13 | 確認済み | 3テーマの本文・補助文・状態・Sidebar文字4.5:1、入力枠・選択バー3:1をトークン単体検証。実DOMの作成画面もE2E検証 |
| 14 | 確認済み | `tokens.css` 以外の色リテラルを禁止する全ソース走査テスト。ホーム→作成画面の切替E2E |
| 15 | 確認済み | アカウント永続化・別ブラウザ端末・JS無効の初期HTML・OS追従・テナント固定・不許可の403・解除後の個人設定復元を実DB E2E |
| 16 | 確認済み | 表を既定、カード切替、削除のpopover、単色アイコン、状態語、未作成、Cmd/Ctrl＋K検索、空アプリ作成とスマホナビゲーションをE2E |

## 適用と検証環境

- 作業ブランチ: `codex/app-design-refresh`。ベースは前回のアプリ作成実装 `7cfbabb5`。元のチェックアウトの未コミット変更は保持。
- マイグレーション: `20261006000000_display_themes`。Userの個人設定とTenantの既定・変更可否のみ追加。テナント既定のdarkはDB制約でも禁止。
- 既存環境へ適用する場合は、その環境の接続設定を使い `npm run db:migrate:deploy` と `npm run db:generate` を実行する。今回Supabase／本番DBには未適用。
- 検証先は `127.0.0.1:55433/lattice_test_design_20261006` の使い捨てローカルDB。実データ・既存の介護DB・APIキーを使用していない。
- 作成E2EのAI応答は固定fixture。今回の変更で実AIのモデルや生成ロジックは変更していない。
- 手動プレビュー: `http://127.0.0.1:3100/home`。デモログイン `marcus.chen@acme.com` / `demo`。
- 型検査・lint・単体テスト、Chromium E2E、独立したコピーでのWebpack production buildを実行。Material Symbolsの外部CSSに対する既存のNext lint警告は残る。

## 作業場所

- 専用Git worktree: `C:/Users/gouba/.codex/worktrees/app-design-refresh/AI_Lattice`。
- `D:/code/AI_Lattice` は元の `codex/collapsible-ribbon-sidebar` のまま。既存のDB／webhook関連の未コミット変更は取り込まず、変更していない。
- Codexアプリへのworktree登録はエラーになったが、Gitのworktreeと `codex/app-design-refresh` ブランチは正常。今回の変更を見る・コミットする場合は専用worktreeで操作する。
- コミット・push・PR作成はこの依頼では実施していない。

## 最終検証結果（2026-10-06）

| 検証 | 結果 |
| --- | --- |
| `npm run quality` | 成功。447テスト通過、32テストは既存の条件付きskip。lintは0エラー・既存警告1件、型検査・文字化け検査も通過 |
| デザイン追加単体テスト | 27件通過。3テーマのコントラスト、色リテラル禁止、設定優先順位、テナント分離、管理権限と変更禁止を検証 |
| 作成画面＋表示設定E2E | 7件を連続実行し全件通過。SSR入力保護とスマホの表スクロールに追加したアサーションも対象テストを再実行して成功 |
| 追加ライフサイクルE2E | 6件は再実行を含め最終的に通過。公開・フォーム・5ビュー・型付きレコード、名前変更、テナント分離、競合公開、モバイルCRUD、ワークフロー編集／保存／有効化 |
| production build | 最終ソースを別ディレクトリへコピーし `next build --webpack` 成功。通常のTurbopack buildは今回の検証対象外 |
| 最終の型検査・変更ファイルlint・`git diff --check` | 成功 |
| Codex内ブラウザ | ホームのnavy／white／dark、表示設定の即時保存と既定復帰、ダークの作成入力、390pxのナビと表の横スクロールを目視確認 |

再読込直後、Reactの準備前に入力すると値が消える問題を確認したため、作成フォーム・表示設定はクライアントの準備ができるまで無効化した。JavaScript無効のSSRと通常ブラウザ双方で検証した。

390px表示では表内のスクリーンリーダー用ラベルがページ全体の横幅を広げていた。表コンテナを配置基準にして修正し、ページ全体は横にはみ出さず、表の中だけを横スクロールすることをE2Eで確認した。

追加のライフサイクル検証では初回にビュー／ワークフロー入力の表示待ちがタイムアウトし、ビューの絞り込み待ちでも一度失敗した。対象を単独で再実行すると両方成功したが、継続した一括実行での安定性は別途確認が必要。絞り込みやワークフロー実行の業務ロジックには変更を加えていない。

目視確認の画像は専用worktreeの `.cache/design-home-navy.jpg`、`.cache/design-home-white.jpg`、`.cache/design-home-dark.jpg`、`.cache/design-settings-navy.jpg`、`.cache/design-creation-dark.jpg`、`.cache/design-home-mobile-dark.jpg` に保存。これらはローカル検証用でGit対象外。ブラウザの一時的なviewport指定は解除し、デモは個人設定未指定・テナント既定navy・変更許可ありへ戻した。
