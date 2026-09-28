import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateUser, findUserByEmailForAudit } from "@/server/auth/service";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: () => ({ user: { findMany: mocks.findMany, update: mocks.update } }) }));
vi.mock("@/server/auth/bootstrap", () => ({ ensureDemoAuthData: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentSession: vi.fn() }));
vi.mock("@/server/auth/crypto", () => ({ verifyPassword: mocks.verifyPassword }));

const user = {
  id: "user-1", tenantId: "tenant-1", email: "admin@example.com", name: "Admin",
  avatarUrl: null, status: "active", passwordHash: "stored-hash", lastLoginAt: null, createdAt: new Date(),
};

describe("tenant-aware authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([user]);
    mocks.update.mockResolvedValue(user);
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it("authenticates a unique email and never returns the password hash", async () => {
    const result = await authenticateUser({ email: " ADMIN@EXAMPLE.COM ", password: "password" });
    expect(result?.id).toBe(user.id);
    expect(result).not.toHaveProperty("passwordHash");
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { email: user.email, status: "active", tenant: { status: "active" } }, take: 2 }));
  });

  it("requires an organization when an email exists in multiple tenants", async () => {
    mocks.findMany.mockResolvedValue([user, { ...user, id: "user-2", tenantId: "tenant-2" }]);
    await expect(authenticateUser({ email: user.email, password: "password" })).resolves.toBeNull();
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    await expect(findUserByEmailForAudit(user.email)).resolves.toBeNull();
  });

  it("limits the query to the requested active organization", async () => {
    await authenticateUser({ email: user.email, password: "password", tenantCode: " COMPANY " });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant: { code: "company", status: "active" } }) }));
  });

  it("does not update login activity on a wrong password", async () => {
    mocks.verifyPassword.mockResolvedValue(false);
    await expect(authenticateUser({ email: user.email, password: "wrong" })).resolves.toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
