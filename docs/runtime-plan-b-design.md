# 実行画面 案B 実装設計書

元資料：[Design/実行画面_改善案_実装メモ.md](../Design/実行画面_改善案_実装メモ.md) の「4. 案B：ナビを2段にして詳細パネルを付ける」。
この設計書は、元資料を現在のコード（`main` 053be2463 時点）に当てはめて、実装の判断を確定させたものです。元資料と食い違う場合はこちらを優先します。

## 0. 前提（main で済んでいること）

- デザイントークンは `app/src/app/tokens.css` に `--surface-page` などの名前（`--al-` 接頭辞なし）で定義済み。`globals.css` の `@theme inline` で Tailwind のクラス（`bg-primary`、`text-side-ink`、`bg-brand-tint` 相当など）に割り当て済み。紺（navy）・白（white）・ダーク（dark）の切り替えも動いている。
- `src/lib/design-tokens.test.ts` が「`tokens.css` 以外に色の直書き（`#xxxxxx`、`rgb()`、`bg-blue-500` など）がない」「`bg-sidebar` は `Sidebar.tsx` だけ」を検査している。**新しい部品でも色は必ずトークンのクラスで指定する。**
- サイドバーは1列で「業務／つくる／現在のアプリ／管理」にグループ化済み（`src/components/shared/Sidebar.tsx`）。
- 実行画面は `src/app/(shell)/run/[appCode]/[table]/page.tsx`。一覧は `src/components/runtime/RecordList.tsx` のカード表示、AI は画面下（2xl 以上で右）の `AISidebar` + `RecordAIPanel`。

## 1. 目標の画面構成

```
┌────┬──────────────┬──────────────────────────────┬───────────────┐
│Rail│ AppNav       │ TableHeader                  │               │
│80px│ 240px        ├──────────────────────────────┤ RecordDetail  │
│    │ AppSwitcher  │ RecordTable（一覧ビュー）     │ Panel 380px   │
│    │ アプリ        │ またはカンバン等の既存ビュー   │ （選択時のみ） │
│    │ ビュー        │                              │  └ AI         │
│    │ アプリの設計  │                              │               │
└────┴──────────────┴──────────────────────────────┴───────────────┘
```

- AppNav はアプリの画面（`/apps/:appId/*`、`/run/:appCode/*`）でだけ出す。それ以外の画面は Rail のみ。
- 詳細パネルはレコードを選んだときだけ出す。選んでいないときは一覧が全幅。

## 2. 全体メニュー（GlobalRail）

| 項目 | 遷移先 | 表示条件 |
|------|--------|----------|
| ロゴ | `/home` | 常時。ロゴだけ `--logo`（コーラル）を使ってよい |
| ホーム | `/home` | 常時 |
| アプリ | `/home#my-apps` | 常時。アプリの画面を開いているときは選択中にする |
| 承認 | `/admin/approvals` | 常時（承認の受信箱） |
| 通知 | `/notifications` | 常時。未読件数バッジ（既存の unread-count API） |
| 管理 | `/admin` | `admin:*` のいずれかの権限があるときだけ |
| アバター | メニューを開く | 常時。プロフィール／表示設定／ヘルプ（ガイド開始）／フィードバック／ログアウト（既存 TopBar のユーザーメニューと同じ内容） |

- 幅 80px（`w-20`）、面 `bg-sidebar`、文字 `text-side-ink`。項目は 56×56px 以上、アイコン＋12px のラベルを縦に並べる。
- 選択中：`bg-sidebar-active`＋`text-side-on-ink`＋左端 3px の `bg-side-bar`、`aria-current="page"`。
- `<nav aria-label="メインメニュー">`。アイコンの `Icon` は `aria-hidden`。
- 「アプリを作成」は Rail に置かず、AppSwitcher のポップオーバー下部とホーム画面に置く。

## 3. アプリ内メニュー（AppNav）

幅 240px、白の面（`bg-surface`）、右に `border-outline-variant`。上から次の順に並べる。

