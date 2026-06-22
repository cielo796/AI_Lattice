import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppsServiceError } from "@/server/apps/service";
import {
  buildRecordContext,
  executeRuntimeAIAction,
  isRuntimeAIAction,
} from "@/server/ai/runtime-ai";

vi.mock("@/server/apps/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/apps/service")>();
  return {
    ...original,
    getAppByCodeForUser: vi.fn().mockResolvedValue({
      id: "app-001",
      name: "サポートデスク",
      code: "support-desk",
    }),
  };
});

vi.mock("@/server/records/service", () => ({
  getRecordForTable: vi.fn().mockResolvedValue({
    id: "rec-001",
    appId: "app-001",
    tableId: "table-001",
    recordNo: 12,
    status: "open",
    data: {
      subject: "ログインできない",
      priority: "High",
    },
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-09T00:00:00Z",
  }),
  getRuntimeTableMeta: vi.fn().mockResolvedValue({
    table: { id: "table-001", name: "チケット", code: "tickets" },
    fields: [
      { code: "subject", name: "件名", fieldType: "text" },
      { code: "priority", name: "優先度", fieldType: "select" },
    ],
    views: [],
    forms: [],
  }),
  listCommentsForRecord: vi.fn().mockResolvedValue([
    {
      commentText: "再現手順を確認中です。",
      isSystem: false,
      createdAt: "2026-06-08T00:00:00Z",
    },
  ]),
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
  email: "marcus.chen@acme.com",
  name: "Marcus Chen",
  status: "active" as const,
  createdAt: "2025-01-15T00:00:00Z",
};

function createFakeClient(payload: unknown) {
  const create = vi.fn().mockResolvedValue({
    output_text: typeof payload === "string" ? payload : JSON.stringify(payload),
    usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  });

  return { client: { responses: { create } }, create };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isRuntimeAIAction", () => {
  it("accepts supported actions", () => {
    expect(isRuntimeAIAction("summarize")).toBe(true);
    expect(isRuntimeAIAction("next_actions")).toBe(true);
    expect(isRuntimeAIAction("reply_draft")).toBe(true);
  });

  it("rejects unsupported values", () => {
    expect(isRuntimeAIAction("delete_all")).toBe(false);
    expect(isRuntimeAIAction(undefined)).toBe(false);
    expect(isRuntimeAIAction(42)).toBe(false);
  });
});

describe("buildRecordContext", () => {
  it("includes app, fields, and comments", () => {
    const context = buildRecordContext({
      appName: "サポートデスク",
      tableName: "チケット",
      fields: [
        { code: "subject", name: "件名", fieldType: "text" },
        { code: "missing", name: "未入力欄", fieldType: "text" },
      ],
      record: {
        recordNo: 12,
        status: "open",
        data: { subject: "ログインできない" },
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-09T00:00:00Z",
      },
      comments: [
        {
          commentText: "確認中です。",
          isSystem: true,
          createdAt: "2026-06-08T00:00:00Z",
        },
      ],
    });

    expect(context).toContain("アプリ: サポートデスク");
    expect(context).toContain("- 件名 (subject): ログインできない");
    expect(context).toContain("- 未入力欄 (missing): (未入力)");
    expect(context).toContain("システム: 確認中です。");
  });
});

describe("executeRuntimeAIAction", () => {
  it("returns a normalized summary result", async () => {
    const { client, create } = createFakeClient({
      summary: "ログイン不具合のチケットで、現在調査中です。",
      keyPoints: ["優先度はHigh", "", "再現確認中"],
    });

    const result = await executeRuntimeAIAction(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      "summarize",
      client
    );

    expect(result.action).toBe("summarize");
    expect(result.summary).toContain("ログイン不具合");
    expect(result.keyPoints).toEqual(["優先度はHigh", "再現確認中"]);
    expect(result.usage.totalTokens).toBe(150);
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.input).toContain("サポートデスク");
    expect(params.input).toContain("件名 (subject): ログインできない");
  });

  it("normalizes next actions and clamps invalid priorities", async () => {
    const { client } = createFakeClient({
      actions: [
        { label: "一次回答を送る", description: "状況報告を送付", priority: "high" },
        { label: "エスカレーション", description: "L2へ連携", priority: "urgent" },
        { label: "", description: "ラベルなしは除外", priority: "low" },
      ],
    });

    const result = await executeRuntimeAIAction(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      "next_actions",
      client
    );

    expect(result.nextActions).toHaveLength(2);
    expect(result.nextActions?.[0].priority).toBe("high");
    expect(result.nextActions?.[1].priority).toBe("medium");
  });

  it("returns a reply draft with fallback subject", async () => {
    const { client } = createFakeClient({
      subject: "",
      body: "お問い合わせありがとうございます。現在調査を進めております。",
    });

    const result = await executeRuntimeAIAction(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      "reply_draft",
      client
    );

    expect(result.replyDraft?.subject).toBe("Re: お問い合わせの件");
    expect(result.replyDraft?.body).toContain("お問い合わせありがとうございます");
  });

  it("throws a service error for empty model output", async () => {
    const { client } = createFakeClient("");

    await expect(
      executeRuntimeAIAction(
        user,
        "support-desk",
        "tickets",
        "rec-001",
        "summarize",
        client
      )
    ).rejects.toBeInstanceOf(AppsServiceError);
  });

  it("rejects unsupported actions", async () => {
    const { client } = createFakeClient({});

    await expect(
      executeRuntimeAIAction(
        user,
        "support-desk",
        "tickets",
        "rec-001",
        "delete_all" as never,
        client
      )
    ).rejects.toBeInstanceOf(AppsServiceError);
  });
});
