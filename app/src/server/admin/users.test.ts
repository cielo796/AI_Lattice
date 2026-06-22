import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listUsersForAdmin,
  updateUserStatusForAdmin,
} from "@/server/admin/users";
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

vi.mock("@/server/auth/bootstrap", () => ({
  ensureDemoAuthData: vi.fn().mockResolvedValue(undefined),
}));

const admin: User = {
  id: "user_admin",
  tenantId: "tenant_1",
  email: "admin@example.com",
  name: "Admin",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

const dbUser = {
  id: "user_2",
  tenantId: "tenant_1",
  email: "member@example.com",
  name: "Member",
  avatarUrl: null,
  status: "active" as const,
  lastLoginAt: new Date("2026-06-09T00:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  _count: { createdApps: 2, createdRecords: 5 },
};

describe("listUsersForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tenant users with usage counts", async () => {
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([dbUser]) },
    };
    getPrismaClient.mockReturnValue(prisma);

    const users = await listUsersForAdmin(admin);

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: "user_2",
      email: "member@example.com",
      status: "active",
      appCount: 2,
      recordCount: 5,
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant_1" },
      })
    );
  });
});

describe("updateUserStatusForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivates a user and clears their sessions", async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(dbUser),
        update: vi
          .fn()
          .mockResolvedValue({ ...dbUser, status: "inactive" as const }),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    getPrismaClient.mockReturnValue(prisma);

    const updated = await updateUserStatusForAdmin(admin, "user_2", "inactive");

    expect(updated.status).toBe("inactive");
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_2" },
    });
  });

  it("rejects self-deactivation", async () => {
    getPrismaClient.mockReturnValue({});

    await expect(
      updateUserStatusForAdmin(admin, admin.id, "inactive")
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects users outside the tenant", async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
    };
    getPrismaClient.mockReturnValue(prisma);

    await expect(
      updateUserStatusForAdmin(admin, "user_x", "inactive")
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
