import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listAppVersionsForUser,
  publishAppForUser,
} from "@/server/apps/publish";
import type { User } from "@/types/user";
import { recordAuditLog } from "@/server/audit/service";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient: () => ({
    userRole: {
      findMany: vi.fn().mockResolvedValue([{
        appId: null,
        tableId: null,
        role: { roleType: "tenant_admin", permissionsJson: ["*"] },
      }]),
    },
    ...getPrismaClient(),
  }),
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

const app = {
  id: "app_1",
  tenantId: "tenant_1",
  name: "Support Desk",
  code: "support-desk",
};

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const createdVersion = {
    id: "ver_1",
    tenantId: "tenant_1",
    appId: "app_1",
    versionNo: 1,
    metadataJson: { tables: [{}], views: [], workflows: [] },
    publishedAt: new Date("2026-06-10T00:00:00Z"),
    createdAt: new Date("2026-06-10T00:00:00Z"),
    publishedBy: { name: "Owner", email: "owner@example.com" },
  };

  const prisma = {
    app: {
      findFirst: vi.fn().mockResolvedValue(app),
      update: vi.fn().mockResolvedValue({ ...app, status: "published" }),
    },
    appTable: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: "table_1", name: "Tickets", code: "tickets", sortOrder: 0 },
        ]),
    },
    appField: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "field_1",
          tableId: "table_1",
          name: "Subject",
          code: "subject",
          fieldType: "text",
          required: true,
          uniqueFlag: false,
          defaultValue: null,
          settingsJson: null,
          sortOrder: 0,
        },
      ]),
    },
    appView: { findMany: vi.fn().mockResolvedValue([]) },
    appForm: { findMany: vi.fn().mockResolvedValue([]) },
    workflow: { findMany: vi.fn().mockResolvedValue([]) },
    appVersion: {
      aggregate: vi.fn().mockResolvedValue({ _max: { versionNo: 2 } }),
      create: vi.fn().mockResolvedValue({ ...createdVersion, versionNo: 3 }),
      findMany: vi.fn().mockResolvedValue([createdVersion]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: app.id }]),
    $transaction: vi.fn(),
    ...overrides,
  };
  prisma.$transaction.mockImplementation(async (operation) => operation(prisma));
  return prisma;
}

describe("publishAppForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the next version and marks the app published", async () => {
    const prisma = buildPrisma();
    getPrismaClient.mockReturnValue(prisma);

    const version = await publishAppForUser(user, "app_1");

    expect(version.versionNo).toBe(3);
    expect(prisma.appVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant_1",
          appId: "app_1",
          versionNo: 3,
          publishedById: "user_1",
        }),
      })
    );
    expect(prisma.app.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "published" },
      })
    );
    expect(prisma.appVersion.aggregate).toHaveBeenCalledWith({
      where: { tenantId: user.tenantId, appId: app.id },
      _max: { versionNo: true },
    });
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.appVersion.aggregate.mock.invocationCallOrder[0]
    );
    expect(recordAuditLog).toHaveBeenCalledWith(user, expect.objectContaining({
      actionType: "APP_PUBLISH",
    }), prisma);
  });

  it("rejects an app deleted before acquiring the publication lock", async () => {
    const prisma = buildPrisma({ $queryRaw: vi.fn().mockResolvedValue([]) });
    getPrismaClient.mockReturnValue(prisma);
    await expect(publishAppForUser(user, app.id)).rejects.toMatchObject({ status: 404 });
    expect(prisma.appVersion.create).not.toHaveBeenCalled();
  });

  it("propagates audit failure inside the publication transaction", async () => {
    const prisma = buildPrisma();
    getPrismaClient.mockReturnValue(prisma);
    vi.mocked(recordAuditLog).mockRejectedValueOnce(new Error("Audit unavailable"));
    await expect(publishAppForUser(user, app.id)).rejects.toThrow("Audit unavailable");
    expect(recordAuditLog).toHaveBeenCalledWith(user, expect.anything(), prisma);
  });

  it("rejects publishing an app without tables", async () => {
    const prisma = buildPrisma({
      appTable: { findMany: vi.fn().mockResolvedValue([]) },
    });
    getPrismaClient.mockReturnValue(prisma);

    await expect(publishAppForUser(user, "app_1")).rejects.toMatchObject({
      status: 400,
    });
    expect(prisma.appVersion.create).not.toHaveBeenCalled();
  });

  it("rejects publishing an app outside the tenant", async () => {
    const prisma = buildPrisma({
      app: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    });
    getPrismaClient.mockReturnValue(prisma);

    await expect(publishAppForUser(user, "app_x")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("listAppVersionsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns version summaries with publisher names", async () => {
    const prisma = buildPrisma();
    getPrismaClient.mockReturnValue(prisma);

    const versions = await listAppVersionsForUser(user, "app_1");

    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      versionNo: 1,
      publishedByName: "Owner",
      tableCount: 1,
      viewCount: 0,
      workflowCount: 0,
    });
  });
});
