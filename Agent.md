# Agent.md - Stitch: AI-Driven Enterprise Low-Code Platform

## 1. プロジェクト概要

### プロダクト名: Stitch (コードネーム: The Intelligent Layer)

**コンセプト**: 「AIが業務アプリを作り、AIが業務を動かし、人が最終判断する」

Stitch は、自然言語から業務アプリを生成し、AIがレコード単位で業務を支援し、企業利用に耐える権限・監査・承認を備えたローコード・ノーコード業務AIプラットフォームである。

### ターゲットポジション

> kintoneのように業務アプリを早く作れて、Power Platformのように自動化できて、AgentforceのようにAIが行動し、Retoolのように企業統制が効くプロダクト

### 初期ターゲット業務

- 問い合わせ管理
- 申請承認
- 顧客対応履歴
- 点検報告
- 保守依頼管理
- 見積・請求

---

## 2. 設計原則

### 2.1 メタデータ駆動

アプリ定義はコードではなく **JSON ベースのメタデータ** で管理する。AIはコード生成ではなくメタデータ生成・更新を担当する。

メタデータ管理対象:
- `app` / `table` / `field` / `relation`
- `view` / `form`
- `workflow`
- `role` / `permission`
- `ai_action`
- `connector`
- `audit_policy`

### 2.2 Human in the Loop

AIの出力は即時反映しない。重要操作は以下の4段階を踏む:

1. **提案** - AIが下書きを生成
2. **確認** - ユーザーが内容をレビュー
3. **承認** - 権限者が承認
4. **実行** - システムが反映

### 2.3 デザインシステム: "The Cognitive Architecture"

- **No-Line Rule**: 1px solid border禁止。背景トーンの差で境界を表現
- **Tonal Layering**: surface階層で奥行きを表現（frosted glassの比喩）
- **Dual Typeface**: Manrope（見出し・ブランド）+ Inter（機能・データ）
- **AI Signal Color**: Emerald（`#10b981` / `tertiary`）はAI関連の操作シグナルに限定使用
- **Dark Theme Primary**: ダーク背景 `#0f172a`（slate-900系）、Emerald アクセント

### 2.4 テナント分離

全主要テーブルに `tenant_id` を付与し、マルチテナントを前提とする。

---

## 3. 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js / React |
| Builder UI | React Flow + カスタムフォームエディタ |
| API | NestJS または FastAPI |
| DB | PostgreSQL |
| ベクトル検索 | pgvector |
| 全文検索 | PostgreSQL全文検索（MVP）→ OpenSearch（将来） |
| 非同期処理 | BullMQ / Celery |
| ストレージ | S3互換 |
| 認証 | Auth0 / Keycloak / Azure AD |
| 権限 | Policy Engine（別管理） |
| AI | Model Gateway経由（直結禁止） |
| スタイリング | Tailwind CSS（カスタムトークン） |
| アイコン | Material Symbols Outlined |

### Model Gateway の必須性

LLM直結は禁止。Model Gateway を1枚挟み、以下を一元管理する:
- モデル切替
- コスト制御・計測
- 入出力ログ
- ガードレール
- プロンプトテンプレート管理

---

## 4. システム構成（6層アーキテクチャ）

