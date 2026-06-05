import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppsServiceError } from "@/server/apps/service";
import {
  createAppFromBlueprint,
  generateBlueprintFromPrompt,
  normalizeGeneratedAppBlueprint,
  SAMPLE_RECORDS_PER_TABLE,
} from "@/server/apps/blueprints";

vi.mock("@/server/apps/bootstrap", () => ({
  ensureDemoBuilderData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/audit/service", () => ({
  recordAuditLog: vi.fn(),
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
  email: "marcus.chen@acme.com",
  name: "Marcus Chen",
  status: "active" as const,
  createdAt: "2025-01-15T00:00:00Z",
};

const validBlueprint = {
  name: "Support Desk",
  code: "support-desk",
  description: "Customer support incident tracking",
  aiInsight: "Start with tickets and customers.",
  tables: [
    {
      name: "Tickets",
      code: "tickets",
      fields: [
        {
          name: "Subject",
          code: "subject",
          fieldType: "text" as const,
          required: true,
        },
        {
          name: "Priority",
          code: "priority",
          fieldType: "select" as const,
          required: true,
          options: ["Critical", "High", "Medium", "Low"],
        },
        {
          name: "Due Date",
          code: "due_date",
          fieldType: "date" as const,
          required: false,
        },
        {
          name: "Amount",
          code: "amount",
          fieldType: "number" as const,
          required: false,
        },
      ],
    },
  ],
};

const multiTableBlueprint = {
  ...validBlueprint,
  aiInsight: "Start with tickets and a customer master.",
  tables: [
    validBlueprint.tables[0],
    {
      name: "Customers",
      code: "customers",
      fields: [
        {
          name: "Customer Name",
          code: "customer_name",
          fieldType: "text" as const,
          required: true,
        },
        {
          name: "Contact Email",
          code: "contact_email",
          fieldType: "text" as const,
          required: false,
        },
      ],
    },
  ],
};

describe("apps blueprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a normalized blueprint when OpenAI responds with valid JSON", async () => {
    const client = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify(validBlueprint),
        }),
      },
    };

    const blueprint = await generateBlueprintFromPrompt(
      "Support desk for incident triage",
      client
    );

    expect(blueprint).toEqual(validBlueprint);
    expect(client.responses.create).toHaveBeenCalledOnce();
  });

  it("keeps only the main table when OpenAI returns multiple tables", async () => {
    const client = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify(multiTableBlueprint),
        }),
      },
    };

    const blueprint = await generateBlueprintFromPrompt("営業日報アプリ", client);

    expect(blueprint.tables).toHaveLength(1);
    expect(blueprint.tables[0].code).toBe("tickets");
    expect(blueprint.aiInsight).toContain("one main table");
  });

  it("keeps only the main table even when the prompt asks for master tables", async () => {
    const client = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify(multiTableBlueprint),
        }),
      },
    };

    const blueprint = await generateBlueprintFromPrompt(
      "問い合わせテーブルと顧客マスタを別テーブルで管理するアプリ",
      client
    );

    expect(blueprint.tables).toHaveLength(1);
    expect(blueprint.tables[0].code).toBe("tickets");
    expect(blueprint.aiInsight).toContain("one main table");
  });

  it("repairs invalid blueprint data with a second OpenAI request", async () => {
    const client = {
      responses: {
        create: vi
          .fn()
          .mockResolvedValueOnce({
            output_text: JSON.stringify({
              ...validBlueprint,
              tables: [],
            }),
          })
          .mockResolvedValueOnce({
            output_text: JSON.stringify(validBlueprint),
          }),
      },
    };

    const blueprint = await generateBlueprintFromPrompt(
      "Support desk for incident triage",
      client
    );

    expect(blueprint).toEqual(validBlueprint);
    expect(client.responses.create).toHaveBeenCalledTimes(2);
  });

  it("surfaces OpenAI request timeouts without attempting blueprint repair", async () => {
    const client = {
      responses: {
        create: vi.fn().mockRejectedValue(new Error("Request timed out.")),
      },
    };

    await expect(
      generateBlueprintFromPrompt("Support desk for incident triage", client)
    ).rejects.toMatchObject({
      status: 504,
      message: expect.stringContaining("OpenAI リクエストがタイムアウト"),
    });
    expect(client.responses.create).toHaveBeenCalledOnce();
  });

  it("rejects duplicate field codes and empty tables during validation", () => {
    expect(() =>
      normalizeGeneratedAppBlueprint({
        ...validBlueprint,
        tables: [],
      })
    ).toThrowError(AppsServiceError);

    expect(() =>
      normalizeGeneratedAppBlueprint({
        ...validBlueprint,
        tables: [
          {
            ...validBlueprint.tables[0],
            fields: [
              {
                name: "Subject",
                code: "subject",
                fieldType: "text",
                required: true,
              },
              {
                name: "Subject duplicate",
                code: "subject",
                fieldType: "textarea",
                required: false,
              },
            ],
          },
        ],
      })
    ).toThrowError(/duplicate field code/i);
  });

  it("persists app, tables, and fields in a single transaction", async () => {
    const tx = {
      app: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "app-new",
          tenantId: "t-001",
          name: "Support Desk",
          code: "support-desk",
          description: "Customer support incident tracking",
          status: "draft",
          icon: "auto_awesome",
          createdById: "u-001",
          createdAt: new Date("2026-04-20T00:00:00Z"),
          updatedAt: new Date("2026-04-20T00:00:00Z"),
        }),
      },
      appTable: {
        create: vi.fn().mockResolvedValue({ id: "tbl-new" }),
      },
      appField: {
        create: vi.fn().mockResolvedValue({ id: "fld-new" }),
      },
      appView: {
        create: vi.fn().mockResolvedValue({ id: "view-new" }),
      },
      appRecord: {
        create: vi.fn().mockResolvedValue({ id: "rec-new" }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (innerTx: typeof tx) => unknown) =>
        callback(tx)
      ),
    };

    const createdApp = await createAppFromBlueprint(user, validBlueprint, prisma as never);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.app.findFirst).toHaveBeenCalledOnce();
    expect(tx.app.create).toHaveBeenCalledOnce();
    expect(tx.appTable.create).toHaveBeenCalledOnce();
    expect(tx.appField.create).toHaveBeenCalledTimes(4);
    expect(tx.appView.create).toHaveBeenCalledTimes(5);
    expect(tx.appView.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "一覧",
          viewType: "list",
          sortOrder: 0,
          settingsJson: {
            columns: ["subject", "priority", "due_date", "amount"],
          },
        }),
      })
    );
    expect(tx.appView.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "カンバン",
          viewType: "kanban",
          sortOrder: 1,
          settingsJson: expect.objectContaining({
            groupByFieldCode: "priority",
          }),
        }),
      })
    );
    expect(tx.appView.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "カレンダー",
          viewType: "calendar",
          sortOrder: 2,
          settingsJson: expect.objectContaining({
            dateFieldCode: "due_date",
          }),
        }),
      })
    );
    expect(tx.appView.create).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "チャート",
          viewType: "chart",
          sortOrder: 3,
          settingsJson: expect.objectContaining({
            groupByFieldCode: "priority",
            metricFieldCode: "amount",
          }),
        }),
      })
    );
    expect(tx.appView.create).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        data: expect.objectContaining({
          name: "KPI",
          viewType: "kpi",
          sortOrder: 4,
          settingsJson: expect.objectContaining({
            metricFieldCode: "amount",
          }),
        }),
      })
    );
    expect(tx.appRecord.create).toHaveBeenCalledTimes(SAMPLE_RECORDS_PER_TABLE);
    expect(tx.appRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appId: expect.any(String),
          tableId: expect.any(String),
          recordNo: 1,
          status: "pending",
          dataJson: expect.objectContaining({
            id: "TICKETS-001",
            subject: "交通費精算",
            priority: "Critical",
          }),
        }),
      })
    );
    expect(createdApp.id).toBe("app-new");
    expect(createdApp.primaryTableCode).toBe("tickets");
    expect(createdApp.tableCount).toBe(1);
  });
});
