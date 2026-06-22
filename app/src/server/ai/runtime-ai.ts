import {
  generateJsonWithModelGateway,
  type ModelGatewayClientLike,
} from "@/server/ai/model-gateway";
import { AppsServiceError, getAppByCodeForUser } from "@/server/apps/service";
import {
  getRecordForTable,
  getRuntimeTableMeta,
  listCommentsForRecord,
} from "@/server/records/service";
import type { AppField } from "@/types/app";
import type { AppRecord, RecordComment } from "@/types/record";
import type { User } from "@/types/user";

const OPENAI_MODEL = "gpt-5-mini";
const MAX_CONTEXT_COMMENTS = 8;
const MAX_FIELD_VALUE_LENGTH = 600;

export const RUNTIME_AI_ACTIONS = [
  "summarize",
  "next_actions",
  "reply_draft",
] as const;

export type RuntimeAIActionType = (typeof RUNTIME_AI_ACTIONS)[number];

export interface RuntimeAINextAction {
  label: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface RuntimeAIReplyDraft {
  subject: string;
  body: string;
}

export interface RuntimeAIExecution {
  action: RuntimeAIActionType;
  summary?: string;
  keyPoints?: string[];
  nextActions?: RuntimeAINextAction[];
  replyDraft?: RuntimeAIReplyDraft;
  modelName: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const SUMMARIZE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "keyPoints"],
  properties: {
    summary: { type: "string" },
    keyPoints: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const NEXT_ACTIONS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["actions"],
  properties: {
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "description", "priority"],
        properties: {
          label: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
} as const;

const REPLY_DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
} as const;

const ACTION_DEFINITIONS: Record<
  RuntimeAIActionType,
  {
    operation: string;
    promptTemplateKey: string;
    responseFormatName: string;
    responseSchema: Record<string, unknown>;
    instructions: string;
  }
> = {
  summarize: {
    operation: "record.summarize",
    promptTemplateKey: "record.summarize.default",
    responseFormatName: "record_summary",
    responseSchema: SUMMARIZE_RESPONSE_SCHEMA as unknown as Record<
      string,
      unknown
    >,
    instructions: [
      "あなたは業務アプリのレコードを要約するアシスタントです。",
      "渡されたレコード情報とコメント履歴を読み、現在の状況を簡潔な日本語で要約してください。",
      "summary は 2〜4 文で、状況・経緯・現在のステータスを伝えてください。",
      "keyPoints は重要な事実を最大 4 件、短い箇条書きで返してください。",
      "推測で情報を補わず、与えられた内容のみに基づいて記述してください。",
    ].join("\n"),
  },
  next_actions: {
    operation: "record.next_actions",
    promptTemplateKey: "record.next_actions.default",
    responseFormatName: "record_next_actions",
    responseSchema: NEXT_ACTIONS_RESPONSE_SCHEMA as unknown as Record<
      string,
      unknown
    >,
    instructions: [
      "あなたは業務アプリの担当者を支援するアシスタントです。",
      "渡されたレコード情報とコメント履歴から、担当者が次に取るべきアクションを提案してください。",
      "actions は重要度の高い順に最大 3 件返してください。",
      "label は 15 文字以内の短い日本語、description は 1〜2 文で具体的な根拠を含めてください。",
      "priority はレコードの緊急度に応じて high / medium / low を設定してください。",
    ].join("\n"),
  },
  reply_draft: {
    operation: "record.reply_draft",
    promptTemplateKey: "record.reply_draft.default",
    responseFormatName: "record_reply_draft",
    responseSchema: REPLY_DRAFT_RESPONSE_SCHEMA as unknown as Record<
      string,
      unknown
    >,
    instructions: [
      "あなたは業務アプリの担当者に代わって返信文を起案するアシスタントです。",
      "渡されたレコード情報とコメント履歴を踏まえ、依頼者・顧客に送る丁寧な日本語の返信案を作成してください。",
      "subject は返信の件名、body は本文です。",
      "body は挨拶・状況説明・次のステップ・結びで構成し、300 文字程度に収めてください。",
      "不明な事実は断定せず、確認中である旨を記載してください。",
    ].join("\n"),
  },
};

export function isRuntimeAIAction(value: unknown): value is RuntimeAIActionType {
  return (
    typeof value === "string" &&
    (RUNTIME_AI_ACTIONS as readonly string[]).includes(value)
  );
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "(未入力)";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatFieldValue(item)).join(", ");
  }

  if (typeof value === "object") {
    return truncate(JSON.stringify(value), MAX_FIELD_VALUE_LENGTH);
  }

  return truncate(String(value), MAX_FIELD_VALUE_LENGTH);
}

