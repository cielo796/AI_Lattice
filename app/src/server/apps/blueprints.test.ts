import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppsServiceError } from "@/server/apps/service";
import {
  createAppFromBlueprint,
  generateBlueprintFromPrompt,
  normalizeGeneratedAppBlueprint,
} from "@/server/apps/blueprints";

vi.mock("@/server/apps/bootstrap", () => ({
  ensureDemoBuilderData: vi.fn().mockResolvedValue(undefined),
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
    expect(tx.appField.create).toHaveBeenCalledTimes(2);
    expect(createdApp.id).toBe("app-new");
    expect(createdApp.primaryTableCode).toBe("tickets");
    expect(createdApp.tableCount).toBe(1);
  });
});
