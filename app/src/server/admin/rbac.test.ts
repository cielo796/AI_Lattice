import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureDefaultRolesForTenant, getPermissionMap, hasPermission, PERMISSIONS, requirePermission } from "@/server/admin/rbac";

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

  it("loads all permissions in one tenant-scoped lookup", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { appId: null, tableId: null, role: { permissionsJson: ["app:read"] } },
      { appId: "app_1", tableId: "table_1", role: { permissionsJson: ["record:write"] } },
    ]);
    getPrismaClient.mockReturnValue({ userRole: { findMany } });
    const permissions = await getPermissionMap(user, { appId: "app_1", tableId: "table_1" });
    expect(Object.keys(permissions)).toEqual(PERMISSIONS);
    expect(permissions).toMatchObject({ "app:read": true, "record:write": true, "admin:roles": false });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: user.tenantId, userId: user.id, role: { tenantId: user.tenantId } },
    }));
  });

  it("does not reuse permissions after roles change or across users", async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([{ appId: null, tableId: null, role: { permissionsJson: ["*"] } }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    getPrismaClient.mockReturnValue({ userRole: { findMany } });
    expect(Object.values(await getPermissionMap(user)).every(Boolean)).toBe(true);
    expect(Object.values(await getPermissionMap(user)).every((value) => !value)).toBe(true);
    const otherUser = { id: "user_2", tenantId: "tenant_2" };
    expect(Object.values(await getPermissionMap(otherUser)).every((value) => !value)).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { tenantId: otherUser.tenantId, userId: otherUser.id, role: { tenantId: otherUser.tenantId } },
    }));
  });

  it("limits wildcard grants to the matching app and table", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { appId: "app_1", tableId: "table_1", role: { permissionsJson: ["*"] } },
    ]);
    getPrismaClient.mockReturnValue({ userRole: { findMany } });
    expect(Object.values(await getPermissionMap(user)).every((value) => !value)).toBe(true);
    expect(Object.values(await getPermissionMap(user, { appId: "app_1", tableId: "table_2" })).every((value) => !value)).toBe(true);
    expect(Object.values(await getPermissionMap(user, { appId: "app_1", tableId: "table_1" })).every(Boolean)).toBe(true);
  });

  it("matches individual permission checks for mixed grants in every scope", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { appId: null, tableId: null, role: { permissionsJson: ["app:read"] } },
      { appId: "app_1", tableId: null, role: { permissionsJson: ["record:read", "record:write"] } },
      { appId: "app_1", tableId: "table_1", role: { permissionsJson: ["*"] } },
      { appId: "app_2", tableId: null, role: { permissionsJson: null } },
    ]);
    getPrismaClient.mockReturnValue({ userRole: { findMany } });
    for (const scope of [undefined, { appId: "app_1" }, { appId: "app_1", tableId: "table_1" }, { appId: "app_1", tableId: "table_2" }, { appId: "app_2" }]) {
      const map = await getPermissionMap(user, scope);
      for (const permission of PERMISSIONS) {
        expect(map[permission]).toBe(await hasPermission(user, permission, scope));
      }
    }
  });

  it("fails closed for malformed permissions and database errors", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { appId: null, tableId: null, role: { permissionsJson: { permission: "*" } } },
    ]);
    getPrismaClient.mockReturnValue({ userRole: { findMany } });
    expect(Object.values(await getPermissionMap(user)).every((value) => !value)).toBe(true);
    findMany.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(getPermissionMap(user)).rejects.toThrow("Database unavailable");
  });

  it("does not grant access when the authorization database is unavailable", async () => {
    getPrismaClient.mockReturnValue({});
    await expect(hasPermission(user, "admin:roles")).rejects.toThrow();
  });

  it("preserves administrator changes when initializing default roles", async () => {
    const upsert = vi.fn();
    getPrismaClient.mockReturnValue({ role: { upsert } });
    await ensureDefaultRolesForTenant(user.tenantId);
    expect(upsert).toHaveBeenCalled();
    for (const [operation] of upsert.mock.calls) expect(operation.update).toEqual({});
  });

  it("denies users without assigned roles and scopes the role lookup to their tenant", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    getPrismaClient.mockReturnValue({ userRole: { findMany } });
    await expect(hasPermission(user, "record:read")).resolves.toBe(false);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: user.tenantId, userId: user.id, role: { tenantId: user.tenantId } },
    }));
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
