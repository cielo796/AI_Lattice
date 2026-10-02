import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAIModelSettings, getTenantAIModel, saveAIModelSettings } from "@/server/ai/model-settings";
import { AppsServiceError } from "@/server/apps/service";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), requirePermission: vi.fn(), recordAuditLog: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: mocks.recordAuditLog }));

const user = { id: "admin", tenantId: "tenant-a", name: "Admin", email: "admin@example.com" };
const settings = { findUnique: vi.fn(), upsert: vi.fn() };
const transaction = { tenantAIModelSettings: settings };
const prisma = { ...transaction, $transaction: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPrismaClient.mockReturnValue(prisma);
  mocks.requirePermission.mockResolvedValue(undefined);
  mocks.recordAuditLog.mockResolvedValue(undefined);
  settings.findUnique.mockResolvedValue(null);
  settings.upsert.mockImplementation(async ({ create }) => ({ id: "settings-a", ...create }));
  prisma.$transaction.mockImplementation(async (callback) => callback(transaction));
});

describe("tenant AI model settings", () => {
  it("returns a current default and catalog without requiring an API key", async () => {
    await expect(getAIModelSettings(user)).resolves.toMatchObject({ defaultModel: "gpt-6-luna", source: "default", catalogVerifiedAt: "2026-10-02" });
    expect(mocks.requirePermission).toHaveBeenCalledWith(user, "admin:openai");
    expect(settings.findUnique).toHaveBeenCalledWith({ where: { tenantId: user.tenantId } });
  });
  it("resolves stored tenant preferences for non-admin AI execution", async () => {
    settings.findUnique.mockResolvedValue({ defaultModel: "gpt-6-astra" });
    await expect(getTenantAIModel("tenant-b")).resolves.toBe("gpt-6-astra");
    expect(settings.findUnique).toHaveBeenCalledWith({ where: { tenantId: "tenant-b" } });
    expect(mocks.requirePermission).not.toHaveBeenCalled();
  });
  it.each(["gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra", "gpt-5-mini"])("saves %s for the authenticated tenant and audits inside the same transaction", async (defaultModel) => {
    await expect(saveAIModelSettings(user, { defaultModel, tenantId: "another-tenant" })).resolves.toMatchObject({ defaultModel, source: "tenant" });
    expect(settings.upsert).toHaveBeenCalledWith({ where: { tenantId: user.tenantId }, create: { tenantId: user.tenantId, defaultModel }, update: { defaultModel } });
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(user, expect.objectContaining({ actionType: "AI_MODEL_SETTINGS_UPDATE", detailJson: { before: "gpt-6-luna", after: defaultModel } }), transaction);
  });
  it.each([null, [], "gpt-6-luna", {}, { defaultModel: null }, { defaultModel: "unknown" }])("rejects malformed input without writes", async (input) => {
    await expect(saveAIModelSettings(user, input)).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("forbids both reads and writes without admin permissions", async () => {
    mocks.requirePermission.mockRejectedValue(new AppsServiceError("Forbidden", 403));
    await expect(getAIModelSettings(user)).rejects.toMatchObject({ status: 403 });
    await expect(saveAIModelSettings(user, { defaultModel: "gpt-6-astra" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.getPrismaClient).not.toHaveBeenCalled();
  });
  it("propagates audit failures so the transaction cannot commit without its audit", async () => {
    mocks.recordAuditLog.mockRejectedValue(new Error("Audit unavailable"));
    await expect(saveAIModelSettings(user, { defaultModel: "gpt-6.1-sol" })).rejects.toThrow("Audit unavailable");
  });
});