```
┌─────────────────────────────────────────────────────────┐
│ ① Builder層: アプリ設計画面                              │
│   アプリ作成 / テーブル設計 / フォーム設計 / ビュー設計    │
│   ワークフロー設計 / AIアクション設計 / 権限設定           │
│   → 「AIで作成」ボタン: 自然言語 → 下書き → 承認         │
├─────────────────────────────────────────────────────────┤
│ ② Runtime UI層: 現場利用画面                             │
│   一覧 / 詳細 / 登録 / 承認 / ダッシュボード / モバイル   │
├─────────────────────────────────────────────────────────┤
│ ③ Workflow / Automation層                               │
│   トリガー / 条件分岐 / 承認 / 通知 / API呼出 / 定期実行  │
├─────────────────────────────────────────────────────────┤
│ ④ AI Orchestration層                                    │
│   プロンプト管理 / モデル切替 / RAG / ツール実行           │
│   アクション制御 / コスト計測 / ガードレール               │
├─────────────────────────────────────────────────────────┤
│ ⑤ Data / Connector層                                    │
│   PostgreSQL / S3 / pgvector / 外部SaaS / SSO           │
├─────────────────────────────────────────────────────────┤
│ ⑥ Governance層                                          │
│   RBAC / テナント分離 / 監査ログ / 版管理 / DLP           │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 画面構成

### 5.1 画面一覧（全33画面）

#### A. 共通画面
| # | 画面名 | MVP | パス例 |
|---|---|---|---|
| 1 | ログイン | ○ | `/login` |
| 2 | テナント選択 | ○ | `/tenants` |
| 3 | ホームダッシュボード | ○ | `/home` |
| 4 | 通知センター | ○ | `/notifications` |
| 5 | 個人設定 | △ | `/settings/profile` |

#### B. Builder画面（アプリ設計）
| # | 画面名 | MVP | パス例 |
|---|---|---|---|
| 6 | アプリ一覧 | ○ | `/apps` |
| 7 | 新規アプリ作成 | ○ | `/apps/new` |
| 8 | **AIアプリ生成** | ○ | `/apps/new/ai` |
| 9 | テーブル設計 | ○ | `/apps/:id/tables` |
| 10 | フィールド設計 | ○ | `/apps/:id/tables/:tid/fields` |
| 11 | ビュー設計 | ○ | `/apps/:id/views` |
| 12 | フォーム設計 | ○ | `/apps/:id/forms` |
| 13 | ワークフロー設計 | ○ | `/apps/:id/workflows` |
| 14 | 権限設計 | ○ | `/apps/:id/permissions` |
| 15 | AIアクション設計 | △ | `/apps/:id/ai-actions` |
| 16 | コネクタ設定 | × | `/apps/:id/connectors` |
| 17 | アプリ設定 | ○ | `/apps/:id/settings` |
| 18 | 公開・バージョン管理 | ○ | `/apps/:id/publish` |

#### C. Runtime画面（業務実行）
| # | 画面名 | MVP | パス例 |
|---|---|---|---|
| 19 | アプリトップ | ○ | `/run/:appCode` |
| 20 | レコード一覧 | ○ | `/run/:appCode/:table` |
| 21 | レコード詳細 | ○ | `/run/:appCode/:table/:id` |
| 22 | レコード登録・編集 | ○ | `/run/:appCode/:table/new` |
| 23 | 承認待ち一覧 | ○ | `/run/:appCode/approvals` |
| 24 | ダッシュボード | ○ | `/run/:appCode/dashboard` |
| 25 | AIサイドパネル | ○ | （レコード詳細に統合） |
| 26 | ファイル解析結果 | ○ | （レコード詳細に統合） |

#### D. Admin画面（管理）
| # | 画面名 | MVP | パス例 |
|---|---|---|---|
| 27 | ユーザー管理 | ○ | `/admin/users` |
| 28 | ロール管理 | ○ | `/admin/roles` |
| 29 | テナント設定 | ○ | `/admin/tenant` |
| 30 | 監査ログ | ○ | `/admin/audit-logs` |
| 31 | AI利用ログ | ○ | `/admin/ai-logs` |
| 32 | モデル設定 | △ | `/admin/ai-models` |
| 33 | 利用分析 | × | `/admin/analytics` |

### 5.2 主要画面の実装済みプロトタイプ

以下のHTMLプロトタイプが `stitch/` ディレクトリに存在する:

| 画面 | ディレクトリ | テーマ |
|---|---|---|
| AIアプリ生成（Prompt to App） | `prompt_to_app_builder/` | ライト |
| AIアプリ生成（Prompt to App） | `prompt_to_app_builder_dark/` | ダーク |
| テーブル・フィールド設計 | `table_field_designer_dark/` | ダーク |
| ワークフローエディタ | `workflow_editor_dark/` | ダーク |
| レコード詳細 + AIサイドパネル | `runtime_view_dark/` | ダーク |
| モバイル一覧 | `runtime_view_mobile/` | ダーク |
| AIアクション承認フロー | `ai_action_approval_flow_dark/` | ダーク |
| 監査ログ | `admin_audit_logs_dark/` | ダーク |

各ディレクトリには `code.html`（実装）と `screen.png`（スクリーンショット）が含まれる。

### 5.3 主要画面の詳細仕様

#### 5.3.1 AIアプリ生成画面（Prompt to App）

**目的**: 自然言語入力からアプリの設計一式を自動生成する。差別化の中核体験。

**レイアウト**:
- 上部: 大きなヘッドライン「What kind of app do you want to build today?」
- 中央: プロンプト入力フィールド（グロー付き）+ サンプルチップ
- 下部左: 生成アセット一覧（Tables / Views / Workflows）
- 下部右: 生成結果プレビュー（フォームモック + AI Insight）
- 最下部: リファイン入力 + 「Approve and Build」ボタン

**生成対象**:
- テーブル構造
- フィールド定義
- ビュー候補
- ワークフロー候補
- AI推奨フィールド
- AI Insight（推奨アクション）

**フロー**:
1. ユーザーが自然言語で業務を説明
2. AIがメタデータを生成
3. プレビューで確認
4. リファインで調整
5. 「Approve and Build」で確定

#### 5.3.2 テーブル・フィールド設計画面

**目的**: 業務データの構造をGUIで定義する。

**レイアウト**:
- 左サイド: テーブル一覧（ステータスバッジ付き）
- 中央: フィールド一覧（名前 / 型 / バッジ）
- 右サイド: AI Assistant パネル（要約 / Smart Actions / Model Training Status）
- 下部: AI Insights バー

**AI補助**:
- Smart Suggestion: フィールド追加提案（例: Incident Priorityフィールド追加）
- CSV/Excel/PDFからの項目推定
- データ型・必須設定の自動提案
- 「AI Generated」バッジによるAI生成フィールドの識別

**フィールド型**:
- Text / Number / Date / Select / File / Boolean
- User Reference / Master Reference
- AI Generated（AI自動入力フィールド）
- Calculated（計算項目）

#### 5.3.3 ワークフローエディタ

**目的**: 業務フローをビジュアルに設計する。React Flowベースのノードエディタ。

**レイアウト**:
- 左サイド: ナビゲーション
- 中央: ノードキャンバス（ドラッグ＆ドロップ）
- 右サイド: AI Assistant パネル
- 下部: AIプロンプト入力バー + Summary / Actions / Context タブ

**ノード種別**:
- Trigger（レコード作成 / 更新 / スケジュール / Webhook）
- Condition（条件分岐、True/False分岐）
- Approval（承認ステップ）
- Notification（通知送信）
- API Call（外部API呼び出し）
- AI Action（AI処理実行）
- Status Update（ステータス変更）

**AI補助**:
- Suggested Improvement: ノード追加提案（例: 承認ステップ追加）
- 「APPLY CHANGES」ボタンでAI提案を反映
- 自然言語からのフロー生成（例: 「Add a manager approval step if priority is critical」）
- コンテキスト分析に基づく最適な挿入位置の自動判定

#### 5.3.4 レコード詳細 + AIサイドパネル

**目的**: 業務実行の中心画面。レコード情報とAI支援を統合表示。

**レイアウト**:
- 左サイド: レコード一覧（ステータスバッジ / 優先度 / 経過時間）
- 中央: レコード詳細（件名 / 本文 / 添付 / システムログ / コメント欄）
- 右サイド: AI Assistant パネル

**AI Assistantパネルの機能**:
- **Issue Summary**: レコード内容のAI要約
- **Recommended Actions**: 次アクション提案（例: Escalate to L2）+ テンプレート送信
- **Similar Incidents**: 類似レコード検索（マッチ率表示）
- **Summary / Actions / Context** タブ切替

**レコード一覧の情報**:
- チケットID
- 件名
- 優先度バッジ（Critical / High / Medium / Low）
- ステータスバッジ（Active Ticket等）
- 経過時間
- スニペット

#### 5.3.5 モバイル一覧画面

**目的**: モバイル端末でのレコード閲覧・操作。

**レイアウト**:
- 上部: 検索バー
- タブ: ALL ACTIVE / HIGH PRIORITY / AI SUGGEST
- カード型一覧: 件名 / ステータス / 優先度 / 経過時間
- AI Resolution Path リンク
- 下部: Summary / Tasks タブ + FAB（新規作成）

#### 5.3.6 AIアクション承認フロー

**目的**: AIの提案変更をHuman in the Loopで承認する画面。

**レイアウト**:
- 上部: チケット詳細（ID / 件名）
- 中央上: AI提案カード（Proposed Change / AI Insight / Accept / Reject）
- 中央: 詳細情報（Description / Metadata / Status）
- 右サイド: AI Flow History（時系列のAI処理ログ）
- 下部: Sentiment & Latency グラフ / System Health
- 最下部: Human-in-the-Loop ワークフロー

**AI Flow History 表示例**:
1. Ticket Created
2. Auto-Tagged: "Database"
3. Proposed: Priority → Critical
4. （承認待ち）

#### 5.3.7 監査ログ画面

**目的**: 全操作の追跡。企業コンプライアンス対応。

**レイアウト**:
- 上部: フィルタバー（Date Range / User / Action Type / Involvement）
- 左: ログテーブル（Timestamp / User / Action / Resource）
- 右: Event Detail パネル（Operation / AI Insights / Raw Payload）

**記録対象**:
- SCHEMA_UPDATE / NODE_SCALING / ACCESS_DENIED / AUTH_LOGIN / API_KEY_ROT 等
- AI Managed アクションのフラグ
- Automated Action の事前バリデーション結果（Risk Score表示）
- Raw Payload（JSON）のエクスポート機能

---

## 6. 機能一覧

### 6.1 基盤機能

| 機能 | 説明 | MVP |
|---|---|---|
| テナント管理 | マルチテナント対応 | ○ |
| ユーザー管理 | CRUD / 招待 / 無効化 | ○ |
| ロール管理 | ロール定義・割当 | ○ |
| SSO対応 | SAML / OIDC | △ |
| 監査ログ | 全操作の記録・検索 | ○ |
| 通知 | メール / アプリ内通知 | ○ |
| ファイル管理 | S3互換ストレージ | ○ |
| バージョン管理 | アプリ定義の版管理 | ○ |

### 6.2 アプリ作成機能

| 機能 | 説明 | MVP |
|---|---|---|
| アプリ作成 | 手動でのアプリ作成 | ○ |
| **Prompt to App** | 自然言語からアプリ一括生成 | ○ |
| テーブル設計 | テーブル定義GUI | ○ |
| フィールド設計 | フィールド定義 + AI提案 | ○ |
| フォーム設計 | D&Dフォームビルダー | ○ |
| ビュー設計 | 一覧/カンバン/カレンダー/チャート | ○ |
| ワークフロー設計 | ノードベースフローエディタ | ○ |
| **Prompt to Workflow** | 自然言語からフロー差分適用 | △ |
| 権限設計 | ロールベース権限GUI | ○ |
| AIアクション設計 | AI処理の定義・制約設定 | △ |
| アプリ公開 | draft → published 制御 | ○ |

### 6.3 実行機能

| 機能 | 説明 | MVP |
|---|---|---|
| レコード一覧 | フィルタ / ソート / ページネーション | ○ |
| レコード登録・編集 | フォームベース入力 | ○ |
| レコード詳細 | 全情報統合表示 | ○ |
| 検索・絞り込み | 全文検索 + フィルタ | ○ |
| 承認・差戻し | ワークフロー連動 | ○ |
| コメント | レコードへのコメント | ○ |
| 添付ファイル | アップロード / プレビュー | ○ |
| ダッシュボード | 基本集計・KPI表示 | ○ |

### 6.4 AI機能

| 機能 | 説明 | MVP |
|---|---|---|
| **Prompt to App** | 自然言語 → テーブル/フィールド/ビュー/WF生成 | ○ |
| **AIフィールド提案** | CSV/Excel/PDFから項目推定 | ○ |
| **レコード要約** | レコード内容のAI要約 | ○ |
| **次アクション提案** | コンテキストに基づく推奨アクション | ○ |
| **返信案生成** | 問い合わせへの回答テンプレート生成 | ○ |
| **PDF/画像解析** | 文書からの構造化データ抽出 | ○ |
| **類似レコード検索** | ベクトル検索による類似事例検索 | △ |
| **メール/問い合わせ分類** | 自動カテゴリ分類 | △ |
| **異常値検知** | データ異常の自動検知 | △ |
| **AIエージェント** | 複数ステップの自律実行 | × |
| **RAG** | 社内文書を参照した回答生成 | × |
| AI実行ログ | 入出力 / モデル / コスト記録 | ○ |
| 根拠表示 | AI回答の参照元レコード・文書の提示 | ○ |

### 6.5 外部連携機能

| 機能 | 説明 | MVP |
|---|---|---|
| Webhook | 送受信 | △ |
| REST API | CRUD API自動生成 | △ |
| CSV入出力 | インポート / エクスポート | ○ |
| メール送信 | 通知メール | ○ |
| Slack/Teams通知 | チャットツール連携 | × |
| ERP/CRM連携 | 外部SaaS連携 | × |

---

## 7. DB設計

### 7.1 設計方針

- PostgreSQL を使用
- 全主要テーブルに `tenant_id` を付与
- メタデータ（アプリ定義）と実データ（レコード）を分離
- レコード実データは `records.data_json`（JSONB）に格納
- AI実行履歴は独立管理
- 監査ログは追記専用

### 7.2 テーブル群（4群構成）

#### 群1: 認証・組織系

```sql
-- テナント
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    plan_type VARCHAR(50) DEFAULT 'standard',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ユーザー
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- ロール
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    role_type VARCHAR(50) NOT NULL, -- system / admin / user
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ユーザー×ロール
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, role_id)
);
```

#### 群2: アプリ定義メタデータ系

```sql
-- アプリ
CREATE TABLE apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft / published / archived
    icon VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

