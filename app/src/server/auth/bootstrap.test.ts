import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/auth/crypto", () => ({ hashPassword: vi.fn().mockResolvedValue("demo-password-hash") }));
vi.mock("@/server/demo/seed-policy", () => ({ isDemoAutoSeedEnabled: () => true }));

describe("demo bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does not reactivate users, reset passwords, or restore revoked roles on restart", async () => {
    const prisma = {
      tenant: { upsert: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue({ id: "existing", passwordHash: null }), create: vi.fn(), update: vi.fn() },
      role: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: "role-1" }) },
      userRole: { findFirst: vi.fn(), create: vi.fn() },
    };
    mocks.getPrismaClient.mockReturnValue(prisma);
    const { ensureDemoAuthData } = await import("@/server/auth/bootstrap");
    await ensureDemoAuthData();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.userRole.create).not.toHaveBeenCalled();
    expect(prisma.tenant.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    for (const [operation] of prisma.role.upsert.mock.calls) expect(operation.update).toEqual({});
  });
});
