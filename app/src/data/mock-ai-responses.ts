import type {
  AIGeneratedApp,
  AISummary,
  AIFieldSuggestion,
  AIFlowHistoryItem,
} from "@/types/ai";

export const mockGeneratedApp: AIGeneratedApp = {
  name: "Customer Support Desk",
  code: "support-desk",
  description: "A ticketing system for customer support with escalation workflows",
  tables: [
    {
      name: "Tickets",
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
      name: "Customers",
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
    { name: "All Tickets", viewType: "list" },
    { name: "My Pending", viewType: "list" },
    { name: "By Priority", viewType: "kanban" },
  ],
  workflows: [
    { name: "Approval Chain", triggerType: "create" },
    { name: "Escalation Flow", triggerType: "update" },
  ],
  aiInsight:
    '"This customer has a renewal in 14 days. Escalating to Premier Support is recommended."',
};

export const mockRecordSummary: AISummary = {
  summary:
    "Critical database connection pool exhaustion detected in production. Likely caused by unoptimized query patterns in the v2.4.0-beta release. System logs show 100% saturation on cluster eu-west-01.",
  recommendedActions: [
    {
      label: "Escalate to L2",
      description: "Infrastructure & DB Team",
      icon: "arrow_upward",
      type: "escalate",
    },
    {
      label: "Send Template",
      description: "Service Outage Response",
      icon: "mail",
      type: "template",
    },
  ],
  similarIncidents: [
    {
      id: "rec-prev-001",
      title: "DB Connection Leaks in Node.js Cluster",
      matchPercentage: 89,
      resolution: "Resolved by increasing max connections and adding a fix for the connection pool leak.",
      date: "Jul 2025",
    },
    {
      id: "rec-prev-002",
      title: "Intermittent 504s during heavy writes",
      matchPercentage: 76,
      resolution: "Root cause was a N+1 query issue in the authorization middleware.",
      date: "Dec 2024",
    },
  ],
};

export const mockFieldSuggestions: AIFieldSuggestion[] = [
  {
    fieldName: "Incident Priority",
    fieldType: "select",
    reason: "AI suggests adding an Incident Priority field based on your app description.",
  },
  {
    fieldName: "Resolution Time",
    fieldType: "number",
    reason: "Track time-to-resolution for SLA compliance.",
  },
  {
    fieldName: "Customer Sentiment",
    fieldType: "ai_generated",
    reason: "AI-generated sentiment analysis from ticket text.",
  },
];

export const mockAIFlowHistory: AIFlowHistoryItem[] = [
  {
    id: "afh-001",
    action: "Ticket Created",
    detail: "System",
    timestamp: "08:42 UTC",
    type: "system",
    status: "completed",
  },
  {
    id: "afh-002",
    action: 'Auto-Tagged: "Database"',
    detail: "AI Classifier",
    timestamp: "08:42 UTC",
    type: "ai",
    status: "completed",
  },
  {
    id: "afh-003",
    action: "Proposed: Priority \u2192 Critical",
    detail: "Sentiment Analysis",
    timestamp: "10:15 UTC",
    type: "ai",
    status: "proposed",
  },
  {
    id: "afh-004",
    action: "Awaiting Approval",
    detail: "Manager review required",
    timestamp: "",
    type: "user",
    status: "pending",
  },
];
