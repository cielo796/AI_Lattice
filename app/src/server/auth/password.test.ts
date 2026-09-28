import { beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword } from "@/server/auth/password";
import type { User } from "@/types/user";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), verifyPassword: vi.fn(), hashPassword: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/auth/crypto", () => ({ verifyPassword: mocks.verifyPassword, hashPassword: mocks.hashPassword }));

const user: User = { id: "user-1", tenantId: "tenant-1", name: "User", email: "user@example.com", status: "active", createdAt: new Date().toISOString() };
const input = { currentPassword: "old-test-password", newPassword: "new-test-password" };

function database() {
  const transaction = {
    user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    ...transaction,
    user: { ...transaction.user, findFirst: vi.fn().mockResolvedValue({ passwordHash: "old-hash" }) },
    $transaction: vi.fn(async (callback) => callback(transaction)),
  };
}

describe("password changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("new-hash");
    mocks.getPrismaClient.mockReturnValue(database());
  });

  it("changes only the caller's password and revokes all their sessions atomically", async () => {
    const prisma = database();
    mocks.getPrismaClient.mockReturnValue(prisma);
    await changePassword(user, input);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: user.id, tenantId: user.tenantId, passwordHash: "old-hash", status: "active" },
      data: { passwordHash: "new-hash" },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id, tenantId: user.tenantId } });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(input.newPassword);
  });

  it("does not modify the account when the current password is wrong", async () => {
    const prisma = database();
    mocks.getPrismaClient.mockReturnValue(prisma);
    mocks.verifyPassword.mockResolvedValue(false);
    await expect(changePassword(user, input)).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects concurrent credential changes without revoking unrelated sessions", async () => {
    const prisma = database();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    mocks.getPrismaClient.mockReturnValue(prisma);
    await expect(changePassword(user, input)).rejects.toMatchObject({ status: 409 });
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    { currentPassword: 42 }, { currentPassword: "" },
    { newPassword: "short" }, { newPassword: input.currentPassword },
  ])("rejects invalid credentials without database access", async (invalid) => {
    await expect(changePassword(user, { ...input, ...invalid })).rejects.toMatchObject({ status: 400 });
    expect(mocks.getPrismaClient).not.toHaveBeenCalled();
  });
});
