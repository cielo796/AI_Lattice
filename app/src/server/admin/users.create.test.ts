import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUserForAdmin } from "@/server/admin/users";
import type { User } from "@/types/user";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), hashPassword: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/auth/crypto", () => ({ hashPassword: mocks.hashPassword }));

const admin: User = { id: "admin-1", tenantId: "tenant-1", name: "Admin", email: "admin@example.com", status: "active", createdAt: new Date().toISOString() };
const input = { name: "Member", email: " MEMBER@EXAMPLE.COM ", password: "initial-test-password", roleId: "role-viewer" };

function database(permissions = ["*"]) {
  const transaction = {
    user: { create: vi.fn().mockResolvedValue({ id: "new-user", tenantId: admin.tenantId, name: input.name, email: "member@example.com", passwordHash: "hashed", status: "active", avatarUrl: null, lastLoginAt: null, createdAt: new Date(), _count: { createdApps: 0, createdRecords: 0 } }) },
    userRole: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    ...transaction,
    userRole: { ...transaction.userRole, findMany: vi.fn().mockResolvedValue([{ appId: null, tableId: null, role: { permissionsJson: permissions } }]) },
    role: { findFirst: vi.fn().mockResolvedValue({ id: input.roleId }) },
    $transaction: vi.fn(async (callback) => callback(transaction)),
  };
}

describe("admin user creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue("hashed");
  });

  it("creates a user with the selected tenant-local role and returns no credentials", async () => {
    const prisma = database();
    mocks.getPrismaClient.mockReturnValue(prisma);
    const result = await createUserForAdmin(admin, input);
    expect(result).toMatchObject({ id: "new-user", email: "member@example.com" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(prisma.role.findFirst).toHaveBeenCalledWith({ where: { id: input.roleId, tenantId: admin.tenantId } });
    expect(prisma.userRole.create).toHaveBeenCalledWith({ data: { tenantId: admin.tenantId, userId: "new-user", roleId: input.roleId, createdById: admin.id } });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(input.password);
  });

  it.each([["app:read"], ["admin:users"], ["admin:roles"]])("requires both user and role administration (%j)", async (permission) => {
    const prisma = database([permission]);
    mocks.getPrismaClient.mockReturnValue(prisma);
    await expect(createUserForAdmin(admin, input)).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a role belonging to another tenant", async () => {
    const prisma = database();
    prisma.role.findFirst.mockResolvedValue(null as never);
    mocks.getPrismaClient.mockReturnValue(prisma);
    await expect(createUserForAdmin(admin, input)).rejects.toMatchObject({ status: 404 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reports a duplicate email without exposing the database error", async () => {
    const prisma = database();
    prisma.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "7" }));
    mocks.getPrismaClient.mockReturnValue(prisma);
    await expect(createUserForAdmin(admin, input)).rejects.toMatchObject({ status: 409 });
  });
});
