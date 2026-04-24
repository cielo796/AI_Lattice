import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAttachments,
  mockComments,
  mockRecords,
} from "@/data/mock-records";

const { ensureDemoBuilderData, getPrismaClient } = vi.hoisted(() => ({
  ensureDemoBuilderData: vi.fn(),
  getPrismaClient: vi.fn(),
}));

vi.mock("@/server/apps/bootstrap", () => ({
  ensureDemoBuilderData,
}));

vi.mock("@/server/db/prisma", () => ({
  getPrismaClient,
}));

async function loadBootstrap() {
  vi.resetModules();
  return import("@/server/records/bootstrap");
}

describe("ensureDemoRecordData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DEMO_AUTO_SEED;
    ensureDemoBuilderData.mockResolvedValue(undefined);
  });

  it("skips demo record seed when auto seed is disabled", async () => {
    process.env.DEMO_AUTO_SEED = "false";

    const { ensureDemoRecordData } = await loadBootstrap();
    await ensureDemoRecordData();

    expect(ensureDemoBuilderData).not.toHaveBeenCalled();
    expect(getPrismaClient).not.toHaveBeenCalled();
  });

  it("does not recreate deleted demo records when the tenant already has records", async () => {
    const prisma = {
      appRecord: {
        findFirst: vi.fn().mockResolvedValue({ id: "rec-001" }),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      appTable: {
        findMany: vi.fn(),
      },
      recordComment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      attachment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const { ensureDemoRecordData } = await loadBootstrap();
    await ensureDemoRecordData();

    expect(prisma.appRecord.create).not.toHaveBeenCalled();
    expect(prisma.recordComment.create).not.toHaveBeenCalled();
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("skips record seed when the parent demo table was deleted", async () => {
    const prisma = {
      appRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      appTable: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      recordComment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      attachment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const { ensureDemoRecordData } = await loadBootstrap();
    await ensureDemoRecordData();

    expect(prisma.appRecord.findUnique).not.toHaveBeenCalled();
    expect(prisma.appRecord.create).not.toHaveBeenCalled();
    expect(prisma.recordComment.create).not.toHaveBeenCalled();
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it("seeds demo records when the parent demo table exists", async () => {
    const prisma = {
      appRecord: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "record" }),
      },
      appTable: {
        findMany: vi.fn().mockResolvedValue([{ id: "tbl-001" }]),
      },
      recordComment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "comment" }),
      },
      attachment: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "attachment" }),
      },
    };

    getPrismaClient.mockReturnValue(prisma);

    const { ensureDemoRecordData } = await loadBootstrap();
    await ensureDemoRecordData();

    expect(prisma.appRecord.create).toHaveBeenCalledTimes(mockRecords.length);
    expect(prisma.recordComment.create).toHaveBeenCalledTimes(mockComments.length);
    expect(prisma.attachment.create).toHaveBeenCalledTimes(mockAttachments.length);
  });
});
