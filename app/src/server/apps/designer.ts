import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { FIELD_TYPES } from "@/lib/app-creation";
import type { SaveTableDesignInput, TableDesignSnapshot } from "@/lib/table-design";
import { requirePermission } from "@/server/admin/rbac";
import { recordAuditLog } from "@/server/audit/service";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { AppsServiceError, normalizeFormLayout, toApp, toAppField, toAppForm, toAppTable, toAppView } from "@/server/apps/service";
import { getPrismaClient } from "@/server/db/prisma";
import type { User } from "@/types/user";

async function readSnapshot(prisma: Prisma.TransactionClient, user: User, appId: string): Promise<TableDesignSnapshot> {
  const where = { tenantId: user.tenantId };
  const orderBy = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }];
  const source = await prisma.app.findFirst({
    where: { ...where, id: appId },
    include: { tables: { where, orderBy }, fields: { where, orderBy }, forms: { where, orderBy }, views: { where, orderBy } },
  });
  if (!source) throw new AppsServiceError("アプリが見つかりません。", 404);
  return { revision: createHash("sha256").update(JSON.stringify(source)).digest("hex"), app: toApp(source), tables: source.tables.map(toAppTable), fields: source.fields.map(toAppField), forms: source.forms.map(toAppForm), views: source.views.map(toAppView) };
}