1. **AppSwitcher**：現在のアプリ名とアイコンのボタン（`aria-haspopup="dialog"`、`aria-expanded`）。押すと検索欄付きのポップオーバーでアプリ一覧を出す。
   - 検索欄にはラベル（`aria-label="アプリを検索"`）。↑↓で候補移動、Enter で切り替え、Esc で閉じてボタンへフォーカスを戻す。
   - 切り替え先は `/run/:appCode`（アプリトップ）。
   - 下部に「アプリを作成」リンク（`/apps/new/ai`、`data-guide="sidebar-create-app"`）。
2. **アプリ**：アプリトップ（`/run/:code`）／ダッシュボード（`/run/:code/dashboard`）／アプリ承認（`/run/:code/approvals`）。
3. **ビュー**（`/run/:code/:table` のときだけ）：そのテーブルのビュー（`RuntimeTableMeta.views`）を縦に並べる。リンクは `?viewId=<id>`（実行画面が既に読む既存パラメーター）。ビューが無い場合は「一覧」1件を出す。選択中は `bg-primary-container text-on-primary-container`、`aria-current="page"`。`<nav aria-label="ビュー">`。
4. **アプリの設計**：テーブル（`/apps/:id/tables`）／ワークフロー（`/apps/:id/workflows`）／権限設計（`/apps/:id/permissions`）／アプリ設定（`/apps/:id/settings`）。
   - `getCurrentPermissions({ appId })` で `app:write` が true のときだけ見出しごと出す。下に caption「編集権限のある人にだけ表示します」。
   - 権限の取得中・失敗時は出さない（安全側）。

- 開閉：既存の `ShellChrome` の `isSidebarCollapsed` を「AppNav を畳む」に読み替える。畳むと AppNav が消え、Rail だけになる。開閉ボタンは AppNav 上部（`aria-label="アプリメニューを閉じる／開く"`）。
- 本文の左余白は Rail＋AppNav の幅に合わせる。`ShellContent` と `TopBar` の両方が同じ値を使うよう、`ShellChrome` が「AppNav を表示中か」を公開し、オフセット（md 以上で 80px または 320px）を一か所で決める。

## 4. 管理画面（左タブ）

- 新設 `src/app/(shell)/admin/layout.tsx`（クライアント側でパスを見て判定）。管理系のパスのときだけ左に「管理メニュー」タブ（`<nav aria-label="管理メニュー">`）を出す。
  - タブ：ユーザー（`/admin/users`）／ロール（`/admin/roles`）／テナント設定（`/admin/tenant`）／AI設定（`/admin/openai`）／Prompt Template（`/admin/prompt-templates`）／AI実行ログ（`/admin/ai-logs`）／監査ログ（`/admin/audit-logs`）。それぞれ対応する `admin:*` 権限があるものだけ。
  - `/admin/approvals`（承認の受信箱）はワークスペース側の画面なので、タブを出さない。
- 新設 `src/app/(shell)/admin/page.tsx`：権限のある最初のタブへ `redirect`。どれも無ければ「管理する権限がありません」と表示。
- `/tenants` は現状のまま（Rail・タブからは外す）。

## 5. 実行画面（`/run/:appCode/:table`）

### 5.1 TableHeader（ページ内、固定しない）

- パンくず：アプリ名（`/run/:code` へのリンク）› ビュー名。
- 見出し：テーブル名を `h1`（26px / 700、1画面に1つ）。横にテーブルコードを等幅（`font-mono`、`text-on-surface-variant`）、件数のチップ「N件」。
- 右側：検索欄（`aria-label="レコードを検索"`）、更新ボタン（アイコンのみ、`aria-label="更新"`）、主要ボタン「レコードを追加」（紺の塗り、`data-guide="runtime-record-create-button"`、権限が無いときは無効＋理由の title）。**主要ボタンはこれ1つ。**
- 768px 未満：左端にメニューボタン（`aria-label="メニューを開く"`、`openMobileNav`）。この画面では `TopBar` を使わない。

