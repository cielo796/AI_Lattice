import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFieldForTable,
  deleteTableForApp,
  updateTableForApp,
} from "@/server/apps/service";
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

describe("apps service reference field support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes master_ref settings when creating a field", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
        }),
      },
      appTable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "tbl_tickets",
            tenantId: "tenant_1",
            appId: "app_1",
            name: "Tickets",
            code: "tickets",
            isSystem: false,
            sortOrder: 0,
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
          })
          .mockResolvedValueOnce({
            id: "tbl_customers",
            code: "customers",
          }),
      },
      appField: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ sortOrder: 1 }),
        findMany: vi.fn().mockResolvedValue([
          { code: "name" },
          { code: "status" },
          { code: "code" },
        ]),
        create: vi.fn().mockResolvedValue({
          id: "fld_customer",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          name: "Customer",
          code: "customer",
          fieldType: "master_ref",
          required: true,
          uniqueFlag: false,
          defaultValue: null,
          settingsJson: {
            referenceTableId: "tbl_customers",
            referenceTableCode: "customers",
            displayFieldCode: "name",
            lookupFieldCodes: ["status"],
            multiple: true,
            showBackReference: true,
          },
          sortOrder: 2,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const field = await createFieldForTable(user, "app_1", "tbl_tickets", {
      name: "Customer",
      code: "customer",
      fieldType: "master_ref",
      required: true,
      settingsJson: {
        referenceTableId: "tbl_customers",
        displayFieldCode: "name",
        lookupFieldCodes: ["status"],
        multiple: true,
        showBackReference: true,
      },
    });

    expect(field.settingsJson).toEqual({
      referenceTableId: "tbl_customers",
      referenceTableCode: "customers",
      displayFieldCode: "name",
      lookupFieldCodes: ["status"],
      multiple: true,
      showBackReference: true,
    });
    expect(prisma.appField.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settingsJson: {
            referenceTableId: "tbl_customers",
            referenceTableCode: "customers",
            displayFieldCode: "name",
            lookupFieldCodes: ["status"],
            multiple: true,
            showBackReference: true,
          },
        }),
      })
    );
  });

  it("updates referenced field settings when a table code changes", async () => {
    const tx = {
      appTable: {
        update: vi.fn().mockResolvedValue({
          id: "tbl_customers",
          tenantId: "tenant_1",
          appId: "app_1",
          name: "Customers",
          code: "accounts",
          isSystem: false,
          sortOrder: 1,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "fld_customer",
            settingsJson: {
              referenceTableId: "tbl_customers",
              referenceTableCode: "customers",
              displayFieldCode: "name",
              lookupFieldCodes: ["status"],
              multiple: true,
              showBackReference: true,
            },
          },
        ]),
        update: vi.fn().mockResolvedValue({
          id: "fld_customer",
        }),
      },
    };
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
        }),
      },
      appTable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "tbl_customers",
            tenantId: "tenant_1",
            appId: "app_1",
            name: "Customers",
            code: "customers",
            isSystem: false,
            sortOrder: 1,
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
          })
          .mockResolvedValueOnce(null),
      },
      $transaction: vi.fn(async (callback: (innerTx: typeof tx) => unknown) =>
        callback(tx)
      ),
    };

    getPrismaClient.mockReturnValue(prisma);

    const table = await updateTableForApp(user, "app_1", "tbl_customers", {
      code: "accounts",
    });

    expect(table.code).toBe("accounts");
    expect(tx.appField.update).toHaveBeenCalledWith({
      where: { id: "fld_customer" },
      data: {
        settingsJson: {
          referenceTableId: "tbl_customers",
          referenceTableCode: "accounts",
          displayFieldCode: "name",
          lookupFieldCodes: ["status"],
          multiple: true,
          showBackReference: true,
        },
      },
    });
  });

  it("blocks deletion when another field references the table", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
        }),
      },
      appTable: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tbl_customers",
          tenantId: "tenant_1",
          appId: "app_1",
          name: "Customers",
          code: "customers",
          isSystem: false,
          sortOrder: 1,
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
        }),
        delete: vi.fn(),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            name: "Customer",
            settingsJson: {
              referenceTableId: "tbl_customers",
              referenceTableCode: "customers",
            },
          },
        ]),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(deleteTableForApp(user, "app_1", "tbl_customers")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("参照フィールド"),
    });
    expect(prisma.appTable.delete).not.toHaveBeenCalled();
  });
});
