import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/auth/permissions/route";
import { ServiceError } from "@/server/errors/service-error";

const { requireAuthenticatedUser, getPermissionMap } = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getPermissionMap: vi.fn(),
}));

vi.mock("@/app/api/_helpers", async () => ({
  ...await vi.importActual<typeof import("@/app/api/_helpers")>("@/app/api/_helpers"),
  requireAuthenticatedUser,
}));
vi.mock("@/server/admin/rbac", () => ({ getPermissionMap }));

describe("permission map route", () => {
  const user = { id: "user_1", tenantId: "tenant_1" };

  beforeEach(() => {
    vi.resetAllMocks();
    requireAuthenticatedUser.mockResolvedValue(user);
  });

  it("authenticates and passes scope to a single map lookup", async () => {
    const permissions = { "app:read": true, "record:write": false };
    getPermissionMap.mockResolvedValue(permissions);
    const response = await GET(new Request("http://localhost/api/auth/permissions?appId=app_1&tableId=table_1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(permissions);
    expect(getPermissionMap).toHaveBeenCalledExactlyOnceWith(user, { appId: "app_1", tableId: "table_1" });
  });

  it("does not load permissions for unauthenticated requests", async () => {
    requireAuthenticatedUser.mockRejectedValue(new ServiceError("Authentication required", 401));
    const response = await GET(new Request("http://localhost/api/auth/permissions"));
    expect(response.status).toBe(401);
    expect(getPermissionMap).not.toHaveBeenCalled();
  });

  it("returns an error instead of granting access if the database lookup fails", async () => {
    getPermissionMap.mockRejectedValue(new Error("Database unavailable"));
    const response = await GET(new Request("http://localhost/api/auth/permissions"));
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty("app:read");
  });
});
