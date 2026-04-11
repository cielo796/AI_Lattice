import type {
  AIGeneratedApp,
  AISummary,
  AIFieldSuggestion,
  AIFlowHistoryItem,
} from "@/types/ai";

export const mockGeneratedApp: AIGeneratedApp = {
  name: "カスタマーサポートデスク",
  code: "support-desk",
  description: "エスカレーションフロー付きのカスタマーサポート問い合わせ管理システム",
  tables: [
    {
      name: "チケット",
      code: "tickets",
      fields: [
        { name: "ticket_id", code: "ticket_id", fieldType: "text", required: true },
        { name: "subject", code: "subject", fieldType: "text", required: true },
        { name: "description", code: "description", fieldType: "textarea", required: false },
        { name: "priority", code: "priority", fieldType: "select", required: true },
        { name: "status", code: "status", fieldType: "select", required: true },
        { name: "customer", code: "customer", fieldType: "master_ref", required: true },
        { name: "assignee", code: "assignee", fieldType: "user_ref", required: false },
        {
          name: "sentiment_score",
          code: "sentiment_score",
          fieldType: "ai_generated",
          required: false,
          isAISuggested: true,
        },
        { name: "created_at", code: "created_at", fieldType: "datetime", required: true },
      ],
    },
    {
      name: "顧客",
      code: "customers",
      fields: [
        { name: "company_name", code: "company_name", fieldType: "text", required: true },
        { name: "contact_email", code: "contact_email", fieldType: "text", required: true },
        { name: "plan_tier", code: "plan_tier", fieldType: "select", required: false },
        { name: "renewal_date", code: "renewal_date", fieldType: "date", required: false },
      ],
    },
  ],
  views: [
    { name: "全チケット", viewType: "list" },
    { name: "自分の未対応", viewType: "list" },
    { name: "優先度別", viewType: "kanban" },
  ],
  workflows: [
    { name: "承認フロー", triggerType: "create" },
    { name: "エスカレーションフロー", triggerType: "update" },
  ],
  aiInsight:
    "「この顧客は14日後に契約更新があります。プレミアサポートへのエスカレーションを推奨します。」",
};

export const mockRecordSummary: AISummary = {
  summary:
    "本番環境でクリティカルなデータベース接続プール枯渇を検出しました。v2.4.0-betaリリースでの未最適化なクエリパターンが原因の可能性が高いです。クラスター eu-west-01 で100%の飽和が確認されています。",
  recommendedActions: [
    {
      label: "L2へエスカレート",
      description: "インフラ＆DBチーム",
      icon: "arrow_upward",
      type: "escalate",
    },
    {
      label: "テンプレート送信",
      description: "サービス停止お知らせ",
      icon: "mail",
      type: "template",
    },
  ],
  similarIncidents: [
    {
      id: "rec-prev-001",
      title: "Node.jsクラスターのDB接続リーク",
      matchPercentage: 89,
      resolution: "最大接続数の引き上げと接続プールリークの修正で解決しました。",
      date: "2025年7月",
    },
    {
      id: "rec-prev-002",
      title: "高負荷書き込み時の断続的な504エラー",
      matchPercentage: 76,
      resolution: "認可ミドルウェア内のN+1クエリ問題が根本原因でした。",
      date: "2024年12月",
    },
  ],
};

export const mockFieldSuggestions: AIFieldSuggestion[] = [
  {
    fieldName: "インシデント優先度",
    fieldType: "select",
    reason: "アプリ説明に基づき、AIがインシデント優先度フィールドの追加を提案しています。",
  },
  {
    fieldName: "解決時間",
    fieldType: "number",
    reason: "SLA遵守のため解決までの時間を計測します。",
  },
  {
    fieldName: "顧客感情",
    fieldType: "ai_generated",
    reason: "チケット本文からAIが感情分析を自動生成します。",
  },
];

export const mockAIFlowHistory: AIFlowHistoryItem[] = [
  {
    id: "afh-001",
    action: "チケット作成",
    detail: "システム",
    timestamp: "08:42 UTC",
    type: "system",
    status: "completed",
  },
  {
    id: "afh-002",
    action: "自動タグ付け：「データベース」",
    detail: "AI 分類器",
    timestamp: "08:42 UTC",
    type: "ai",
    status: "completed",
  },
  {
    id: "afh-003",
    action: "提案：優先度 → クリティカル",
    detail: "感情分析",
    timestamp: "10:15 UTC",
    type: "ai",
    status: "proposed",
  },
  {
    id: "afh-004",
    action: "承認待ち",
    detail: "マネージャーの確認が必要",
    timestamp: "",
    type: "user",
    status: "pending",
  },
];
