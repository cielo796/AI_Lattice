import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasPermission, requirePermission } from "@/server/admin/rbac";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

const user = {
  id: "user_1",
  tenantId: "tenant_1",
};

describe("RBAC permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows tenant-wide wildcard roles", async () => {
    getPrismaClient.mockReturnValue({
      userRole: {
        findMany: vi.fn().mockResolvedValue([
          {
            appId: null,
            tableId: null,
            role: { roleType: "tenant_admin", permissionsJson: ["*"] },
          },
        ]),
      },
    });

    await expect(hasPermission(user, "admin:roles")).resolves.toBe(true);
  });

  it("honors app scoped role assignments", async () => {
    getPrismaClient.mockReturnValue({
      userRole: {
        findMany: vi.fn().mockResolvedValue([
          {
            appId: "app_1",
            tableId: null,
            role: { roleType: "app_admin", permissionsJson: ["app:write"] },
          },
        ]),
      },
    });

    await expect(
      hasPermission(user, "app:write", { appId: "app_1" })
    ).resolves.toBe(true);
    await expect(
      hasPermission(user, "app:write", { appId: "app_2" })
    ).resolves.toBe(false);
  });

  it("rejects missing permissions", async () => {
    getPrismaClient.mockReturnValue({
      userRole: {
        findMany: vi.fn().mockResolvedValue([
          {
            appId: null,
            tableId: null,
            role: { roleType: "viewer", permissionsJson: ["app:read"] },
          },
        ]),
      },
    });

    await expect(requirePermission(user, "admin:tenant")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("honors table scoped role assignments", async () => {
    getPrismaClient.mockReturnValue({
      userRole: {
        findMany: vi.fn().mockResolvedValue([
          {
            appId: "app_1",
            tableId: "table_1",
            role: { roleType: "user", permissionsJson: ["record:write"] },
          },
        ]),
      },
    });

    await expect(
      hasPermission(user, "record:write", { appId: "app_1", tableId: "table_1" })
    ).resolves.toBe(true);
    await expect(
      hasPermission(user, "record:write", { appId: "app_1", tableId: "table_2" })
    ).resolves.toBe(false);
  });
});
