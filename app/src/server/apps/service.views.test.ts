import { beforeEach, describe, expect, it, vi } from "vitest";
import { createViewForTable } from "@/server/apps/service";
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

describe("apps service views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a list view with validated columns and sort settings", async () => {
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
          { code: "subject" },
          { code: "priority" },
          { code: "status" },
        ]),
      },
      appView: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ sortOrder: 1 }),
        create: vi.fn().mockResolvedValue({
          id: "view_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          name: "Open tickets",
          viewType: "list",
          settingsJson: {
            columns: ["subject", "priority"],
            sort: { fieldCode: "priority", direction: "desc" },
          },
          sortOrder: 2,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const view = await createViewForTable(user, "app_1", "tbl_tickets", {
      name: "Open tickets",
      viewType: "list",
      settingsJson: {
        columns: ["subject", "priority", "subject"],
        sort: { fieldCode: "priority", direction: "desc" },
      },
    });

    expect(view.settingsJson).toEqual({
      columns: ["subject", "priority"],
      sort: { fieldCode: "priority", direction: "desc" },
    });
    expect(prisma.appView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settingsJson: {
            columns: ["subject", "priority"],
            sort: { fieldCode: "priority", direction: "desc" },
          },
          sortOrder: 2,
        }),
      })
    );
  });

  it("rejects view settings that reference missing fields", async () => {
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
        findMany: vi.fn().mockResolvedValue([{ code: "subject" }]),
      },
      appView: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createViewForTable(user, "app_1", "tbl_tickets", {
        name: "Broken view",
        settingsJson: { columns: ["missing_field"] },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("missing_field"),
    });
    expect(prisma.appView.create).not.toHaveBeenCalled();
  });

  it("creates runtime views with grouping, date, and metric settings", async () => {
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
          { code: "status", fieldType: "select" },
          { code: "due_date", fieldType: "date" },
          { code: "amount", fieldType: "number" },
        ]),
      },
      appView: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ sortOrder: 0 }),
        create: vi.fn().mockResolvedValue({
          id: "view_chart",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          name: "Status chart",
          viewType: "chart",
          settingsJson: {
            columns: ["status", "amount"],
            groupByFieldCode: "status",
            dateFieldCode: "due_date",
            metricFieldCode: "amount",
          },
          sortOrder: 1,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const view = await createViewForTable(user, "app_1", "tbl_tickets", {
      name: "Status chart",
      viewType: "chart",
      settingsJson: {
        columns: ["status", "amount"],
        groupByFieldCode: "status",
        dateFieldCode: "due_date",
        metricFieldCode: "amount",
      },
    });

    expect(view.settingsJson).toEqual({
      columns: ["status", "amount"],
      groupByFieldCode: "status",
      dateFieldCode: "due_date",
      metricFieldCode: "amount",
    });
    expect(prisma.appView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          viewType: "chart",
          settingsJson: {
            columns: ["status", "amount"],
            groupByFieldCode: "status",
            dateFieldCode: "due_date",
            metricFieldCode: "amount",
          },
        }),
      })
    );
  });

  it("rejects non numeric metric fields", async () => {
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
          { code: "subject", fieldType: "text" },
        ]),
      },
      appView: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createViewForTable(user, "app_1", "tbl_tickets", {
        name: "Broken KPI",
        viewType: "kpi",
        settingsJson: { metricFieldCode: "subject" },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("指標フィールド"),
    });
    expect(prisma.appView.create).not.toHaveBeenCalled();
  });
});
