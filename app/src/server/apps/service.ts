import { Prisma } from "@prisma/client";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";
import type { App, AppField, AppTable, FieldType } from "@/types/app";
import type { User } from "@/types/user";

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "user_ref",
  "master_ref",
  "file",
  "ai_generated",
  "calculated",
];

export class AppsServiceError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "AppsServiceError";
  }
}

export interface CreateAppInput {
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  status?: App["status"];
}

export interface UpdateAppInput {
  name?: string;
  code?: string;
  description?: string;
  icon?: string;
  status?: App["status"];
}

export interface CreateTableInput {
  name: string;
  code?: string;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface UpdateTableInput {
  name?: string;
  code?: string;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface CreateFieldInput {
  name: string;
  code?: string;
  fieldType: FieldType;
  required?: boolean;
  uniqueFlag?: boolean;
  defaultValue?: unknown;
  settingsJson?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateFieldInput {
  name?: string;
  code?: string;
  fieldType?: FieldType;
  required?: boolean;
  uniqueFlag?: boolean;
  defaultValue?: unknown;
  settingsJson?: Record<string, unknown>;
  sortOrder?: number;
}

function normalizeIdentifier(value: string, separator: "-" | "_") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}+`, "g"), separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, "g"), "");
}

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (!value || !value.trim()) {
    const labels: Record<string, string> = {
      "App name": "アプリ名",
      "Table name": "テーブル名",
      "Field name": "フィールド名",
    };

    throw new AppsServiceError(`${labels[fieldName] ?? fieldName}は必須です`, 400);
  }

  return value.trim();
}

function assertFieldType(value: string): FieldType {
  if (!FIELD_TYPES.includes(value as FieldType)) {
    throw new AppsServiceError("フィールド種類が不正です", 400);
  }

  return value as FieldType;
}

function toJsonObject(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonObject | undefined {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonObject;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function toApp(app: {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  status: App["status"];
  icon: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): App {
  return {
    id: app.id,
    tenantId: app.tenantId,
    name: app.name,
    code: app.code,
    description: app.description ?? undefined,
    status: app.status,
    icon: app.icon,
    createdBy: app.createdById,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

function toAppSummary(app: {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  status: App["status"];
  icon: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  tables?: Array<{ code: string }>;
  _count?: { tables: number };
}): App {
  const base = toApp(app);

  return {
    ...base,
    primaryTableCode: app.tables?.[0]?.code,
    tableCount: app._count?.tables ?? app.tables?.length,
  };
}

function toAppTable(table: {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  code: string;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
}): AppTable {
  return {
    id: table.id,
    tenantId: table.tenantId,
    appId: table.appId,
    name: table.name,
    code: table.code,
    isSystem: table.isSystem,
    sortOrder: table.sortOrder,
    createdAt: table.createdAt.toISOString(),
  };
}

function toSettingsJson(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toAppField(field: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  code: string;
  fieldType: FieldType;
  required: boolean;
  uniqueFlag: boolean;
  defaultValue: Prisma.JsonValue | null;
  settingsJson: Prisma.JsonValue | null;
  sortOrder: number;
  createdAt: Date;
}): AppField {
  return {
    id: field.id,
    tenantId: field.tenantId,
    appId: field.appId,
    tableId: field.tableId,
    name: field.name,
    code: field.code,
    fieldType: field.fieldType,
    required: field.required,
    uniqueFlag: field.uniqueFlag,
    defaultValue: field.defaultValue ?? undefined,
    settingsJson: toSettingsJson(field.settingsJson),
    sortOrder: field.sortOrder,
    createdAt: field.createdAt.toISOString(),
  };
}

async function ensureUniqueAppCode(user: User, code: string, excludeAppId?: string) {
  const prisma = getPrismaClient();
  const duplicate = await prisma.app.findFirst({
    where: {
      tenantId: user.tenantId,
      code,
      ...(excludeAppId ? { NOT: { id: excludeAppId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppsServiceError("同じアプリコードが既に存在します", 409);
  }
}

async function ensureUniqueTableCode(
  user: User,
  appId: string,
  code: string,
  excludeTableId?: string
) {
  const prisma = getPrismaClient();
  const duplicate = await prisma.appTable.findFirst({
    where: {
      tenantId: user.tenantId,
      appId,
      code,
      ...(excludeTableId ? { NOT: { id: excludeTableId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppsServiceError("同じテーブルコードが既に存在します", 409);
  }
}

async function ensureUniqueFieldCode(
  user: User,
  appId: string,
  tableId: string,
  code: string,
  excludeFieldId?: string
) {
  const prisma = getPrismaClient();
  const duplicate = await prisma.appField.findFirst({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
      code,
      ...(excludeFieldId ? { NOT: { id: excludeFieldId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppsServiceError("同じフィールドコードが既に存在します", 409);
  }
}

async function getAppOrThrow(user: User, appId: string) {
  const prisma = getPrismaClient();
  const app = await prisma.app.findFirst({
    where: {
      id: appId,
      tenantId: user.tenantId,
    },
  });

  if (!app) {
    throw new AppsServiceError("アプリが見つかりません", 404);
  }

  return app;
}

async function getTableOrThrow(user: User, appId: string, tableId: string) {
  await getAppOrThrow(user, appId);

  const prisma = getPrismaClient();
  const table = await prisma.appTable.findFirst({
    where: {
      id: tableId,
      appId,
      tenantId: user.tenantId,
    },
  });

  if (!table) {
    throw new AppsServiceError("テーブルが見つかりません", 404);
  }

  return table;
}

async function getFieldOrThrow(
  user: User,
  appId: string,
  tableId: string,
  fieldId: string
) {
  await getTableOrThrow(user, appId, tableId);

  const prisma = getPrismaClient();
  const field = await prisma.appField.findFirst({
    where: {
      id: fieldId,
      appId,
      tableId,
      tenantId: user.tenantId,
    },
  });

  if (!field) {
    throw new AppsServiceError("フィールドが見つかりません", 404);
  }

  return field;
}

async function nextTableSortOrder(appId: string) {
  const prisma = getPrismaClient();
  const table = await prisma.appTable.findFirst({
    where: { appId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return table ? table.sortOrder + 1 : 0;
}

async function nextFieldSortOrder(tableId: string) {
  const prisma = getPrismaClient();
  const field = await prisma.appField.findFirst({
    where: { tableId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return field ? field.sortOrder + 1 : 0;
}

export async function listAppsForUser(user: User) {
  await ensureDemoBuilderData();

  const prisma = getPrismaClient();
  const apps = await prisma.app.findMany({
    where: {
      tenantId: user.tenantId,
    },
    include: {
      tables: {
        select: { code: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
      },
      _count: {
        select: {
          tables: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return apps.map(toAppSummary);
}

export async function getAppForUser(user: User, appId: string) {
  await ensureDemoBuilderData();
  const app = await getAppOrThrow(user, appId);
  return toApp(app);
}

export async function createAppForUser(user: User, input: CreateAppInput) {
  await ensureDemoBuilderData();

  const name = assertNonEmpty(input.name, "App name");
  const code = normalizeIdentifier(input.code ?? name, "-");

  if (!code) {
    throw new AppsServiceError("アプリコードは必須です", 400);
  }

  await ensureUniqueAppCode(user, code);

  const prisma = getPrismaClient();
  const app = await prisma.app.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      name,
      code,
      description: input.description?.trim() || undefined,
      status: input.status ?? "draft",
      icon: input.icon?.trim() || "apps",
      createdById: user.id,
    },
  });

  return toApp(app);
}

export async function updateAppForUser(
  user: User,
  appId: string,
  input: UpdateAppInput
) {
  await ensureDemoBuilderData();

  const existingApp = await getAppOrThrow(user, appId);
  const nextName = input.name?.trim() || existingApp.name;
  const nextCode = normalizeIdentifier(input.code ?? existingApp.code, "-");

  if (!nextName) {
    throw new AppsServiceError("アプリ名は必須です", 400);
  }

  if (!nextCode) {
    throw new AppsServiceError("アプリコードは必須です", 400);
  }

  await ensureUniqueAppCode(user, nextCode, existingApp.id);

  const prisma = getPrismaClient();
  const app = await prisma.app.update({
    where: { id: existingApp.id },
    data: {
      name: nextName,
      code: nextCode,
      description:
        input.description !== undefined
          ? input.description.trim() || null
          : existingApp.description,
      icon:
        input.icon !== undefined
          ? input.icon.trim() || "apps"
          : existingApp.icon,
      status: input.status ?? existingApp.status,
    },
  });

  return toApp(app);
}

export async function deleteAppForUser(user: User, appId: string) {
  await ensureDemoBuilderData();

  const existingApp = await getAppOrThrow(user, appId);
  const prisma = getPrismaClient();
  await prisma.app.delete({
    where: { id: existingApp.id },
  });
}

export async function listTablesForApp(user: User, appId: string) {
  await ensureDemoBuilderData();
  await getAppOrThrow(user, appId);

  const prisma = getPrismaClient();
  const tables = await prisma.appTable.findMany({
    where: {
      appId,
      tenantId: user.tenantId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return tables.map(toAppTable);
}

export async function getTableForApp(user: User, appId: string, tableId: string) {
  await ensureDemoBuilderData();
  const table = await getTableOrThrow(user, appId, tableId);
  return toAppTable(table);
}

export async function createTableForApp(
  user: User,
  appId: string,
  input: CreateTableInput
) {
  await ensureDemoBuilderData();
  await getAppOrThrow(user, appId);

  const name = assertNonEmpty(input.name, "Table name");
  const code = normalizeIdentifier(input.code ?? name, "-");

  if (!code) {
    throw new AppsServiceError("テーブルコードは必須です", 400);
  }

  await ensureUniqueTableCode(user, appId, code);

  const prisma = getPrismaClient();
  const table = await prisma.appTable.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId,
      name,
      code,
      isSystem: input.isSystem ?? false,
      sortOrder: input.sortOrder ?? (await nextTableSortOrder(appId)),
    },
  });

  return toAppTable(table);
}

export async function updateTableForApp(
  user: User,
  appId: string,
  tableId: string,
  input: UpdateTableInput
) {
  await ensureDemoBuilderData();

  const existingTable = await getTableOrThrow(user, appId, tableId);
  const nextName = input.name?.trim() || existingTable.name;
  const nextCode = normalizeIdentifier(input.code ?? existingTable.code, "-");

  if (!nextName) {
    throw new AppsServiceError("テーブル名は必須です", 400);
  }

  if (!nextCode) {
    throw new AppsServiceError("テーブルコードは必須です", 400);
  }

  await ensureUniqueTableCode(user, appId, nextCode, existingTable.id);

  const prisma = getPrismaClient();
  const table = await prisma.appTable.update({
    where: { id: existingTable.id },
    data: {
      name: nextName,
      code: nextCode,
      isSystem: input.isSystem ?? existingTable.isSystem,
      sortOrder: input.sortOrder ?? existingTable.sortOrder,
    },
  });

  return toAppTable(table);
}

export async function deleteTableForApp(
  user: User,
  appId: string,
  tableId: string
) {
  await ensureDemoBuilderData();

  const existingTable = await getTableOrThrow(user, appId, tableId);
  const prisma = getPrismaClient();
  await prisma.appTable.delete({
    where: { id: existingTable.id },
  });
}

export async function listFieldsForTable(
  user: User,
  appId: string,
  tableId: string
) {
  await ensureDemoBuilderData();
  await getTableOrThrow(user, appId, tableId);

  const prisma = getPrismaClient();
  const fields = await prisma.appField.findMany({
    where: {
      appId,
      tableId,
      tenantId: user.tenantId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return fields.map((field) => toAppField(field as typeof field & { fieldType: FieldType }));
}

export async function getFieldForTable(
  user: User,
  appId: string,
  tableId: string,
  fieldId: string
) {
  await ensureDemoBuilderData();
  const field = await getFieldOrThrow(user, appId, tableId, fieldId);
  return toAppField(field as typeof field & { fieldType: FieldType });
}

export async function createFieldForTable(
  user: User,
  appId: string,
  tableId: string,
  input: CreateFieldInput
) {
  await ensureDemoBuilderData();
  await getTableOrThrow(user, appId, tableId);

  const name = assertNonEmpty(input.name, "Field name");
  const code = normalizeIdentifier(input.code ?? name, "_");

  if (!code) {
    throw new AppsServiceError("フィールドコードは必須です", 400);
  }

  await ensureUniqueFieldCode(user, appId, tableId, code);

  const fieldType = assertFieldType(input.fieldType);
  const prisma = getPrismaClient();
  const field = await prisma.appField.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId,
      tableId,
      name,
      code,
      fieldType,
      required: input.required ?? false,
      uniqueFlag: input.uniqueFlag ?? false,
      defaultValue:
        input.defaultValue === undefined ? undefined : toJsonValue(input.defaultValue),
      settingsJson: toJsonObject(input.settingsJson),
      sortOrder: input.sortOrder ?? (await nextFieldSortOrder(tableId)),
    },
  });

  return toAppField(field as typeof field & { fieldType: FieldType });
}

export async function updateFieldForTable(
  user: User,
  appId: string,
  tableId: string,
  fieldId: string,
  input: UpdateFieldInput
) {
  await ensureDemoBuilderData();

  const existingField = await getFieldOrThrow(user, appId, tableId, fieldId);
  const nextName = input.name?.trim() || existingField.name;
  const nextCode = normalizeIdentifier(input.code ?? existingField.code, "_");

  if (!nextName) {
    throw new AppsServiceError("フィールド名は必須です", 400);
  }

  if (!nextCode) {
    throw new AppsServiceError("フィールドコードは必須です", 400);
  }

  await ensureUniqueFieldCode(user, appId, tableId, nextCode, existingField.id);

  const prisma = getPrismaClient();
  const field = await prisma.appField.update({
    where: { id: existingField.id },
    data: {
      name: nextName,
      code: nextCode,
      fieldType: input.fieldType
        ? assertFieldType(input.fieldType)
        : existingField.fieldType,
      required: input.required ?? existingField.required,
      uniqueFlag: input.uniqueFlag ?? existingField.uniqueFlag,
      ...(input.defaultValue !== undefined
        ? { defaultValue: toJsonValue(input.defaultValue) }
        : {}),
      ...(input.settingsJson !== undefined
        ? { settingsJson: toJsonObject(input.settingsJson) }
        : {}),
      sortOrder: input.sortOrder ?? existingField.sortOrder,
    },
  });

  return toAppField(field as typeof field & { fieldType: FieldType });
}

export async function deleteFieldForTable(
  user: User,
  appId: string,
  tableId: string,
  fieldId: string
) {
  await ensureDemoBuilderData();

  const existingField = await getFieldOrThrow(user, appId, tableId, fieldId);
  const prisma = getPrismaClient();
  await prisma.appField.delete({
    where: { id: existingField.id },
  });
}