export function buildRecordContext(input: {
  appName: string;
  tableName: string;
  fields: Pick<AppField, "code" | "name" | "fieldType">[];
  record: Pick<AppRecord, "recordNo" | "status" | "data" | "createdAt" | "updatedAt">;
  comments: Pick<RecordComment, "commentText" | "isSystem" | "createdAt">[];
}) {
  const lines: string[] = [
    `アプリ: ${input.appName}`,
    `テーブル: ${input.tableName}`,
    `レコード番号: ${input.record.recordNo ?? "-"}`,
    `ステータス: ${input.record.status || "(未設定)"}`,
    `作成日時: ${input.record.createdAt}`,
    `更新日時: ${input.record.updatedAt}`,
    "",
    "## フィールド",
  ];

  for (const field of input.fields) {
    lines.push(
      `- ${field.name} (${field.code}): ${formatFieldValue(
        input.record.data[field.code]
      )}`
    );
  }

  const recentComments = input.comments.slice(0, MAX_CONTEXT_COMMENTS);
  lines.push("", "## コメント履歴（新しい順）");

  if (recentComments.length === 0) {
    lines.push("(コメントはありません)");
  } else {
    for (const comment of recentComments) {
      const author = comment.isSystem ? "システム" : "担当者";
      lines.push(
        `- [${comment.createdAt}] ${author}: ${truncate(
          comment.commentText,
          MAX_FIELD_VALUE_LENGTH
        )}`
      );
    }
  }

  return lines.join("\n");
}

function parseJsonOutput(outputText: string | undefined, action: string) {
  const raw = outputText?.trim();

  if (!raw) {
    throw new AppsServiceError(
      `AI実行（${action}）が空のレスポンスを返しました。`,
      502
    );
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new AppsServiceError(
      `AI実行（${action}）のレスポンスを解析できませんでした。`,
      502
    );
  }
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKeyPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asTrimmedString(item))
    .filter((item) => item.length > 0)
    .slice(0, 4);
}

function normalizeNextActions(value: unknown): RuntimeAINextAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return [];
      }

      const action = item as Record<string, unknown>;
      const label = asTrimmedString(action.label);
      const description = asTrimmedString(action.description);
      const priority = asTrimmedString(action.priority);

      if (!label) {
        return [];
      }

      return [
        {
          label,
          description,
          priority: (["high", "medium", "low"] as const).includes(
            priority as "high" | "medium" | "low"
          )
            ? (priority as "high" | "medium" | "low")
            : "medium",
        },
      ];
    })
    .slice(0, 3);
}

function toExecutionResult(
  action: RuntimeAIActionType,
  parsed: Record<string, unknown>,
  response: { usage: RuntimeAIExecution["usage"] }
): RuntimeAIExecution {
  const base = {
    action,
    modelName: OPENAI_MODEL,
    usage: response.usage,
  };

  if (action === "summarize") {
    const summary = asTrimmedString(parsed.summary);

    if (!summary) {
      throw new AppsServiceError("AI要約の生成結果が不正です。", 502);
    }

    return {
      ...base,
      summary,
      keyPoints: normalizeKeyPoints(parsed.keyPoints),
    };
  }

  if (action === "next_actions") {
    const nextActions = normalizeNextActions(parsed.actions);

    if (nextActions.length === 0) {
      throw new AppsServiceError("次アクションの生成結果が不正です。", 502);
    }

    return { ...base, nextActions };
  }

  const subject = asTrimmedString(parsed.subject);
  const body = asTrimmedString(parsed.body);

  if (!body) {
    throw new AppsServiceError("返信案の生成結果が不正です。", 502);
  }

  return {
    ...base,
    replyDraft: { subject: subject || "Re: お問い合わせの件", body },
  };
}

export async function executeRuntimeAIAction(
  user: User,
  appCode: string,
  tableCode: string,
  recordId: string,
  action: RuntimeAIActionType,
  client?: ModelGatewayClientLike
): Promise<RuntimeAIExecution> {
  if (!isRuntimeAIAction(action)) {
    throw new AppsServiceError("サポートされていないAIアクションです。", 400);
  }

  const [app, record, meta, comments] = await Promise.all([
    getAppByCodeForUser(user, appCode),
    getRecordForTable(user, appCode, tableCode, recordId),
    getRuntimeTableMeta(user, appCode, tableCode),
    listCommentsForRecord(user, appCode, tableCode, recordId),
  ]);

  const definition = ACTION_DEFINITIONS[action];
  const input = buildRecordContext({
    appName: app.name,
    tableName: meta.table.name,
    fields: meta.fields,
    record,
    comments,
  });

  const response = await generateJsonWithModelGateway(
    {
      user,
      operation: definition.operation,
      model: OPENAI_MODEL,
      instructions: definition.instructions,
      input,
      responseFormatName: definition.responseFormatName,
      responseSchema: definition.responseSchema,
      promptTemplateKey: definition.promptTemplateKey,
      appId: record.appId,
      recordId: record.id,
      metadata: {
        appCode,
        tableCode,
        action,
      },
    },
    client
  );

  const parsed = parseJsonOutput(response.outputText, action);
  return toExecutionResult(action, parsed, response);
}

export { OPENAI_MODEL as RUNTIME_AI_MODEL };
