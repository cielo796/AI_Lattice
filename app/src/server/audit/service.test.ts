import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAuditFailureResult,
  listAuditLogsForUser,
  recordAuditFailure,
  recordAuditLog,
} from "@/server/audit/service";
import type { User } from "@/types/user";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

describe("audit service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an audit log for a user action", async () => {
    const createdAt = new Date("2026-04-24T00:00:00.000Z");
    const prisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: "log_1",
          tenantId: "tenant_1",
          actorId: "user_1",
          actorName: "Owner",
          actionType: "APP_CREATE",
          resourceType: "app",
          resourceId: "app_1",
          resourceName: "Support Desk",
          detailJson: { code: "support-desk" },
          ipAddress: null,
          userAgent: null,
          result: "success",
          aiInvolvement: "none",
          createdAt,
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const log = await recordAuditLog(user, {
      actionType: "APP_CREATE",
      resourceType: "app",
      resourceId: "app_1",
      resourceName: "Support Desk",
      detailJson: { code: "support-desk", ignored: undefined },
    });

    expect(log).toEqual({
      id: "log_1",
      tenantId: "tenant_1",
      actorId: "user_1",
      actorName: "Owner",
      actionType: "APP_CREATE",
      resourceType: "app",
      resourceId: "app_1",
      resourceName: "Support Desk",
      detailJson: { code: "support-desk" },
      result: "success",
      aiInvolvement: "none",
      createdAt: createdAt.toISOString(),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant_1",
        actorId: "user_1",
        actorName: "Owner",
        actionType: "APP_CREATE",
        resourceType: "app",
        detailJson: { code: "support-desk" },
      }),
    });
  });

  it("lists audit logs scoped to the user's tenant", async () => {
    const prisma = {
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const logs = await listAuditLogsForUser(user, {
      limit: 25,
      actionType: "RECORD_UPDATE",
      resourceType: "record",
    });

    expect(logs).toEqual([]);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant_1",
        actionType: "RECORD_UPDATE",
        resourceType: "record",
      },
      orderBy: [{ createdAt: "desc" }],
      take: 25,
    });
  });

  it("records denied and error outcomes for failed operations", async () => {
    const createdAt = new Date("2026-04-24T01:00:00.000Z");
    const prisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({
          id: "log_denied",
          tenantId: "tenant_1",
          actorId: "user_1",
          actorName: "Owner",
          actionType: "AUTH_LOGIN",
          resourceType: "auth",
          resourceId: "user_1",
          resourceName: "owner@example.com",
          detailJson: {
            failure: {
              status: 401,
              name: "Error",
              message: "Invalid credentials",
            },
          },
          ipAddress: null,
          userAgent: null,
          result: "denied",
          aiInvolvement: "none",
          createdAt,
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const deniedError = Object.assign(new Error("Invalid credentials"), {
      status: 401,
    });
    const log = await recordAuditFailure(
      user,
      {
        actionType: "AUTH_LOGIN",
        resourceType: "auth",
        resourceId: user.id,
        resourceName: user.email,
      },
      deniedError
    );

    expect(getAuditFailureResult(deniedError)).toBe("denied");
    expect(getAuditFailureResult(new Error("Boom"))).toBe("error");
    expect(log?.result).toBe("denied");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        result: "denied",
        detailJson: {
          failure: {
            status: 401,
            name: "Error",
            message: "Invalid credentials",
          },
        },
      }),
    });
  });
});
