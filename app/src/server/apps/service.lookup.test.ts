import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAppByCodeForUser } from "@/server/apps/service";
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

describe("apps service lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets an app summary by code for runtime sidebar recovery", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({
          id: "app_1",
          tenantId: "tenant_1",
          name: "経営計画KPI管理アプリ",
          code: "keiei-keikaku-kpi",
          description: "KPI planning app",
          status: "draft",
          icon: "auto_awesome",
          createdById: "user_1",
          createdAt: new Date("2026-04-24T00:00:00.000Z"),
          updatedAt: new Date("2026-04-25T00:00:00.000Z"),
          tables: [{ code: "kpi-master" }],
          _count: { tables: 2 },
        }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const app = await getAppByCodeForUser(user, "keiei-keikaku-kpi");

    expect(app).toEqual(
      expect.objectContaining({
        id: "app_1",
        name: "経営計画KPI管理アプリ",
        code: "keiei-keikaku-kpi",
        primaryTableCode: "kpi-master",
        tableCount: 2,
      })
    );
    expect(prisma.app.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant_1",
          code: "keiei-keikaku-kpi",
        },
      })
    );
  });

  it("returns 404 when the app code does not belong to the tenant", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    await expect(getAppByCodeForUser(user, "missing-app")).rejects.toMatchObject({
      status: 404,
      message: "アプリが見つかりません",
    });
  });
});
