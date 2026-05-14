import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOpenAISettingsStatus,
  getTenantOpenAIApiKey,
  saveOpenAISettings,
} from "@/server/admin/openai-settings";
import { decryptSecret, encryptSecret } from "@/server/secrets/encryption";

const { getPrismaClient, recordAuditLog } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

vi.mock("@/server/audit/service", () => ({
  recordAuditLog,
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
  email: "admin@example.com",
  name: "Admin User",
};

describe("admin OpenAI settings", () => {
  let prisma: {
    tenantOpenAISettings: {
      findUnique: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/stitch";
    delete process.env.OPENAI_API_KEY;

    prisma = {
      tenantOpenAISettings: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
    };
    getPrismaClient.mockReturnValue(prisma);
    recordAuditLog.mockResolvedValue(null);
  });

  it("reports environment fallback when the tenant key is not saved", async () => {
    process.env.OPENAI_API_KEY = "sk-env-key-1234567890abcd";
    prisma.tenantOpenAISettings.findUnique.mockResolvedValue(null);

    await expect(getOpenAISettingsStatus(user)).resolves.toMatchObject({
      configured: true,
      source: "environment",
      lastFour: "abcd",
      maskedApiKey: "**** abcd",
      environmentFallbackConfigured: true,
    });
  });

  it("decrypts the tenant key for server-side OpenAI calls", async () => {
    const apiKey = "sk-tenant-key-1234567890abcd";
    prisma.tenantOpenAISettings.findUnique.mockResolvedValue({
      apiKeyEncrypted: encryptSecret(apiKey),
    });

    await expect(getTenantOpenAIApiKey(user.tenantId)).resolves.toBe(apiKey);
  });

  it("saves the tenant key encrypted and returns a masked status", async () => {
    const apiKey = "sk-tenant-key-1234567890abcd";
    const updatedAt = new Date("2026-05-14T00:00:00Z");

    prisma.tenantOpenAISettings.upsert.mockImplementation(async (input) => ({
      id: "setting-001",
      tenantId: user.tenantId,
      apiKeyEncrypted: input.create.apiKeyEncrypted,
      apiKeyLastFour: input.create.apiKeyLastFour,
      createdAt: updatedAt,
      updatedAt,
    }));
    prisma.tenantOpenAISettings.findUnique.mockResolvedValue({
      tenantId: user.tenantId,
      apiKeyLastFour: "abcd",
      updatedAt,
    });

    const status = await saveOpenAISettings(user, { apiKey });
    const upsertInput = prisma.tenantOpenAISettings.upsert.mock.calls[0][0];

    expect(decryptSecret(upsertInput.create.apiKeyEncrypted)).toBe(apiKey);
    expect(upsertInput.create.apiKeyEncrypted).not.toContain(apiKey);
    expect(upsertInput.create.apiKeyLastFour).toBe("abcd");
    expect(recordAuditLog).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        actionType: "OPENAI_API_KEY_UPDATE",
        detailJson: { source: "tenant", lastFour: "abcd" },
      })
    );
    expect(status).toMatchObject({
      configured: true,
      source: "tenant",
      maskedApiKey: "**** abcd",
    });
  });
});
