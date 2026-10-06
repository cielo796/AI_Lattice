import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDisplaySettings, updateDisplaySettings } from "./service";
import type { User } from "@/types/user";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), hasPermission: vi.fn(), requirePermission: vi.fn(), recordAuditLog: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/admin/rbac", () => ({ hasPermission: mocks.hasPermission, requirePermission: mocks.requirePermission }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: mocks.recordAuditLog }));
vi.mock("@/server/auth/session", () => ({ getCurrentSession: vi.fn() }));

const user: User = { id: "user1", tenantId: "tenant1", email: "member@example.com", name: "Member", status: "active", createdAt: "2026-10-06" };
const findFirst = vi.fn(), updateMany = vi.fn(), updateTenant = vi.fn();
describe("persisted display settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrismaClient.mockReturnValue({ user: { findFirst, updateMany }, tenant: { update: updateTenant } });
    findFirst.mockResolvedValue({ displayTheme: "dark", tenant: { defaultTheme: "navy", allowUserTheme: true } });
    updateMany.mockResolvedValue({ count: 1 });
    mocks.hasPermission.mockResolvedValue(false);
    mocks.requirePermission.mockResolvedValue(undefined);
  });
  it("reads only the authenticated tenant account and reports admin access separately", async () => {
    expect(await getDisplaySettings(user)).toEqual({ preference: "dark", defaultTheme: "navy", allowUserTheme: true, canManageTenant: false });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id, tenantId: user.tenantId } }));
  });
  it("persists a user preference with an atomic tenant-policy constraint", async () => {
    await updateDisplaySettings(user, { preference: "system" });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: user.id, tenantId: user.tenantId, tenant: { allowUserTheme: true } }, data: { displayTheme: "system" } });
    expect(updateTenant).not.toHaveBeenCalled();
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(user, expect.objectContaining({ actionType: "DISPLAY_PREFERENCE_UPDATE" }));
  });
  it("can clear a preference to inherit the tenant default", async () => {
    await updateDisplaySettings(user, { preference: null });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { displayTheme: null } }));
  });
  it("rejects user writes when policy is locked", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(updateDisplaySettings(user, { preference: "dark" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.recordAuditLog).not.toHaveBeenCalled();
  });
  it("requires tenant permission before saving policy and scopes the update to their tenant", async () => {
    await updateDisplaySettings(user, { defaultTheme: "white", allowUserTheme: false });
    expect(mocks.requirePermission).toHaveBeenCalledWith(user, "admin:tenant");
    expect(updateTenant).toHaveBeenCalledWith({ where: { id: user.tenantId }, data: { defaultTheme: "white", allowUserTheme: false } });
    expect(updateMany).not.toHaveBeenCalled();
  });
  it("does not write tenant policy on a denied permission", async () => {
    mocks.requirePermission.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
    await expect(updateDisplaySettings(user, { defaultTheme: "white" })).rejects.toMatchObject({ status: 403 });
    expect(updateTenant).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { preference: "pink" }, { defaultTheme: "dark" }, { allowUserTheme: "false" }, { preference: "dark", defaultTheme: "white" }, { userId: "other", preference: "dark" }])("rejects invalid or mixed input %j", async (input) => {
    await expect(updateDisplaySettings(user, input)).rejects.toMatchObject({ status: 400 });
    expect(updateMany).not.toHaveBeenCalled();
    expect(updateTenant).not.toHaveBeenCalled();
  });
});
