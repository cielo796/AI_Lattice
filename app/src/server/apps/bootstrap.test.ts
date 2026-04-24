import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockApps } from "@/data/mock-apps";
import { mockFields, mockTables } from "@/data/mock-tables";

const { ensureDemoAuthData, getPrismaClient } = vi.hoisted(() => ({
  ensureDemoAuthData: vi.fn(),
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/auth/bootstrap", () => ({
  ensureDemoAuthData,
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

async function loadBootstrap() {
  vi.resetModules();
  return import("@/server/apps/bootstrap");
}

describe("ensureDemoBuilderData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEMO_AUTO_SEED;
    ensureDemoAuthData.mockResolvedValue(undefined);
  });

  it("skips demo builder seed when auto seed is disabled", async () => {
    process.env.DEMO_AUTO_SEED = "false";

    const { ensureDemoBuilderData } = await loadBootstrap();
    await ensureDemoBuilderData();

    expect(ensureDemoAuthData).not.toHaveBeenCalled();
    expect(getPrismaClient).not.toHaveBeenCalled();
  });

  it("does not recreate deleted demo apps when the tenant already has apps", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue({ id: "app-001" }),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      appTable: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      appField: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const { ensureDemoBuilderData } = await loadBootstrap();
    await ensureDemoBuilderData();

    expect(prisma.app.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "t-001" },
      select: { id: true },
    });
    expect(prisma.app.create).not.toHaveBeenCalled();
    expect(prisma.appTable.create).not.toHaveBeenCalled();
    expect(prisma.appField.create).not.toHaveBeenCalled();
  });

  it("seeds demo builder data when the demo tenant has no apps", async () => {
    const prisma = {
      app: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "app" }),
      },
      appTable: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "table" }),
      },
      appField: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "field" }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const { ensureDemoBuilderData } = await loadBootstrap();
    await ensureDemoBuilderData();

    expect(prisma.app.create).toHaveBeenCalledTimes(mockApps.length);
    expect(prisma.appTable.create).toHaveBeenCalledTimes(mockTables.length);
    expect(prisma.appField.create).toHaveBeenCalledTimes(mockFields.length);
  });
});
