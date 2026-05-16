import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRuntimeTableMeta } from "@/server/records/service";
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

vi.mock("@/server/workflows/service", () => ({
  runApprovalWorkflowsForRecord: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/server/records/bootstrap", () => ({
  ensureDemoRecordData: vi.fn().mockResolvedValue(undefined),
}));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

describe("runtime metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes persisted views with table fields", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          code: "support-desk",
        }),
      },
      appTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tbl_tickets",
          tenantId: "tenant_1",
          appId: "app_1",
          code: "tickets",
          name: "Tickets",
        }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fld_subject",
            tenantId: "tenant_1",
            appId: "app_1",
            tableId: "tbl_tickets",
            name: "Subject",
            code: "subject",
            fieldType: "text",
            required: true,
            uniqueFlag: false,
            defaultValue: null,
            settingsJson: null,
            sortOrder: 0,
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
          },
        ]),
      },
      appView: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "view_open",
            tenantId: "tenant_1",
            appId: "app_1",
            tableId: "tbl_tickets",
            name: "Open tickets",
            viewType: "list",
            settingsJson: { columns: ["subject"] },
            sortOrder: 0,
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
            updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          },
        ]),
      },
      appForm: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "form_standard",
            tenantId: "tenant_1",
            appId: "app_1",
            tableId: "tbl_tickets",
            name: "Standard form",
            layoutJson: {
              fields: [{ fieldCode: "subject", visible: true, required: true }],
            },
            sortOrder: 0,
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
            updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          },
        ]),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const meta = await getRuntimeTableMeta(user, "support-desk", "tickets");

    expect(meta.table).toEqual({
      id: "tbl_tickets",
      code: "tickets",
      name: "Tickets",
    });
    expect(meta.fields).toHaveLength(1);
    expect(meta.views).toEqual([
      expect.objectContaining({
        id: "view_open",
        name: "Open tickets",
        viewType: "list",
        settingsJson: { columns: ["subject"] },
      }),
    ]);
    expect(meta.forms).toEqual([
      expect.objectContaining({
        id: "form_standard",
        name: "Standard form",
        layoutJson: {
          fields: [{ fieldCode: "subject", visible: true, required: true }],
        },
      }),
    ]);
  });
});
