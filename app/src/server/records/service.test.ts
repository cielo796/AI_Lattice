import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRecordForTable,
  listBackReferencesForRecord,
  updateRecordForTable,
} from "@/server/records/service";
import type { User } from "@/types/user";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
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

describe("records service master_ref validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects create when a referenced record does not exist", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          code: "support-desk",
        }),
      },
      appTable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "tbl_tickets",
            tenantId: "tenant_1",
            appId: "app_1",
            code: "tickets",
            name: "Tickets",
          })
          .mockResolvedValueOnce({
            id: "tbl_customers",
            code: "customers",
            name: "Customers",
          }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            code: "customer",
            name: "Customer",
            settingsJson: {
              referenceTableId: "tbl_customers",
              referenceTableCode: "customers",
            },
          },
        ]),
      },
      appRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createRecordForTable(user, "support-desk", "tickets", {
        status: "active",
        data: {
          subject: "Broken customer reference",
          customer: "customer_missing",
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Field "Customer" must reference an existing Customers record',
    });

    expect(prisma.appRecord.create).not.toHaveBeenCalled();
  });

  it("allows update when the referenced record exists", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          code: "support-desk",
        }),
      },
      appTable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "tbl_tickets",
            tenantId: "tenant_1",
            appId: "app_1",
            code: "tickets",
            name: "Tickets",
          })
          .mockResolvedValueOnce({
            id: "tbl_customers",
            code: "customers",
            name: "Customers",
          }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            code: "customer",
            name: "Customer",
            settingsJson: {
              referenceTableId: "tbl_customers",
              referenceTableCode: "customers",
            },
          },
        ]),
      },
      appRecord: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "rec_1",
            tenantId: "tenant_1",
            appId: "app_1",
            tableId: "tbl_tickets",
            status: "active",
            dataJson: {
              subject: "Old subject",
            },
            createdById: "user_1",
            updatedById: "user_1",
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
            updatedAt: new Date("2026-04-24T00:00:00.000Z"),
            deletedAt: null,
          })
          .mockResolvedValueOnce({
            id: "customer_1",
          }),
        update: vi.fn().mockResolvedValue({
          id: "rec_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          status: "active",
          dataJson: {
            subject: "Updated subject",
            customer: "customer_1",
          },
          createdById: "user_1",
          updatedById: "user_1",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T01:00:00.000Z"),
          deletedAt: null,
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const record = await updateRecordForTable(
      user,
      "support-desk",
      "tickets",
      "rec_1",
      {
        status: "active",
        data: {
          subject: "Updated subject",
          customer: "customer_1",
        },
      }
    );

    expect(record.data.customer).toBe("customer_1");
    expect(prisma.appRecord.update).toHaveBeenCalledWith({
      where: { id: "rec_1" },
      data: expect.objectContaining({
        dataJson: {
          subject: "Updated subject",
          customer: "customer_1",
        },
      }),
    });
  });

  it("allows multiple referenced records when the field is configured as multiple", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          code: "support-desk",
        }),
      },
      appTable: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: "tbl_tickets",
            tenantId: "tenant_1",
            appId: "app_1",
            code: "tickets",
            name: "Tickets",
          })
          .mockResolvedValueOnce({
            id: "tbl_customers",
            code: "customers",
            name: "Customers",
          }),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            code: "customers",
            name: "Customers",
            settingsJson: {
              referenceTableId: "tbl_customers",
              referenceTableCode: "customers",
              multiple: true,
            },
          },
        ]),
      },
      appRecord: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: "customer_1" })
          .mockResolvedValueOnce({ id: "customer_2" }),
        create: vi.fn().mockResolvedValue({
          id: "rec_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          status: "active",
          dataJson: {
            subject: "Multi customer ticket",
            customers: ["customer_1", "customer_2"],
          },
          createdById: "user_1",
          updatedById: "user_1",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          deletedAt: null,
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const record = await createRecordForTable(user, "support-desk", "tickets", {
      status: "active",
      data: {
        subject: "Multi customer ticket",
        customers: ["customer_1", "customer_2"],
      },
    });

    expect(record.data.customers).toEqual(["customer_1", "customer_2"]);
    expect(prisma.appRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataJson: {
            subject: "Multi customer ticket",
            customers: ["customer_1", "customer_2"],
          },
        }),
      })
    );
  });

  it("lists reverse references for configured master_ref fields", async () => {
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
          id: "tbl_customers",
          tenantId: "tenant_1",
          appId: "app_1",
          code: "customers",
          name: "Customers",
        }),
      },
      appRecord: {
        findFirst: vi.fn().mockResolvedValue({
          id: "customer_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_customers",
          status: "active",
          dataJson: {
            name: "ACME",
          },
          createdById: "user_1",
          updatedById: "user_1",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-24T00:00:00.000Z"),
          deletedAt: null,
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ticket_1",
            tenantId: "tenant_1",
            appId: "app_1",
            tableId: "tbl_tickets",
            status: "open",
            dataJson: {
              subject: "Follow up",
              customer: "customer_1",
            },
            createdById: "user_1",
            updatedById: "user_1",
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
            updatedAt: new Date("2026-04-24T00:00:00.000Z"),
            deletedAt: null,
          },
        ]),
      },
      appField: {
        findMany: vi.fn().mockResolvedValue([
          {
            code: "customer",
            name: "Customer",
            settingsJson: {
              referenceTableId: "tbl_customers",
              referenceTableCode: "customers",
              showBackReference: true,
            },
            table: {
              id: "tbl_tickets",
              code: "tickets",
              name: "Tickets",
            },
          },
        ]),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const groups = await listBackReferencesForRecord(
      user,
      "support-desk",
      "customers",
      "customer_1"
    );

    expect(groups).toEqual([
      expect.objectContaining({
        fieldCode: "customer",
        sourceTableCode: "tickets",
        records: [
          expect.objectContaining({
            id: "ticket_1",
          }),
        ],
      }),
    ]);
  });
});