export async function getTableDesign(user: User, appId: string) {
  await ensureDemoBuilderData();
  await requirePermission(user, "app:read", { appId });
  const snapshot = await getPrismaClient().$transaction((transaction) => readSnapshot(transaction, user, appId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  for (const table of snapshot.tables) await requirePermission(user, "table:read", { appId, tableId: table.id });
  return snapshot;
}

function validateInput(value: unknown): asserts value is SaveTableDesignInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppsServiceError("設計データが不正です。", 400);
  const input = value as SaveTableDesignInput;
  if (typeof input.revision !== "string" || !input.revision || typeof input.appName !== "string" || !input.appName.trim()) throw new AppsServiceError("アプリ名と設計のリビジョンが必要です。", 400);
  if (!input.table || typeof input.table.name !== "string" || !input.table.name.trim() || typeof input.table.code !== "string" || !input.table.code) throw new AppsServiceError("テーブル名とコードが必要です。", 400);
  if ((input.table.id !== undefined && typeof input.table.id !== "string") || (input.form?.id !== undefined && typeof input.form.id !== "string")) throw new AppsServiceError("設計のIDが不正です。", 400);
  if (!input.form || typeof input.form.name !== "string" || !input.form.name.trim() || !input.form.layoutJson || typeof input.form.layoutJson !== "object" || Array.isArray(input.form.layoutJson)) throw new AppsServiceError("フォーム名と配置が必要です。", 400);
  if (!Array.isArray(input.fields) || !input.fields.length) throw new AppsServiceError("項目を1つ以上追加してください。", 400);
  const codes = new Set<string>();
  const ids = new Set<string>();
  for (const field of input.fields) {
    if (!field || typeof field !== "object" || typeof field.name !== "string" || !field.name.trim() || typeof field.code !== "string" || !field.code || typeof field.required !== "boolean") throw new AppsServiceError("項目の設定が不正です。", 400);
    if (field.id !== undefined && (typeof field.id !== "string" || !field.id)) throw new AppsServiceError("項目のIDが不正です。", 400);
    if (codes.has(field.code) || (field.id && ids.has(field.id))) throw new AppsServiceError("項目のコードまたはIDが重複しています。", 400);
    codes.add(field.code); if (field.id) ids.add(field.id);
    if (!field.id && (!/^[a-z][a-z0-9_]*$/.test(field.code) || !FIELD_TYPES.some((type) => type.type === field.fieldType))) throw new AppsServiceError("新規項目のコードまたは型が不正です。", 400);
    if (field.fieldType === "select" && (!Array.isArray(field.options) || field.options.some((option) => typeof option !== "string" || !option.trim()) || new Set(field.options).size !== field.options.length || (!field.id && !field.options.length))) throw new AppsServiceError("選択肢が不正です。", 400);
  }
}

export async function saveTableDesign(user: User, appId: string, value: unknown): Promise<TableDesignSnapshot> {
  validateInput(value);
  const input = value;
  await ensureDemoBuilderData();
  await requirePermission(user, "app:read", { appId });
  await requirePermission(user, "table:write", { appId, tableId: input.table.id });
  try {
    return await getPrismaClient().$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM apps WHERE id = ${appId} AND tenant_id = ${user.tenantId} FOR UPDATE`;
      if (!locked.length) throw new AppsServiceError("アプリが見つかりません。", 404);
      const before = await readSnapshot(transaction, user, appId);
      if (before.revision !== input.revision) throw new AppsServiceError("別の操作で設計が変更されています。再読み込みしてから保存してください。", 409);
      const existingTable = before.tables.find((table) => table.id === input.table.id);
      if (input.table.id && !existingTable) throw new AppsServiceError("テーブルが見つかりません。", 404);
      if (!existingTable && before.tables.length) throw new AppsServiceError("1アプリにつきテーブルは1つまでです。", 400);
      if (existingTable && existingTable.code !== input.table.code) throw new AppsServiceError("保存済みテーブルのコード変更は詳細設定で行ってください。", 400);
      if (!existingTable && !/^[a-z][a-z0-9-]*$/.test(input.table.code)) throw new AppsServiceError("テーブルコードが不正です。", 400);
      const existingFields = before.fields.filter((field) => field.tableId === existingTable?.id);
      const byId = new Map(existingFields.map((field) => [field.id, field]));
      if (existingFields.some((field) => !input.fields.some((candidate) => candidate.id === field.id))) throw new AppsServiceError("保存済み項目は削除できません。フォームで非表示にしてください。", 400);
      for (const field of input.fields) {
        if (field.id) {
          const original = byId.get(field.id);
          if (!original) throw new AppsServiceError("項目がこのテーブルに存在しません。", 400);
          if (original.code !== field.code || original.fieldType !== field.fieldType) throw new AppsServiceError("保存済み項目のコード・型変更は詳細設定で行ってください。", 400);
        }
      }
      const forms = before.forms.filter((form) => form.tableId === existingTable?.id);
      const existingForm = forms.find((form) => form.id === input.form.id);
      if (input.form.id && !existingForm) throw new AppsServiceError("フォームが見つかりません。", 404);
      if (forms.some((form) => form.id !== input.form.id && form.name === input.form.name.trim())) throw new AppsServiceError("同じフォーム名が存在します。", 400);
      if (input.appName.trim() !== before.app.name) {
        await requirePermission(user, "app:write", { appId });
        await transaction.app.update({ where: { id: appId }, data: { name: input.appName.trim() } });
      }
      const tableId = existingTable?.id ?? crypto.randomUUID();
      if (existingTable) {
        if (existingTable.name !== input.table.name.trim()) await transaction.appTable.update({ where: { id: tableId }, data: { name: input.table.name.trim() } });
      } else await transaction.appTable.create({ data: { id: tableId, tenantId: user.tenantId, appId, name: input.table.name.trim(), code: input.table.code, sortOrder: 0 } });
      let sortOrder = Math.max(-1, ...existingFields.map((field) => field.sortOrder)) + 1;
      for (const field of input.fields) {
        const original = field.id ? byId.get(field.id) : undefined;
        const settingsJson = field.fieldType === "select" ? { ...original?.settingsJson, options: field.options } : undefined;
        if (original) {
          if (original.name !== field.name.trim() || original.required !== field.required || (settingsJson && JSON.stringify(original.settingsJson?.options) !== JSON.stringify(field.options))) {
            await transaction.appField.update({ where: { id: original.id }, data: { name: field.name.trim(), required: field.required, ...(settingsJson ? { settingsJson: settingsJson as Prisma.InputJsonObject } : {}) } });
          }
        } else await transaction.appField.create({ data: { id: crypto.randomUUID(), tenantId: user.tenantId, appId, tableId, name: field.name.trim(), code: field.code, fieldType: field.fieldType, required: field.required, sortOrder: sortOrder++, ...(settingsJson ? { settingsJson: settingsJson as Prisma.InputJsonObject } : {}) } });
      }
      const layoutJson = await normalizeFormLayout(user, appId, tableId, input.form.layoutJson, transaction);
      if (!layoutJson.fields.some((field) => field.visible)) throw new AppsServiceError("フォームに1項目以上配置してください。", 400);
      const data = { name: input.form.name.trim(), layoutJson: layoutJson as Prisma.InputJsonObject };
      const formId = existingForm?.id ?? crypto.randomUUID();
      if (existingForm) await transaction.appForm.update({ where: { id: formId }, data });
      else await transaction.appForm.create({ data: { ...data, id: formId, tenantId: user.tenantId, appId, tableId, sortOrder: Math.max(-1, ...forms.map((form) => form.sortOrder)) + 1 } });
      if (!before.views.some((view) => view.tableId === tableId)) await transaction.appView.create({ data: { id: crypto.randomUUID(), tenantId: user.tenantId, appId, tableId, name: "すべて", viewType: "list", settingsJson: { columns: input.fields.map((field) => field.code) }, sortOrder: 0 } });
      await recordAuditLog(user, { actionType: "TABLE_DESIGN_SAVE", resourceType: "table", resourceId: tableId, resourceName: input.table.name.trim(), detailJson: { appId, formId, beforeRevision: before.revision, createdFieldCodes: input.fields.filter((field) => !field.id).map((field) => field.code), layoutJson } }, transaction);
      return readSnapshot(transaction, user, appId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) throw new AppsServiceError("設計が競合しました。再読み込みして確認してください。", 409);
    throw error;
  }
}
