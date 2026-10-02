import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateFieldForTable } from "@/server/apps/service";
import type { User } from "@/types/user";

const { getPrismaClient } = vi.hoisted(() => ({ getPrismaClient: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient }));
vi.mock("@/server/apps/bootstrap", () => ({ ensureDemoBuilderData: vi.fn() }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission: vi.fn() }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: vi.fn() }));

const user: User = {
  id: "owner", tenantId: "tenant", email: "owner@example.com", name: "Owner",
  status: "active", createdAt: "2026-10-02T00:00:00Z",
};
const field = {
  id: "field", tenantId: "tenant", appId: "app", tableId: "table", code: "title", name: "件名",
  fieldType: "text", required: false, uniqueFlag: false, defaultValue: null, settingsJson: null,
  sortOrder: 0, createdAt: new Date("2026-10-02T00:00:00Z"),
};

function fixture() {
  const prisma = {
    app: { findFirst: vi.fn().mockResolvedValue({ id: "app" }) },
    appTable: { findFirst: vi.fn().mockResolvedValue({ id: "table" }) },
    appField: {
      findFirst: vi.fn().mockResolvedValueOnce(field).mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ ...field, code: "subject" }),
    },
    appView: { findMany: vi.fn().mockResolvedValue([]) },
    appForm: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValueOnce([{ code: "title" }]).mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (operation) => operation(prisma));
  getPrismaClient.mockReturnValue(prisma);
  return prisma;
}

describe("field code migration", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("migrates record JSON before updating metadata in the same transaction", async () => {
    const prisma = fixture();
    await updateFieldForTable(user, "app", "table", "field", { code: "subject" });
    expect(prisma.$executeRaw).toHaveBeenCalledOnce();
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.appField.update.mock.invocationCallOrder[0]);
    const [sql, ...parameters] = prisma.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toContain("jsonb_build_object");
    expect(sql.join("?")).toContain("tenant_id =");
    expect(sql.join("?")).toContain("table_id =");
    expect(parameters).toEqual(["title", "subject", "title", "owner", "tenant", "app", "table", "title"]);
  });

  it("rejects target keys containing saved data without changing metadata", async () => {
    const prisma = fixture();
    prisma.$queryRaw.mockReset().mockResolvedValueOnce([{ code: "title" }]).mockResolvedValueOnce([{ hasConflict: true }]);
    await expect(updateFieldForTable(user, "app", "table", "field", { code: "subject" })).rejects.toMatchObject({ status: 409 });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.appField.update).not.toHaveBeenCalled();
  });

  it("rejects a concurrently renamed field instead of migrating a stale key", async () => {
    const prisma = fixture();
    prisma.$queryRaw.mockReset().mockResolvedValueOnce([{ code: "already_changed" }]);
    await expect(updateFieldForTable(user, "app", "table", "field", { code: "subject" })).rejects.toMatchObject({ status: 409 });
    expect(prisma.appField.update).not.toHaveBeenCalled();
  });

  it("rejects a field deleted before taking its lock", async () => {
    const prisma = fixture();
    prisma.$queryRaw.mockReset().mockResolvedValueOnce([]);
    await expect(updateFieldForTable(user, "app", "table", "field", { code: "subject" })).rejects.toMatchObject({ status: 404 });
    expect(prisma.appField.update).not.toHaveBeenCalled();
  });

  it("does not migrate data when only the field name changes", async () => {
    const prisma = fixture();
    prisma.appField.update.mockResolvedValue({ ...field, name: "変更後" });
    await updateFieldForTable(user, "app", "table", "field", { name: "変更後" });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
