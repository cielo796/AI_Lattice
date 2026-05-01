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

vi.mock("@/server/audit/service", () => ({
  recordAuditLog: vi.fn(),
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

const customerReferenceField = {
  code: "customer",
  name: "Customer",
  fieldType: "master_ref",
  required: false,
  uniqueFlag: false,
  defaultValue: null,
  settingsJson: {
    referenceTableId: "tbl_customers",
    referenceTableCode: "customers",
  },
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
            ...customerReferenceField,
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
            ...customerReferenceField,
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
            fieldType: "master_ref",
            required: false,
            uniqueFlag: false,
            defaultValue: null,
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

describe("records service schema validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies default values before creating a record", async () => {
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
            code: "subject",
            name: "Subject",
            fieldType: "text",
            required: true,
            uniqueFlag: false,
            defaultValue: null,
            settingsJson: null,
          },
          {
            code: "priority",
            name: "Priority",
            fieldType: "select",
            required: false,
            uniqueFlag: false,
            defaultValue: "Medium",
            settingsJson: { options: ["Low", "Medium", "High"] },
          },
          {
            code: "score",
            name: "Score",
            fieldType: "number",
            required: false,
            uniqueFlag: false,
            defaultValue: 10,
            settingsJson: null,
          },
        ]),
      },
      appRecord: {
        create: vi.fn().mockResolvedValue({
          id: "rec_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          status: "active",
          dataJson: {
            subject: "Defaulted ticket",
            priority: "Medium",
            score: 10,
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
        subject: "Defaulted ticket",
      },
    });

    expect(record.data).toEqual({
      subject: "Defaulted ticket",
      priority: "Medium",
      score: 10,
    });
    expect(prisma.appRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dataJson: {
            subject: "Defaulted ticket",
            priority: "Medium",
            score: 10,
          },
        }),
      })
    );
  });

  it("rejects missing required fields", async () => {
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
            code: "subject",
            name: "Subject",
            fieldType: "text",
            required: true,
            uniqueFlag: false,
            defaultValue: null,
            settingsJson: null,
          },
        ]),
      },
      appRecord: {
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createRecordForTable(user, "support-desk", "tickets", {
        status: "active",
        data: {},
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Field "Subject" is required',
    });

    expect(prisma.appRecord.create).not.toHaveBeenCalled();
  });

  it("rejects invalid select values", async () => {
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
            code: "priority",
            name: "Priority",
            fieldType: "select",
            required: true,
            uniqueFlag: false,
            defaultValue: null,
            settingsJson: { options: ["Low", "High"] },
          },
          {
            code: "score",
            name: "Score",
            fieldType: "number",
            required: false,
            uniqueFlag: false,
            defaultValue: null,
            settingsJson: null,
          },
        ]),
      },
      appRecord: {
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createRecordForTable(user, "support-desk", "tickets", {
        status: "active",
        data: {
          priority: "Medium",
          score: "10",
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Field "Priority" must be one of: Low, High',
    });

    expect(prisma.appRecord.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate unique field values", async () => {
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
            code: "ticket_id",
            name: "Ticket ID",
            fieldType: "text",
            required: true,
            uniqueFlag: true,
            defaultValue: null,
            settingsJson: null,
          },
        ]),
      },
      appRecord: {
        findFirst: vi.fn().mockResolvedValue({ id: "rec_existing" }),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createRecordForTable(user, "support-desk", "tickets", {
        status: "active",
        data: {
          ticket_id: "TCK-001",
        },
      })
    ).rejects.toMatchObject({
      status: 409,
      message: 'Field "Ticket ID" must be unique',
    });

    expect(prisma.appRecord.create).not.toHaveBeenCalled();
    expect(prisma.appRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dataJson: {
            path: ["ticket_id"],
            equals: "TCK-001",
          },
        }),
      })
    );
  });

  it("excludes the current record from unique checks during update", async () => {
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
            code: "ticket_id",
            name: "Ticket ID",
            fieldType: "text",
            required: true,
            uniqueFlag: true,
            defaultValue: null,
            settingsJson: null,
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
              ticket_id: "TCK-001",
            },
            createdById: "user_1",
            updatedById: "user_1",
            createdAt: new Date("2026-04-24T00:00:00.000Z"),
            updatedAt: new Date("2026-04-24T00:00:00.000Z"),
            deletedAt: null,
          })
          .mockResolvedValueOnce(null),
        update: vi.fn().mockResolvedValue({
          id: "rec_1",
          tenantId: "tenant_1",
          appId: "app_1",
          tableId: "tbl_tickets",
          status: "active",
          dataJson: {
            ticket_id: "TCK-001",
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
          ticket_id: "TCK-001",
        },
      }
    );

    expect(record.data.ticket_id).toBe("TCK-001");
    expect(prisma.appRecord.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { id: "rec_1" },
          dataJson: {
            path: ["ticket_id"],
            equals: "TCK-001",
          },
        }),
      })
    );
  });
});
