import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveActivePromptTemplateVersion } from "@/server/admin/prompt-templates";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

describe("prompt template active version resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the active version for an operation and key", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "ptv_1",
      version: 3,
      modelName: "gpt-5-mini",
      instructions: "Use tenant prompt",
      responseSchemaJson: { type: "object" },
      promptTemplate: {
        key: "record.summarize.default",
        name: "Record Summary",
        operation: "record.summarize",
      },
    });
    getPrismaClient.mockReturnValue({
      promptTemplateVersion: { findFirst },
    });

    await expect(
      resolveActivePromptTemplateVersion(
        { tenantId: "tenant_1" },
        {
          operation: "record.summarize",
          key: "record.summarize.default",
        }
      )
    ).resolves.toEqual({
      id: "ptv_1",
      key: "record.summarize.default",
      name: "Record Summary",
      operation: "record.summarize",
      version: 3,
      modelName: "gpt-5-mini",
      instructions: "Use tenant prompt",
      responseSchemaJson: { type: "object" },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant_1",
          isActive: true,
        }),
      })
    );
  });

  it("returns null when no active version exists", async () => {
    getPrismaClient.mockReturnValue({
      promptTemplateVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      resolveActivePromptTemplateVersion(
        { tenantId: "tenant_1" },
        { operation: "record.reply_draft" }
      )
    ).resolves.toBeNull();
  });
});

