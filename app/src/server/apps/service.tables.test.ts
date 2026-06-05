import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTableForApp } from "@/server/apps/service";
import type { User } from "@/types/user";

const { getPrismaClient } = vi.hoisted(() => ({
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

vi.mock("@/server/audit/service", () => ({
  recordAuditLog: vi.fn(),
}));

vi.mock("@/server/apps/bootstrap", () => ({
  ensureDemoBuilderData: vi.fn().mockResolvedValue(undefined),
}));

const user: User = {
  id: "user_1",
  tenantId: "tenant_1",
  email: "owner@example.com",
  name: "Owner",
  status: "active",
  createdAt: "2026-04-24T00:00:00.000Z",
};

describe("apps service tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects creating a second table for an app", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          name: "Support Desk",
          code: "support-desk",
        }),
      },
      appTable: {
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(
      createTableForApp(user, "app_1", {
        name: "Customers",
        code: "customers",
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "1アプリにつきテーブルは1つまでです",
    });

    expect(prisma.appTable.create).not.toHaveBeenCalled();
    expect(prisma.appTable.findFirst).not.toHaveBeenCalled();
  });
});
