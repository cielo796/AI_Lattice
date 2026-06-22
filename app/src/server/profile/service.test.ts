import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfile } from "@/server/profile/service";
import type { User } from "@/types/user";

const { getPrismaClient, recordAuditLog } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({ getPrismaClient }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog }));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "member@example.com",
  name: "Before",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("profile service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the current user and records an audit log", async () => {
    const update = vi.fn().mockResolvedValue({
      ...user,
      name: "After",
      avatarUrl: "https://example.com/avatar.png",
      lastLoginAt: null,
      createdAt: new Date(user.createdAt),
    });
    getPrismaClient.mockReturnValue({ user: { update } });

    const result = await updateProfile(user, {
      name: " After ",
      avatarUrl: "https://example.com/avatar.png",
    });

    expect(result.name).toBe("After");
    expect(update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { name: "After", avatarUrl: "https://example.com/avatar.png" },
    });
    expect(recordAuditLog).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ actionType: "PROFILE_UPDATE" })
    );
  });

  it("rejects non-http avatar URLs", async () => {
    getPrismaClient.mockReturnValue({});
    await expect(
      updateProfile(user, { name: "After", avatarUrl: "file:///avatar.png" })
    ).rejects.toMatchObject({ status: 400 });
  });
});