### 5.2 RecordTable（一覧ビュー `viewType === "list"` のとき）

- `<table>` を `overflow-x-auto` の箱に入れ、`min-w-[720px]`。
- 列：
  - レコード：タイトル（太字、選択ボタン）と、その下にレコード番号（`getRecordDisplayNumber`、無ければ ID）を等幅・`text-on-surface-variant` で2段表示。
  - ビューの表示列（既存の `visibleColumnCodes` の決め方を流用）：数値フィールドは右寄せ・`tabular-nums`・`Intl.NumberFormat("ja-JP")`。
  - 状態：`StatusBadge`。
  - 更新：`formatRelativeTime`。
- 説明が空でも「説明はありません」を出さない。
- 選択行：`bg-primary-container`＋左端 3px の `--brand-strong`（`shadow-[inset_3px_0_0_var(--brand-strong)]`）、`aria-current="true"`。
- 表の下に「N件中 a–b件を表示」とページ送り（既存の `getRecordPage` を使う）。
- 一覧以外のビュー（カンバン／カレンダー／チャート／集計）は既存の表示を流用する。カード内でも「説明はありません」は出さない。
- 768px 未満では AppNav が見えないので、ページ内にビュー切り替えの `<select aria-label="ビュー">` を出す（`data-guide="runtime-view-tabs"`）。md 以上では出さない。

### 5.3 選択とURL・キーボード

- 選択中レコードは既存の `?recordId=<id>` で持つ（元資料の `record=` ではなく、通知などの既存リンクとの互換のため現行名を使う）。行を選ぶと `router.push`、閉じると `router.replace` で削除。
- キーボード（表にフォーカスがあるとき）：↑↓ で選択を移動（URL は `replace`）、Home/End で先頭・末尾、Enter で詳細パネルを開く（閉じていれば）、Esc で詳細パネルを閉じて行へフォーカスを戻す。
- 行移動の計算は純関数 `src/lib/runtime-keyboard.ts` に置き、単体テストする。

### 5.4 RecordDetailPanel

- 1200px 以上：一覧の右に幅 380px で並べる（`border-l`）。1200px 未満：右からのドロワー（背景を暗くする、Esc と背景クリックで閉じる、開いたらパネルの見出しへフォーカス）。
- 上部：レコード番号（等幅）と閉じるボタン（`aria-label="詳細を閉じる"`）。タイトル＋`StatusBadge`。
- 操作：「レコードを編集」（枠線ボタン）、「…」メニュー（`aria-label="その他の操作"`）の中に「削除」。削除を直接並べない。
- 項目：`<dl>` の2列グリッド。長文（テキストエリア・複数行・長さ 40 文字超）は2列をまたぐ。空の値は「未入力」を `text-on-surface-variant` で。
- その下に既存のコメント・添付・承認（`RecordActivitySections` など）。
- 最下部に AI セクション：`bg-primary-container` 系の面に `RecordAIPanel`（対象は選択中レコード）。AI が作った内容には「AI提案」ラベル。その下に既存の「類似レコード」。
- 作成・編集フォーム（`RecordCreatePanel`）は同じ枠（パネル／ドロワー）に表示する。
- `data-guide`：`runtime-record-detail`、`runtime-ai-panel`、`runtime-approval-panel`、`runtime-record-form` は対応する要素に残す。

### 5.5 撤去するもの

- 一覧の下・右の `AISidebar`（AI は詳細パネルの中へ移す）。
- 「一覧へ戻る」ボタン（一覧は消えないため不要）。
- ページ上部のビュータブ（AppNav へ移す。768px 未満は `<select>`）。

## 6. 状態バッジ

`src/lib/record-status.ts` に状態 → 種類の対応を置き、`src/components/shared/StatusBadge.tsx` で表示する。