-- アプリバージョン
CREATE TABLE app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    version_no INTEGER NOT NULL,
    metadata_json JSONB NOT NULL, -- 全体定義スナップショット
    published_by UUID REFERENCES users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, version_no)
);

-- テーブル定義
CREATE TABLE app_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, code)
);

-- フィールド定義
CREATE TABLE app_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    table_id UUID NOT NULL REFERENCES app_tables(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- text / number / date / select / file / boolean / user_ref / master_ref / ai_generated / calculated
    required BOOLEAN DEFAULT FALSE,
    unique_flag BOOLEAN DEFAULT FALSE,
    default_value JSONB,
    settings_json JSONB, -- 選択肢リスト、参照先、計算式等
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(table_id, code)
);

-- リレーション定義
CREATE TABLE app_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    source_table_id UUID NOT NULL REFERENCES app_tables(id),
    source_field_id UUID REFERENCES app_fields(id),
    target_table_id UUID NOT NULL REFERENCES app_tables(id),
    relation_type VARCHAR(50) NOT NULL, -- one_to_many / many_to_one / many_to_many
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ビュー定義
CREATE TABLE app_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    table_id UUID NOT NULL REFERENCES app_tables(id),
    name VARCHAR(255) NOT NULL,
    view_type VARCHAR(50) NOT NULL, -- list / kanban / calendar / chart / kpi
    settings_json JSONB, -- 表示カラム / ソート / フィルタ / グルーピング / 集計
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- フォーム定義
CREATE TABLE app_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    table_id UUID NOT NULL REFERENCES app_tables(id),
    name VARCHAR(255) NOT NULL,
    layout_json JSONB NOT NULL, -- セクション / フィールド配置 / 条件表示 / バリデーション
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ワークフロー定義
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- create / update / schedule / webhook / status_change
    status VARCHAR(50) DEFAULT 'draft', -- draft / active
    definition_json JSONB NOT NULL, -- ノード定義（トリガー/条件/承認/通知/API/AI/ステータス更新）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 権限定義
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID REFERENCES apps(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    resource_type VARCHAR(50) NOT NULL, -- app / table / field / record / ai_action
    resource_id UUID,
    action VARCHAR(50) NOT NULL, -- view / create / update / delete / approve / execute
    effect VARCHAR(10) NOT NULL, -- allow / deny
    condition_json JSONB, -- 条件式（レコードレベル権限等）
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 群3: レコード実行系

```sql
-- レコード（実データ）
CREATE TABLE records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID NOT NULL REFERENCES apps(id),
    table_id UUID NOT NULL REFERENCES app_tables(id),
    status VARCHAR(100),
    data_json JSONB NOT NULL, -- 動的フィールドの実データ
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- 論理削除
);

-- レコード更新履歴
CREATE TABLE record_histories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    record_id UUID NOT NULL REFERENCES records(id),
    before_json JSONB,
    after_json JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- レコードコメント
CREATE TABLE record_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    record_id UUID NOT NULL REFERENCES records(id),
    comment_text TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添付ファイル
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    record_id UUID REFERENCES records(id),
    file_name VARCHAR(500) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(255),
    file_size BIGINT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 承認
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    record_id UUID NOT NULL REFERENCES records(id),
    workflow_id UUID REFERENCES workflows(id),
    approver_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending / approved / rejected
    comment_text TEXT,
    acted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 群4: AI・監査系

```sql
-- AIアクション定義
CREATE TABLE ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID REFERENCES apps(id),
    name VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- summarize / classify / reply / extract / suggest_next / detect_anomaly
    target_scope VARCHAR(50) NOT NULL, -- record / form / workflow / batch
    prompt_template TEXT NOT NULL,
    model_config_json JSONB, -- モデル名 / temperature / max_tokens等
    guardrail_json JSONB, -- 実行制約（承認要否 / 最大実行回数 / データアクセス範囲）
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI実行ログ
CREATE TABLE ai_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    app_id UUID REFERENCES apps(id),
    record_id UUID REFERENCES records(id),
    ai_action_id UUID REFERENCES ai_actions(id),
    input_json JSONB,
    output_json JSONB,
    model_name VARCHAR(100),
    token_usage_in INTEGER,
    token_usage_out INTEGER,
    cost_amount NUMERIC(10, 6),
    status VARCHAR(50), -- success / error
    executed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI文書解析結果
CREATE TABLE ai_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    record_id UUID REFERENCES records(id),
    attachment_id UUID REFERENCES attachments(id),
    doc_type VARCHAR(50), -- pdf / image / email
    extracted_text TEXT,
    structured_json JSONB, -- 構造化抽出結果
    summary_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 監査ログ
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    actor_id UUID REFERENCES users(id),
    action_type VARCHAR(100) NOT NULL, -- login / create / update / delete / approve / reject / ai_execute / schema_update / access_denied
    resource_type VARCHAR(100), -- app / record / user / workflow / permission / ai_action
    resource_id UUID,
    detail_json JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_records_tenant_app ON records(tenant_id, app_id);
CREATE INDEX idx_records_tenant_table ON records(tenant_id, table_id);
CREATE INDEX idx_records_data ON records USING GIN(data_json);
CREATE INDEX idx_records_status ON records(tenant_id, status);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(tenant_id, actor_id);
CREATE INDEX idx_ai_execution_logs_tenant ON ai_execution_logs(tenant_id, created_at DESC);
CREATE INDEX idx_approvals_approver ON approvals(tenant_id, approver_id, status);
```

---

## 8. API設計

### 8.1 認証・組織 API

```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/tenants
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/roles
POST   /api/roles
PUT    /api/roles/:id
POST   /api/user-roles
DELETE /api/user-roles/:id
```

### 8.2 アプリ定義 API

```
GET    /api/apps
POST   /api/apps
GET    /api/apps/:id
PUT    /api/apps/:id
DELETE /api/apps/:id
POST   /api/apps/:id/publish

GET    /api/apps/:id/tables
POST   /api/apps/:id/tables
PUT    /api/apps/:id/tables/:tid
DELETE /api/apps/:id/tables/:tid

GET    /api/apps/:id/tables/:tid/fields
POST   /api/apps/:id/tables/:tid/fields
PUT    /api/apps/:id/tables/:tid/fields/:fid
DELETE /api/apps/:id/tables/:tid/fields/:fid

GET    /api/apps/:id/views
POST   /api/apps/:id/views
PUT    /api/apps/:id/views/:vid
DELETE /api/apps/:id/views/:vid

GET    /api/apps/:id/forms
POST   /api/apps/:id/forms
PUT    /api/apps/:id/forms/:fid
DELETE /api/apps/:id/forms/:fid

GET    /api/apps/:id/workflows
POST   /api/apps/:id/workflows
PUT    /api/apps/:id/workflows/:wid
DELETE /api/apps/:id/workflows/:wid

GET    /api/apps/:id/permissions
POST   /api/apps/:id/permissions
PUT    /api/apps/:id/permissions/:pid
DELETE /api/apps/:id/permissions/:pid

GET    /api/apps/:id/versions
POST   /api/apps/:id/versions
```

### 8.3 レコード実行 API

```
GET    /api/run/:appCode/:table
POST   /api/run/:appCode/:table
GET    /api/run/:appCode/:table/:id
PUT    /api/run/:appCode/:table/:id
DELETE /api/run/:appCode/:table/:id

GET    /api/run/:appCode/:table/:id/comments
POST   /api/run/:appCode/:table/:id/comments

GET    /api/run/:appCode/:table/:id/attachments
POST   /api/run/:appCode/:table/:id/attachments
DELETE /api/run/:appCode/:table/:id/attachments/:aid

GET    /api/run/:appCode/:table/:id/history

POST   /api/approvals/:id/approve
POST   /api/approvals/:id/reject
GET    /api/approvals/pending
```

### 8.4 AI API

```
POST   /api/ai/generate-app          -- Prompt to App
POST   /api/ai/suggest-fields        -- フィールド自動提案
POST   /api/ai/generate-workflow      -- Prompt to Workflow
POST   /api/ai/summarize-record       -- レコード要約
POST   /api/ai/suggest-next-actions   -- 次アクション提案
POST   /api/ai/generate-reply         -- 返信案生成
POST   /api/ai/extract-document       -- PDF/画像解析
POST   /api/ai/classify               -- 分類
```

### 8.5 管理 API

```
GET    /api/admin/audit-logs
GET    /api/admin/audit-logs/:id
GET    /api/admin/ai-logs
GET    /api/admin/ai-logs/:id
GET    /api/admin/ai-logs/stats       -- コスト・利用統計
```

---

## 9. 権限・セキュリティ

### 9.1 権限モデル（RBAC + 条件付き）

制御粒度:
- **アプリ単位**: アプリへのアクセス可否
- **テーブル単位**: テーブルごとのCRUD
- **フィールド単位**: 機密フィールドの閲覧制限
- **レコード単位**: 条件式による行レベル制御（例: 自部門のレコードのみ）
- **AIアクション単位**: AI機能ごとの実行可否

### 9.2 ロール設計（MVP）

| ロール | 権限概要 |
|---|---|
| system_admin | 全テナント管理 |
| tenant_admin | テナント内全管理 |
| app_admin | 特定アプリの設計・管理 |
| approver | 承認・差戻し |
| user | レコード操作 |
| viewer | 閲覧のみ |

### 9.3 AI安全設計

- AI実行対象データは権限に応じて制限
- 重要操作（ステータス変更・削除等）は自動実行せず承認付き
- AI出力は全件ログ保存
- 使用モデル / 入力 / 出力 / トークン / コストを記録
- プロンプトテンプレートは版管理対象

---

## 10. 開発ロードマップ

### Phase 1: MVP

**目標**: AIで業務アプリを作り、現場で使い、安全に運用できることの実証

| カテゴリ | 実装内容 |
|---|---|
| 認証 | ログイン / セッション管理 |
| 組織 | テナント / ユーザー / ロール |
| Builder | アプリ / テーブル / フィールド / フォーム / ビュー |
| Builder AI | **Prompt to App** / AIフィールド提案 |
| Workflow | 簡易ワークフロー（トリガー / 条件 / 承認 / 通知） |
| Runtime | レコードCRUD / 一覧 / 詳細 / コメント / 添付 |
| Runtime AI | **レコード要約** / 次アクション / 返信案 / PDF解析 |
| 権限 | アプリ・テーブル単位RBAC |
| 監査 | 全操作ログ / AI実行ログ |
| 公開 | アプリ公開 / バージョン管理 |

### Phase 2: 拡張

| カテゴリ | 実装内容 |
|---|---|
| Builder AI | Prompt to Workflow / AIアクションテンプレート |
| Runtime AI | 類似レコード検索 / 分類 / 異常値検知 |
| 権限 | フィールド・レコード単位の細粒度制御 |
| 検索 | ベクトル検索（pgvector） |
| 連携 | Webhook / REST API公開 / Slack通知 |
| ビュー | カンバン / カレンダー / 高度なダッシュボード |

### Phase 3: エンタープライズ

| カテゴリ | 実装内容 |
|---|---|
| AI | AIエージェント（承認付き自律実行） |
| AI | RAG（社内文書参照） |
| 連携 | ERP/CRM双方向同期 |
| モバイル | オフライン対応 |
| 運用 | Self-hosted / VPC配置 |
| エコシステム | テンプレートマーケットプレイス |
| 分析 | 高度な利用分析 / AI成功率 / コスト分析 |

---

## 11. MVP成功指標

### 定量指標

| 指標 | 目標 |
|---|---|
| 初回アプリ作成完了率 | 80%以上 |
| AI提案採用率 | 60%以上 |
| レコード入力時間短縮率 | 30%以上 |
| 承認処理時間短縮率 | 40%以上 |
| AI要約利用率 | 50%以上 |
| エラー率 | 5%未満 |

### 定性指標

- 「業務アプリを作るまでが早い」と感じるか
- 「AIが実務に使える」と感じるか
- 「誤操作や暴走が怖くない」と感じるか

---

## 12. ディレクトリ構造（推奨）

```
stitch/
├── apps/
│   ├── web/                    # Next.js フロントエンド
│   │   ├── src/
│   │   │   ├── app/            # App Router
│   │   │   ├── components/
│   │   │   │   ├── builder/    # Builder画面コンポーネント
│   │   │   │   ├── runtime/    # Runtime画面コンポーネント
│   │   │   │   ├── admin/      # Admin画面コンポーネント
│   │   │   │   ├── ai/         # AI関連コンポーネント
│   │   │   │   └── shared/     # 共通コンポーネント
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── stores/
│   │   │   └── types/
│   │   └── public/
│   └── api/                    # バックエンドAPI
│       ├── src/
│       │   ├── auth/
│       │   ├── tenants/
│       │   ├── apps/
│       │   ├── records/
│       │   ├── workflows/
│       │   ├── ai/
│       │   │   ├── gateway/    # Model Gateway
│       │   │   ├── actions/    # AIアクション実行
│       │   │   └── prompts/    # プロンプトテンプレート
│       │   ├── audit/
│       │   └── connectors/
│       └── prisma/             # DB schema (or TypeORM)
├── packages/
│   ├── shared/                 # 共有型定義・ユーティリティ
│   └── metadata-schema/        # メタデータJSONスキーマ定義
├── infra/                      # インフラ定義
├── docs/                       # ドキュメント
└── prototypes/                 # 既存HTMLプロトタイプ
    ├── prompt_to_app_builder/
    ├── prompt_to_app_builder_dark/
    ├── table_field_designer_dark/
    ├── workflow_editor_dark/
    ├── runtime_view_dark/
    ├── runtime_view_mobile/
    ├── ai_action_approval_flow_dark/
    └── admin_audit_logs_dark/
```

---

## 13. 開発時の注意事項

### コーディング規約

- TypeScript strict mode
- ESLint + Prettier

## Implementation Plan

### Current State

現行リポジトリでは、`app/` 配下の Next.js フロントエンドが先行実装されている。
主に以下の画面は動作する:

- `/login`
- `/home`
- `/apps/new/ai`
- `/apps/:id/tables`
- `/apps/:id/workflows`
- `/run/:appCode/:table`
- `/m/:appCode/:table`
- `/admin/approvals`
- `/admin/audit-logs`

Current implementation snapshot:

- Working API routes: auth login/logout/me and apps/tables/fields CRUD Route Handlers
- DB-backed today: auth, session, apps, tables, fields
- Still pending: records, comments, attachments, workflow execution, approvals persistence, AI runtime persistence, publish/versioning, audit persistence

ただし、現状の多くは **UIモック + mockデータ** であり、以下は未実装または限定実装である:

- バックエンド API
- DB 永続化
- 認証・認可の本実装
- Model Gateway 経由の AI 実行
- Publish / Versioning
- 監査ログの実記録

### Implementation Strategy

実装順は以下の依存関係に従う:

1. 基盤: 認証、API、DB、共通データ取得層
2. Builder コア: App / Table / Field を保存可能にする
3. Runtime コア: Record CRUD を成立させる
4. Workflow / Approval: 業務フローと承認を実データ化する
5. AI MVP: Prompt to App、要約、次アクション、返信案を実接続する
6. Governance: RBAC、監査ログ、Publish を導入する

### Sprint Plan

#### Sprint 1: 基盤整備

目的: フロントの mock 依存を外し、実データ実装の土台を作る。

実装内容:

- API サービス雛形作成
- DB schema / migration 導入
- 認証 API 実装
- フロントの API client 実装
- `authStore` の mock 認証排除
- 共通ローディング / エラーハンドリング導入

完了条件:

- `/login` が実認証で動作する
- 保護ルートでセッションが維持される
- フロントが API 経由でデータ取得できる

#### Sprint 2: Builder コア

目的: アプリ定義を保存できる状態にする。

実装内容:

- `/apps` 実装
- `/apps/new` 実装
- `/apps/:id/tables` 保存処理
- `/apps/:id/tables/:tid/fields` 実装
- apps / tables / fields CRUD API

完了条件:

- アプリ作成ができる
- テーブル追加・編集ができる
- フィールド追加・編集ができる
- 再読込後も内容が保持される

#### Sprint 3: Runtime コア

目的: 実際の業務データを登録・更新・閲覧できるようにする。

実装内容:

- `/run/:appCode` 実装
- `/run/:appCode/:table` API 接続
- `/run/:appCode/:table/new` 実装
- record CRUD API
- コメント API
- 添付 API

完了条件:

- レコード一覧・詳細が実データで動く
- 新規作成・更新・削除が可能
- コメント投稿と添付登録が可能

#### Sprint 4: Workflow / Approval

目的: 業務フローと承認を mock ではなく業務処理に接続する。

実装内容:

- `/apps/:id/workflows` 保存 / 読込
- ノード追加・削除・接続変更
- workflow schema / API
- approvals API
- `/run/:appCode/approvals` 実装
- `/admin/approvals` 実データ化

完了条件:

- ワークフローを定義・保存できる
- レコード操作から承認待ちが発生する
- 承認 / 却下の状態更新が行える

#### Sprint 5: AI MVP

目的: AI 関連画面を固定表示から実行系へ移行する。

実装内容:

- Model Gateway 最小実装
- `/apps/new/ai` を `generate-app` API に接続
- AI フィールド提案
- レコード要約
- 次アクション提案
- 返信案生成
- Human-in-the-Loop の反映導線

完了条件:

- Prompt to App が実レスポンスを返す
- Runtime の AI 要約 / 次アクション / 返信案が実行される
- AI 提案を承認して保存できる

#### Sprint 6: Governance / Publish

目的: MVP を安全に運用・公開できる状態にする。

実装内容:

- App / Table レベル RBAC
- 監査ログ実記録
- `/admin/audit-logs` 実接続
- Publish / Versioning
- `/apps/:id/settings` 実装

完了条件:

- ロールごとに操作制御できる
- 主要操作が監査ログに残る
- 公開バージョンを切り替えられる

#### Sprint 7: 仕上げ

目的: MVP の未実装画面と品質保証を補完する。

実装内容:

- `/tenants`
- `/notifications`
- `/admin/users`
- `/admin/roles`
- `/admin/tenant`
- `/admin/ai-logs`
- モバイル調整
- E2E テスト
- 性能 / 監視 / 文言整理

完了条件:

- MVP 一式が通しでデモ可能
- 主要ユースケースの E2E が通る
- UI モック依存が主要導線から排除される

### Immediate Next Steps

直近は以下の順で着手する:

1. API client と共通 fetch 層を作る
2. 認証を本実装に置き換える
3. apps / tables / fields の CRUD を実装する
4. records / comments / attachments の CRUD を実装する
5. workflow 保存と approvals を実装する
6. AI app builder と runtime AI を実接続する

### Updated Immediate Next Steps

1. records / comments / attachments を Prisma に移行する
2. workflow / approvals を DB-backed にする
3. AI app builder と runtime AI を Model Gateway 前提で実装する
4. publish / versioning / audit persistence を追加する
5. E2E テストを追加して主要ユースケースを固定する

## Implementation Update (2026-04-14)

### Completed in this branch

- Added Next.js Route Handlers for auth and builder metadata APIs.
- Added API client modules under `app/src/lib/api/` and switched auth state to async API-backed flow.
- Added PostgreSQL + Prisma 7 setup with Docker Compose, Prisma config, schema, migration files, and `db:*` npm scripts.
- Replaced mock auth with DB-backed auth using PostgreSQL users, `scrypt` password hashes, and session records stored in the `sessions` table.
- Replaced in-memory `apps / tables / fields` CRUD with Prisma-backed services.
- Added bootstrap logic for demo auth data and demo builder metadata so the current UI works after DB startup and migration.

### Current login flow

- Create `app/.env.local` with `DATABASE_URL`
- Run `npm run db:start`
- Run `npm run dev`
- Demo accounts:
  `marcus.chen@acme.com`, `alex.rivera@acme.com`, `sarah.jenkins@acme.com`, `admin@acme.com`
- Demo password:
  `demo`

### Current implementation status

- DB-backed and working:
  auth, session, apps, tables, fields
- Not DB-backed yet or not implemented:
  records, comments, attachments, workflow execution, approvals, publish/versioning, audit persistence, AI runtime persistence

### Definition of Done

各機能は以下を満たして完了とする:

- 画面遷移だけでなく保存・再取得まで動作する
- mock データではなく API / DB を使用する
- 失敗時の UI がある
- 主要操作が監査ログに残る
- 権限制御が必要な操作に適用される
- 型定義と lint / build が通る
- Tailwind CSS（デザイントークンは `DESIGN.md` のトークン体系に準拠）
- コンポーネントは Atomic Design を参考にしつつ、画面単位で整理

### メタデータの扱い

- アプリ定義の変更は必ずバージョンを記録
- AI生成のメタデータには `source: "ai"` フラグを付与
- 手動変更のメタデータには `source: "manual"` フラグを付与

### AI統合の原則

- LLMを直接呼ばない。必ず Model Gateway 経由
- AI出力は必ずログに保存
- AI提案は即時反映しない（Human in the Loop）
- AI生成コンテンツには必ず出典・根拠を添付
- プロンプトテンプレートはDBで版管理

### テスト方針

- ユニットテスト: ビジネスロジック / 権限チェック / メタデータバリデーション
- 統合テスト: API エンドポイント / ワークフロー実行
- E2Eテスト: 主要ユーザーフロー（アプリ作成 → レコード操作 → 承認）
