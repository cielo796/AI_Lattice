import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableDesign, saveTableDesign } from "@/server/apps/designer";
import { serializeTableDesign, tableDesignDraft, type SaveTableDesignInput } from "@/lib/table-design";
import type { User } from "@/types/user";

const mocks = vi.hoisted(() => ({ prisma: vi.fn(), permission: vi.fn(), audit: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: () => mocks.prisma() }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission: mocks.permission, hasPermission: vi.fn() }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/server/apps/bootstrap", () => ({ ensureDemoBuilderData: vi.fn() }));

const user: User = { id: "user", tenantId: "tenant", name: "Owner", email: "owner@example.com", status: "active", createdAt: "2026-10-06" };
const timestamp = new Date("2026-10-06T00:00:00Z");

function database() {
  const table = { id: "table", tenantId: "tenant", appId: "app", name: "項目", code: "items", isSystem: false, sortOrder: 0, createdAt: timestamp, updatedAt: timestamp };
  const field = { id: "field", tenantId: "tenant", appId: "app", tableId: "table", name: "名前", code: "name", fieldType: "text" as const, required: true, uniqueFlag: true, defaultValue: "default", settingsJson: { custom: "preserved" }, sortOrder: 5, createdAt: timestamp, updatedAt: timestamp };
  const form = { id: "form", tenantId: "tenant", appId: "app", tableId: "table", name: "標準フォーム", layoutJson: { fields: [{ fieldCode: "name", visible: true, required: true, width: "full", rowIndex: 0 }] }, sortOrder: 0, createdAt: timestamp, updatedAt: timestamp };
  const source = { id: "app", tenantId: "tenant", name: "在庫", code: "inventory", description: null, status: "draft" as const, icon: "apps", createdById: "user", createdAt: timestamp, updatedAt: timestamp, tables: [table], fields: [field], forms: [form], views: [] };
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "app" }]),
    app: { findFirst: vi.fn().mockResolvedValue(source), update: vi.fn() },
    appTable: { update: vi.fn(), create: vi.fn() },
    appField: { findMany: vi.fn().mockResolvedValue(source.fields), update: vi.fn(), create: vi.fn() },
    appForm: { update: vi.fn(), create: vi.fn() },
    appView: { create: vi.fn() },
  };
  const client = { $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)) };
  mocks.prisma.mockReturnValue(client);
  return { transaction, client, source };
}

describe("atomic table designer", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.permission.mockResolvedValue(undefined); });
  async function fixture() {
    const db = database();
    const snapshot = await getTableDesign(user, "app");
    const input = serializeTableDesign(tableDesignDraft(snapshot), snapshot.revision);
    return { ...db, input };
  }
  it("reads a tenant-scoped revision and enforces table read permission", async () => {
    const { transaction } = database();
    const snapshot = await getTableDesign(user, "app");
    expect(snapshot.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(transaction.app.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant", id: "app" } }));
    expect(mocks.permission).toHaveBeenCalledWith(user, "table:read", { appId: "app", tableId: "table" });
  });
  it("uses one transaction including layout and audit without rewriting field metadata", async () => {
    const { input, transaction, client } = await fixture();
    await saveTableDesign(user, "app", input);
    expect(client.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "Serializable", timeout: 20000 });
    expect(transaction.appField.update).not.toHaveBeenCalled();
    expect(transaction.appForm.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "form" }, data: expect.objectContaining({ layoutJson: { fields: [{ fieldCode: "name", visible: true, required: true, width: "full", rowIndex: 0 }] } }) }));
    expect(mocks.audit).toHaveBeenCalledWith(user, expect.objectContaining({ actionType: "TABLE_DESIGN_SAVE" }), transaction);
  });
  it("requires app write permission only for a renamed app", async () => {
    const { input } = await fixture();
    await saveTableDesign(user, "app", { ...input, appName: "新しい名前" });
    expect(mocks.permission).toHaveBeenCalledWith(user, "app:write", { appId: "app" });
  });
  it("rejects stale revisions before any write", async () => {
    const { input, transaction } = await fixture();
    await expect(saveTableDesign(user, "app", { ...input, revision: "old" })).rejects.toMatchObject({ status: 409 });
    expect(transaction.appForm.update).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(["code", "fieldType"] as const)("does not mutate persisted %s", async (property) => {
    const { input, transaction } = await fixture();
    const altered = { ...input, fields: [{ ...input.fields[0], [property]: property === "code" ? "new_code" : "number" }] };
    await expect(saveTableDesign(user, "app", altered)).rejects.toMatchObject({ status: 400 });
    expect(transaction.appField.update).not.toHaveBeenCalled();
  });
  it("rejects omitted or foreign fields", async () => {
    const { input, transaction } = await fixture();
    await expect(saveTableDesign(user, "app", { ...input, fields: [{ ...input.fields[0], id: "foreign" }] })).rejects.toMatchObject({ status: 400 });
    expect(transaction.appField.create).not.toHaveBeenCalled();
  });
  it("does not allow bypassing the one-table limit", async () => {
    const { input, transaction } = await fixture();
    await expect(saveTableDesign(user, "app", { ...input, table: { name: "Other", code: "other" } })).rejects.toMatchObject({ status: 400 });
    expect(transaction.appTable.create).not.toHaveBeenCalled();
  });
  it.each([null, { revision: 1 }, { fields: [] }])("rejects malformed input", async (input) => {
    database(); await expect(saveTableDesign(user, "app", input)).rejects.toMatchObject({ status: 400 });
  });
  it("rejects unsafe new types and duplicate codes", async () => {
    const { input } = await fixture();
    const field: SaveTableDesignInput["fields"][number] = { name: "参照", code: "reference", fieldType: "master_ref", required: false };
    await expect(saveTableDesign(user, "app", { ...input, fields: [...input.fields, field] })).rejects.toMatchObject({ status: 400 });
    await expect(saveTableDesign(user, "app", { ...input, fields: [...input.fields, { ...field, code: "name", fieldType: "text" }] })).rejects.toMatchObject({ status: 400 });
  });
  it("denies unauthorized writes before opening a transaction", async () => {
    const { input, client } = await fixture();
    const calls = client.$transaction.mock.calls.length;
    mocks.permission.mockRejectedValue({ status: 403 });
    await expect(saveTableDesign(user, "app", input)).rejects.toMatchObject({ status: 403 });
    expect(client.$transaction).toHaveBeenCalledTimes(calls);
  });
});