| 種類 | 状態の値（`formatStatusLabel` 前の生値も含む） | 面 / 文字 |
|------|----------------|-----------|
| success | 完了、承認済み、approved、done、completed、closed、resolved | `bg-success-container text-success` 相当のトークン |
| warning | 要確認、承認待ち、pending、pending_approval、review、in_review、returned、差戻し | warning-tint / warning |
| danger | 却下、rejected、error、failed、canceled、cancelled | danger-tint / danger |
| neutral | それ以外（通常、active、open、draft など） | surface-sunken / ink-muted |

- 表示文言は `formatStatusLabel(status)`。色だけで区別しない（必ず文言を出す）。
- 高さ 22px、角丸 pill、12px / 600、`whitespace-nowrap`。

## 7. 実装の分担

| # | 担当 | 内容 | 主なファイル |
|---|------|------|--------------|
| O1 | OpenCode（deepseek-v4.1-flash-free） | 6章の状態対応と `StatusBadge`、5.3 のキーボード純関数、2〜4章のメニュー定義（項目・権限判定・選択中判定）の純関数。すべて単体テスト付き | 新規：`src/lib/record-status.ts`、`src/components/shared/StatusBadge.tsx`、`src/lib/runtime-keyboard.ts`、`src/lib/shell-navigation.ts` と各 `*.test.ts` |
| C1 | Codex（gpt-6.2-sol / high） | 2〜4章：GlobalRail、AppNav（AppSwitcher・ViewNav・AppDesignNav）、オフセット、モバイルドロワー、管理レイアウト | `Sidebar.tsx`（置き換え）、新規 `GlobalRail.tsx` `AppNav.tsx` `AppSwitcher.tsx`、`ShellChrome.tsx`、`ShellContent.tsx`、`TopBar.tsx`、`app/(shell)/admin/layout.tsx` `page.tsx`、`design-tokens.test.ts`（`bg-sidebar` 許可ファイルの更新）、`guide-registry.ts` |
| C2 | Codex（gpt-6.2-sol / high） | 5章：TableHeader、RecordTable、RecordDetailPanel、キーボード、ドロワー、撤去 | `run/[appCode]/[table]/page.tsx`、`runtime/RecordList.tsx`、新規 `runtime/TableHeader.tsx` `RecordTable.tsx` `RecordDetailPanel.tsx`、`RecordDetail.tsx`、`ai/RecordAIPanel.tsx`、`guide-registry.ts`、`e2e/runtime-smoke.spec.ts` |
| R | Claude | 設計（本書）、各段階のレビュー、lint・型・単体テスト、ブラウザーでの幅別確認（1440／1100／700px）、権限別確認、統合 | — |

- 順序：O1 → レビュー・コミット → C1 と C2 を別の作業ツリーで並行 → それぞれレビュー → 統合 → 総合確認。
- C1 と C2 の接点は URL（`?viewId=`、`?recordId=`）と `useShellChrome().openMobileNav` だけ。互いのファイルは触らない。`guide-registry.ts` は両方が触るため、統合時に Claude がまとめる。

## 8. 全担当に共通の約束

- `app/.env*` を読まない・表示しない。DB に接続するコマンド（`prisma migrate`、`db:*`、`npm run e2e`、`next dev`）を実行しない。共有の本番 DB のため。
- `git commit`・`git push` をしない（コミットは Claude がレビュー後に行う）。
- 終了前に `app/` で `npm run lint`、`npx tsc --noEmit --pretty false`、`npm test` を通す。触った箇所の既存テストが壊れたら、テストの意図を保ったまま更新する。
- 色はトークンのクラスだけ。新しい色が必要なら実装せずに報告する。
- Next.js は 16 系で、学習時点の知識と違う点がある。ルーティングや API で迷ったら `app/node_modules/next/dist/docs/` を読む。
- 既存の `data-guide` 属性は、要素を残す限り同じ値で残す。要素を消す場合は `src/lib/guide-registry.ts` と `guide-registry.test.ts` を合わせて直す。
