import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkflowEditorContextForUser } from "./editor-context";
import type { User } from "@/types/user";

const mocks = vi.hoisted(() => ({ prisma: { app: { findFirst: vi.fn() }, appTable: { findMany: vi.fn() }, user: { findMany: vi.fn() }, appApprovalSetting: { findUnique: vi.fn() }, promptTemplate: { findMany: vi.fn() } }, requirePermission: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: () => mocks.prisma }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission: mocks.requirePermission }));
const user: User = { id: "user", tenantId: "tenant", name: "Owner", email: "owner@example.com", status: "active", createdAt: "2026-09-30" };

describe("workflow editor context isolation", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects permission denial before returning editor metadata", async () => {
    mocks.requirePermission.mockRejectedValue({ status: 403 });
    await expect(getWorkflowEditorContextForUser(user, "app")).rejects.toMatchObject({ status: 403 });
    expect(mocks.prisma.app.findFirst).not.toHaveBeenCalled();
  });
  it("rejects a foreign or missing app without listing users", async () => {
    mocks.prisma.app.findFirst.mockResolvedValue(null);
    await expect(getWorkflowEditorContextForUser(user, "foreign")).rejects.toMatchObject({ status: 404 });
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });
  it("filters every metadata collection by tenant and app", async () => {
    mocks.prisma.app.findFirst.mockResolvedValue({ id: "app" });
    mocks.prisma.appTable.findMany.mockResolvedValue([]);
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.appApprovalSetting.findUnique.mockResolvedValue(null);
    mocks.prisma.promptTemplate.findMany.mockResolvedValue([]);
    expect(await getWorkflowEditorContextForUser(user, "app")).toMatchObject({ tables: [], users: [], approvalPolicy: null });
    expect(mocks.requirePermission).toHaveBeenCalledWith(user, "workflow:read", { appId: "app" });
    expect(mocks.prisma.app.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "app", tenantId: "tenant" } }));
    expect(mocks.prisma.appTable.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant", appId: "app" } }));
    expect(mocks.prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant", status: "active" } }));
    expect(mocks.prisma.promptTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant" }) }));
  });
});
