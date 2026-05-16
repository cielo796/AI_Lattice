import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFormForTable } from "@/server/apps/service";
import type { User } from "@/types/user";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

vi.mock("@/server/audit/service", () => ({
  recordAuditLog: vi.fn(),
}));

vi.mock("@/server/apps/bootstrap", () => ({
  ensureDemoBuilderData: vi.fn().mockResolvedValue(undefined),
}));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

describe("apps service forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a form with validated field layout", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          name: "Support Desk",
        }),
      },
      appTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tbl_tickets",
          tenantId: "tenant_1",
          appId: "app_1",
          name: "Tickets",
          code: "tickets",
          isSystem: false,
          sortOrder: 0,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          { code: "subject", required: true, fieldType: "text" },
          { code: "description", required: false, fieldType: "textarea" },
          { code: "priority", required: false, fieldType: "select" },
        ]),
      },
      appForm: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ sortOrder: 0 }),
        create: vi.fn().mockResolvedValue({
          id: "form_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          name: "Standard form",
          layoutJson: {
            fields: [
              {
                fieldCode: "description",
                visible: true,
                required: false,
                width: "full",
                helpText: "Keep it brief",
              },
              {
                fieldCode: "subject",
                visible: true,
                required: true,
                width: "half",
              },
              {
                fieldCode: "priority",
                visible: true,
                required: false,
                width: "half",
              },
            ],
          },
          sortOrder: 1,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const form = await createFormForTable(user, "app_1", "tbl_tickets", {
      name: "Standard form",
      layoutJson: {
        fields: [
          {
            fieldCode: "description",
            visible: true,
            required: false,
            width: "full",
            helpText: " Keep it brief ",
          },
          { fieldCode: "subject", visible: false, required: false },
          { fieldCode: "description", visible: true },
        ],
      },
    });

    expect(form.layoutJson).toEqual({
      fields: [
        {
          fieldCode: "description",
          visible: true,
          required: false,
          width: "full",
          helpText: "Keep it brief",
        },
        {
          fieldCode: "subject",
          visible: true,
          required: true,
          width: "half",
        },
        {
          fieldCode: "priority",
          visible: true,
          required: false,
          width: "half",
        },
      ],
    });
    expect(prisma.appForm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          layoutJson: form.layoutJson,
          sortOrder: 1,
        }),
      })
    );
  });

  it("rejects form layout that references missing fields", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
        }),
      },
      appTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tbl_tickets",
          tenantId: "tenant_1",
          appId: "app_1",
          name: "Tickets",
          code: "tickets",
          isSystem: false,
          sortOrder: 0,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          { code: "subject", required: true, fieldType: "text" },
        ]),
      },
      appForm: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createFormForTable(user, "app_1", "tbl_tickets", {
        name: "Broken form",
        layoutJson: {
          fields: [{ fieldCode: "missing_field", visible: true }],
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("missing_field"),
    });
    expect(prisma.appForm.create).not.toHaveBeenCalled();
  });
});
