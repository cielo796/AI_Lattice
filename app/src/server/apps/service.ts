import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/server/audit/service";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";
import type {
  App,
  AppField,
  AppForm,
  AppTable,
  AppView,
  AppViewType,
  FieldType,
} from "@/types/app";
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

const VIEW_TYPES: AppViewType[] = ["list", "kanban", "calendar", "chart", "kpi"];
const VIEW_FILTER_OPERATORS = ["equals", "contains", "not_empty"] as const;
const FORM_FIELD_WIDTHS = ["half", "full"] as const;
type ViewFilterOperator = (typeof VIEW_FILTER_OPERATORS)[number];
type FormFieldWidth = (typeof FORM_FIELD_WIDTHS)[number];

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

export interface CreateViewInput {
  name: string;
  viewType?: AppViewType;
  settingsJson?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateViewInput {
  name?: string;
  viewType?: AppViewType;
  settingsJson?: Record<string, unknown>;
  sortOrder?: number;
}

export interface CreateFormInput {
  name: string;
  layoutJson?: Record<string, unknown>;
  sortOrder?: number;
}

export interface UpdateFormInput {
  name?: string;
  layoutJson?: Record<string, unknown>;
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

function assertViewType(value: string): AppViewType {
  if (!VIEW_TYPES.includes(value as AppViewType)) {
    throw new AppsServiceError("ビュー種別が不正です。", 400);
  }

  return value as AppViewType;
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

function getReferenceTableCode(settings: Record<string, unknown> | undefined) {
  const referenceTableCode = settings?.referenceTableCode;
  return typeof referenceTableCode === "string" ? referenceTableCode.trim() : "";
}

function getReferenceTableId(settings: Record<string, unknown> | undefined) {
  const referenceTableId = settings?.referenceTableId;
  if (typeof referenceTableId === "string" && referenceTableId.trim()) {
    return referenceTableId.trim();
  }

  const legacyReferenceTableId = settings?.refTable;
  return typeof legacyReferenceTableId === "string" ? legacyReferenceTableId.trim() : "";
}

function getReferenceDisplayFieldCode(settings: Record<string, unknown> | undefined) {
  const displayFieldCode = settings?.displayFieldCode;
  return typeof displayFieldCode === "string" ? displayFieldCode.trim() : "";
}

function getReferenceLookupFieldCodes(settings: Record<string, unknown> | undefined) {
  const lookupFieldCodes = settings?.lookupFieldCodes;

  if (!Array.isArray(lookupFieldCodes)) {
    return [];
  }

  return lookupFieldCodes.filter(
    (lookupFieldCode): lookupFieldCode is string =>
      typeof lookupFieldCode === "string" && lookupFieldCode.trim().length > 0
  );
}

function isMultiReference(settings: Record<string, unknown> | undefined) {
  return settings?.multiple === true;
}

function shouldShowBackReference(settings: Record<string, unknown> | undefined) {
  return settings?.showBackReference === true;
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

function toAppView(view: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  viewType: AppViewType;
  settingsJson: Prisma.JsonValue | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): AppView {
  return {
    id: view.id,
    tenantId: view.tenantId,
    appId: view.appId,
    tableId: view.tableId,
    name: view.name,
    viewType: view.viewType,
    settingsJson: toSettingsJson(view.settingsJson),
    sortOrder: view.sortOrder,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

function toLayoutJson(value: unknown): Record<string, unknown> {
  return toSettingsJson(value) ?? {};
}

function toAppForm(form: {
  id: string;
  tenantId: string;
  appId: string;
  tableId: string;
  name: string;
  layoutJson: Prisma.JsonValue | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): AppForm {
  return {
    id: form.id,
    tenantId: form.tenantId,
    appId: form.appId,
    tableId: form.tableId,
    name: form.name,
    layoutJson: toLayoutJson(form.layoutJson),
    sortOrder: form.sortOrder,
    createdAt: form.createdAt.toISOString(),
    updatedAt: form.updatedAt.toISOString(),
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

async function ensureUniqueViewName(
  user: User,
  appId: string,
  tableId: string,
  name: string,
  excludeViewId?: string
) {
  const prisma = getPrismaClient();
  const duplicate = await prisma.appView.findFirst({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
      name,
      ...(excludeViewId ? { NOT: { id: excludeViewId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppsServiceError("同じビュー名が既に存在します。", 409);
  }
}

async function ensureUniqueFormName(
  user: User,
  appId: string,
  tableId: string,
  name: string,
  excludeFormId?: string
) {
  const prisma = getPrismaClient();
  const duplicate = await prisma.appForm.findFirst({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
      name,
      ...(excludeFormId ? { NOT: { id: excludeFormId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppsServiceError("同じフォーム名が既に存在します。", 409);
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

async function getViewOrThrow(
  user: User,
  appId: string,
  tableId: string,
  viewId: string
) {
  await getTableOrThrow(user, appId, tableId);

  const prisma = getPrismaClient();
  const view = await prisma.appView.findFirst({
    where: {
      id: viewId,
      appId,
      tableId,
      tenantId: user.tenantId,
    },
  });

  if (!view) {
    throw new AppsServiceError("ビューが見つかりません。", 404);
  }

  return view;
}

async function getFormOrThrow(
  user: User,
  appId: string,
  tableId: string,
  formId: string
) {
  await getTableOrThrow(user, appId, tableId);

  const prisma = getPrismaClient();
  const form = await prisma.appForm.findFirst({
    where: {
      id: formId,
      appId,
      tableId,
      tenantId: user.tenantId,
    },
  });

  if (!form) {
    throw new AppsServiceError("フォームが見つかりません。", 404);
  }

  return form;
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

async function nextViewSortOrder(tableId: string) {
  const prisma = getPrismaClient();
  const view = await prisma.appView.findFirst({
    where: { tableId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return view ? view.sortOrder + 1 : 0;
}

async function nextFormSortOrder(tableId: string) {
  const prisma = getPrismaClient();
  const form = await prisma.appForm.findFirst({
    where: { tableId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return form ? form.sortOrder + 1 : 0;
}

async function normalizeFieldSettings(
  user: User,
  appId: string,
  fieldType: FieldType,
  settingsJson: Record<string, unknown> | undefined
) {
  if (fieldType !== "master_ref") {
    return settingsJson;
  }

  const referenceTableId = getReferenceTableId(settingsJson);
  const referenceTableCode = getReferenceTableCode(settingsJson);

  if (!referenceTableId && !referenceTableCode) {
    throw new AppsServiceError("参照先テーブルが指定されていません", 400);
  }

  const prisma = getPrismaClient();
  const referenceTable = await prisma.appTable.findFirst({
    where: {
      tenantId: user.tenantId,
      appId,
      ...(referenceTableId ? { id: referenceTableId } : { code: referenceTableCode }),
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!referenceTable) {
    throw new AppsServiceError("参照先テーブルが見つかりません", 400);
  }

  const referenceFields = await prisma.appField.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId: referenceTable.id,
    },
    select: {
      code: true,
    },
  });
  const availableFieldCodes = new Set(referenceFields.map((field) => field.code));

  const displayFieldCode = getReferenceDisplayFieldCode(settingsJson);
  if (displayFieldCode && !availableFieldCodes.has(displayFieldCode)) {
    throw new AppsServiceError("表示フィールドが参照先テーブルに存在しません", 400);
  }

  const lookupFieldCodes = getReferenceLookupFieldCodes(settingsJson);
  const invalidLookupFieldCode = lookupFieldCodes.find(
    (lookupFieldCode) => !availableFieldCodes.has(lookupFieldCode)
  );
  if (invalidLookupFieldCode) {
    throw new AppsServiceError(
      `Lookup フィールド "${invalidLookupFieldCode}" が参照先テーブルに存在しません`,
      400
    );
  }

  const normalizedLookupFieldCodes = lookupFieldCodes.filter(
    (lookupFieldCode) => lookupFieldCode !== displayFieldCode
  );

  return {
    referenceTableId: referenceTable.id,
    referenceTableCode: referenceTable.code,
    ...(displayFieldCode ? { displayFieldCode } : {}),
    ...(normalizedLookupFieldCodes.length > 0
      ? { lookupFieldCodes: normalizedLookupFieldCodes }
      : {}),
    ...(isMultiReference(settingsJson) ? { multiple: true } : {}),
    ...(shouldShowBackReference(settingsJson) ? { showBackReference: true } : {}),
  };
}

function normalizeFieldCodeList(
  value: unknown,
  availableFieldCodes: Set<string>,
  fieldName: string
) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new AppsServiceError(`${fieldName} は配列で指定してください。`, 400);
  }

  const codes = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  const uniqueCodes = [...new Set(codes)];
  const invalidCode = uniqueCodes.find((code) => !availableFieldCodes.has(code));

  if (invalidCode) {
    throw new AppsServiceError(`ビュー設定のフィールド "${invalidCode}" が見つかりません。`, 400);
  }

  return uniqueCodes;
}

function normalizeViewSort(
  value: unknown,
  availableFieldCodes: Set<string>
) {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppsServiceError("ビューのソート設定が不正です。", 400);
  }

  const sort = value as Record<string, unknown>;
  const fieldCode = typeof sort.fieldCode === "string" ? sort.fieldCode.trim() : "";
  const direction = sort.direction === "desc" ? "desc" : "asc";

  if (!fieldCode) {
    return undefined;
  }

  if (!availableFieldCodes.has(fieldCode)) {
    throw new AppsServiceError(`ソート対象フィールド "${fieldCode}" が見つかりません。`, 400);
  }

  return { fieldCode, direction };
}

function normalizeViewFilters(
  value: unknown,
  availableFieldCodes: Set<string>
) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new AppsServiceError("ビューのフィルタ設定が不正です。", 400);
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new AppsServiceError("ビューのフィルタ設定が不正です。", 400);
      }

      const filter = item as Record<string, unknown>;
      const fieldCode = typeof filter.fieldCode === "string" ? filter.fieldCode.trim() : "";
      const operator = VIEW_FILTER_OPERATORS.includes(
        filter.operator as ViewFilterOperator
      )
        ? (filter.operator as ViewFilterOperator)
        : "contains";
      const filterValue =
        typeof filter.value === "string" ? filter.value.trim() : undefined;

      if (!fieldCode) {
        return null;
      }

      if (!availableFieldCodes.has(fieldCode)) {
        throw new AppsServiceError(`フィルタ対象フィールド "${fieldCode}" が見つかりません。`, 400);
      }

      return {
        fieldCode,
        operator,
        ...(operator !== "not_empty" && filterValue ? { value: filterValue } : {}),
      };
    })
    .filter(
      (filter): filter is {
        fieldCode: string;
        operator: ViewFilterOperator;
        value?: string;
      } => filter !== null
    );
}

async function normalizeViewSettings(
  user: User,
  appId: string,
  tableId: string,
  settingsJson: Record<string, unknown> | undefined
) {
  if (!settingsJson) {
    return undefined;
  }

  const prisma = getPrismaClient();
  const fields = await prisma.appField.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
    },
    select: { code: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const availableFieldCodes = new Set(fields.map((field) => field.code));
  const columns = normalizeFieldCodeList(
    settingsJson.columns,
    availableFieldCodes,
    "表示列"
  );
  const sort = normalizeViewSort(settingsJson.sort, availableFieldCodes);
  const filters = normalizeViewFilters(settingsJson.filters, availableFieldCodes);

  return {
    ...(columns !== undefined ? { columns } : {}),
    ...(sort ? { sort } : {}),
    ...(filters !== undefined ? { filters } : {}),
  };
}

type FormLayoutFieldSource = {
  code: string;
  required: boolean;
  fieldType: FieldType;
};

function getDefaultFormFieldLayout(field: FormLayoutFieldSource) {
  return {
    fieldCode: field.code,
    visible: true,
    required: field.required,
    width: field.fieldType === "textarea" ? ("full" as const) : ("half" as const),
  };
}

function normalizeFormFieldWidth(value: unknown): FormFieldWidth {
  return FORM_FIELD_WIDTHS.includes(value as FormFieldWidth)
    ? (value as FormFieldWidth)
    : "half";
}

async function normalizeFormLayout(
  user: User,
  appId: string,
  tableId: string,
  layoutJson: Record<string, unknown> | undefined
) {
  const prisma = getPrismaClient();
  const fields = await prisma.appField.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
    },
    select: { code: true, required: true, fieldType: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const fieldByCode = new Map(
    fields.map((field) => [
      field.code,
      field as typeof field & { fieldType: FieldType },
    ])
  );
  const fallbackFields = fields.map((field) =>
    getDefaultFormFieldLayout(field as typeof field & { fieldType: FieldType })
  );

  if (!layoutJson) {
    return { fields: fallbackFields };
  }

  const layoutFields = layoutJson.fields;
  if (layoutFields === undefined) {
    return { fields: fallbackFields };
  }

  if (!Array.isArray(layoutFields)) {
    throw new AppsServiceError("フォームのフィールド設定が不正です。", 400);
  }

  const seenFieldCodes = new Set<string>();
  const normalizedFields = layoutFields.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AppsServiceError("フォームのフィールド設定が不正です。", 400);
    }

    const formField = item as Record<string, unknown>;
    const fieldCode =
      typeof formField.fieldCode === "string" ? formField.fieldCode.trim() : "";

    if (!fieldCode) {
      return [];
    }

    const field = fieldByCode.get(fieldCode);
    if (!field) {
      throw new AppsServiceError(
        `フォーム設定のフィールド "${fieldCode}" が見つかりません。`,
        400
      );
    }

    if (seenFieldCodes.has(fieldCode)) {
      return [];
    }

    seenFieldCodes.add(fieldCode);

    const helpText =
      typeof formField.helpText === "string" ? formField.helpText.trim() : "";
    const visible = field.required ? true : formField.visible !== false;
    const required = field.required || formField.required === true;

    return [
      {
        fieldCode,
        visible,
        required,
        width: normalizeFormFieldWidth(formField.width),
        ...(helpText ? { helpText } : {}),
      },
    ];
  });

  for (const field of fields) {
    if (!seenFieldCodes.has(field.code)) {
      normalizedFields.push(
        getDefaultFormFieldLayout(field as typeof field & { fieldType: FieldType })
      );
    }
  }

  return { fields: normalizedFields };
}

function replaceFieldCodeInViewSettings(
  value: unknown,
  previousCode: string,
  nextCode: string
) {
  const settings = toSettingsJson(value);

  if (!settings) {
    return undefined;
  }

  let changed = false;
  const columns = Array.isArray(settings.columns)
    ? settings.columns.map((column) => {
        if (column === previousCode) {
          changed = true;
          return nextCode;
        }

        return column;
      })
    : settings.columns;
  const sort =
    settings.sort && typeof settings.sort === "object" && !Array.isArray(settings.sort)
      ? { ...(settings.sort as Record<string, unknown>) }
      : settings.sort;

  if (
    sort &&
    typeof sort === "object" &&
    !Array.isArray(sort) &&
    (sort as Record<string, unknown>).fieldCode === previousCode
  ) {
    (sort as Record<string, unknown>).fieldCode = nextCode;
    changed = true;
  }

  const filters = Array.isArray(settings.filters)
    ? settings.filters.map((filter) => {
        if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
          return filter;
        }

        if ((filter as Record<string, unknown>).fieldCode !== previousCode) {
          return filter;
        }

        changed = true;
        return { ...(filter as Record<string, unknown>), fieldCode: nextCode };
      })
    : settings.filters;

  if (!changed) {
    return undefined;
  }

  const nextSettings: Record<string, unknown> = { ...settings, columns, filters };
  if (sort) {
    nextSettings.sort = sort;
  } else {
    delete nextSettings.sort;
  }

  return nextSettings;
}

function removeFieldCodeFromViewSettings(value: unknown, fieldCode: string) {
  const settings = toSettingsJson(value);

  if (!settings) {
    return undefined;
  }

  let changed = false;
  const columns = Array.isArray(settings.columns)
    ? settings.columns.filter((column) => {
        const keep = column !== fieldCode;
        if (!keep) {
          changed = true;
        }

        return keep;
      })
    : settings.columns;
  let sort =
    settings.sort && typeof settings.sort === "object" && !Array.isArray(settings.sort)
      ? { ...(settings.sort as Record<string, unknown>) }
      : settings.sort;

  if (
    sort &&
    typeof sort === "object" &&
    !Array.isArray(sort) &&
    (sort as Record<string, unknown>).fieldCode === fieldCode
  ) {
    changed = true;
    sort = undefined;
  }

  const filters = Array.isArray(settings.filters)
    ? settings.filters.filter((filter) => {
        const keep =
          !filter ||
          typeof filter !== "object" ||
          Array.isArray(filter) ||
          (filter as Record<string, unknown>).fieldCode !== fieldCode;
        if (!keep) {
          changed = true;
        }

        return keep;
      })
    : settings.filters;

  if (!changed) {
    return undefined;
  }

  const nextSettings: Record<string, unknown> = { ...settings, columns, filters };
  if (sort) {
    nextSettings.sort = sort;
  } else {
    delete nextSettings.sort;
  }

  return nextSettings;
}

function replaceFieldCodeInFormLayout(
  value: unknown,
  previousCode: string,
  nextCode: string
) {
  const layout = toSettingsJson(value);

  if (!layout || !Array.isArray(layout.fields)) {
    return undefined;
  }

  let changed = false;
  const fields = layout.fields.map((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      return field;
    }

    if ((field as Record<string, unknown>).fieldCode !== previousCode) {
      return field;
    }

    changed = true;
    return { ...(field as Record<string, unknown>), fieldCode: nextCode };
  });

  if (!changed) {
    return undefined;
  }

  return { ...layout, fields };
}

function removeFieldCodeFromFormLayout(value: unknown, fieldCode: string) {
  const layout = toSettingsJson(value);

  if (!layout || !Array.isArray(layout.fields)) {
    return undefined;
  }

  let changed = false;
  const fields = layout.fields.filter((field) => {
    const keep =
      !field ||
      typeof field !== "object" ||
      Array.isArray(field) ||
      (field as Record<string, unknown>).fieldCode !== fieldCode;

    if (!keep) {
      changed = true;
    }

    return keep;
  });

  if (!changed) {
    return undefined;
  }

  return { ...layout, fields };
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

  await recordAuditLog(user, {
    actionType: "APP_CREATE",
    resourceType: "app",
    resourceId: app.id,
    resourceName: app.name,
    detailJson: {
      code: app.code,
      status: app.status,
      icon: app.icon,
      description: app.description,
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

  await recordAuditLog(user, {
    actionType: "APP_UPDATE",
    resourceType: "app",
    resourceId: app.id,
    resourceName: app.name,
    detailJson: {
      before: {
        name: existingApp.name,
        code: existingApp.code,
        status: existingApp.status,
        icon: existingApp.icon,
        description: existingApp.description,
      },
      after: {
        name: app.name,
        code: app.code,
        status: app.status,
        icon: app.icon,
        description: app.description,
      },
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

  await recordAuditLog(user, {
    actionType: "APP_DELETE",
    resourceType: "app",
    resourceId: existingApp.id,
    resourceName: existingApp.name,
    detailJson: {
      code: existingApp.code,
      status: existingApp.status,
    },
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
  const app = await getAppOrThrow(user, appId);

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

  await recordAuditLog(user, {
    actionType: "TABLE_CREATE",
    resourceType: "table",
    resourceId: table.id,
    resourceName: table.name,
    detailJson: {
      appId: app.id,
      appName: app.name,
      appCode: app.code,
      code: table.code,
      isSystem: table.isSystem,
      sortOrder: table.sortOrder,
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
  const table = await prisma.$transaction(async (tx) => {
    const updatedTable = await tx.appTable.update({
      where: { id: existingTable.id },
      data: {
        name: nextName,
        code: nextCode,
        isSystem: input.isSystem ?? existingTable.isSystem,
        sortOrder: input.sortOrder ?? existingTable.sortOrder,
      },
    });

    if (existingTable.code === nextCode) {
      return updatedTable;
    }

    const referenceFields = await tx.appField.findMany({
      where: {
        tenantId: user.tenantId,
        appId,
        fieldType: "master_ref",
      },
      select: {
        id: true,
        settingsJson: true,
      },
    });

    const updateOperations = referenceFields.flatMap((field) => {
      const settings = toSettingsJson(field.settingsJson);
      if (!settings) {
        return [];
      }

      const referenceTableId = getReferenceTableId(settings);
      const referenceTableCode = getReferenceTableCode(settings);

      if (
        referenceTableId !== existingTable.id &&
        referenceTableCode !== existingTable.code
      ) {
        return [];
      }

      return [
        tx.appField.update({
          where: { id: field.id },
          data: {
            settingsJson: toJsonObject({
              ...settings,
              referenceTableId: existingTable.id,
              referenceTableCode: nextCode,
            }),
          },
        }),
      ];
    });

    await Promise.all(updateOperations);

    return updatedTable;
  });

  await recordAuditLog(user, {
    actionType: "TABLE_UPDATE",
    resourceType: "table",
    resourceId: table.id,
    resourceName: table.name,
    detailJson: {
      appId,
      before: {
        name: existingTable.name,
        code: existingTable.code,
        isSystem: existingTable.isSystem,
        sortOrder: existingTable.sortOrder,
      },
      after: {
        name: table.name,
        code: table.code,
        isSystem: table.isSystem,
        sortOrder: table.sortOrder,
      },
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
  const referenceFields = await prisma.appField.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
      fieldType: "master_ref",
    },
    select: {
      name: true,
      settingsJson: true,
    },
  });

  const blockingField = referenceFields.find((field) => {
    const settings = toSettingsJson(field.settingsJson);
    return (
      getReferenceTableId(settings) === existingTable.id ||
      getReferenceTableCode(settings) === existingTable.code
    );
  });

  if (blockingField) {
    throw new AppsServiceError(
      `参照フィールド「${blockingField.name}」がこのテーブルを使用しているため削除できません`,
      409
    );
  }

  await prisma.appTable.delete({
    where: { id: existingTable.id },
  });

  await recordAuditLog(user, {
    actionType: "TABLE_DELETE",
    resourceType: "table",
    resourceId: existingTable.id,
    resourceName: existingTable.name,
    detailJson: {
      appId,
      code: existingTable.code,
      isSystem: existingTable.isSystem,
      sortOrder: existingTable.sortOrder,
    },
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
  const table = await getTableOrThrow(user, appId, tableId);

  const name = assertNonEmpty(input.name, "Field name");
  const code = normalizeIdentifier(input.code ?? name, "_");

  if (!code) {
    throw new AppsServiceError("フィールドコードは必須です", 400);
  }

  await ensureUniqueFieldCode(user, appId, tableId, code);

  const fieldType = assertFieldType(input.fieldType);
  const settingsJson = await normalizeFieldSettings(
    user,
    appId,
    fieldType,
    input.settingsJson
  );
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
      settingsJson: toJsonObject(settingsJson),
      sortOrder: input.sortOrder ?? (await nextFieldSortOrder(tableId)),
    },
  });

  await recordAuditLog(user, {
    actionType: "FIELD_CREATE",
    resourceType: "field",
    resourceId: field.id,
    resourceName: field.name,
    detailJson: {
      appId,
      tableId: table.id,
      tableName: table.name,
      tableCode: table.code,
      code: field.code,
      fieldType: field.fieldType,
      required: field.required,
      uniqueFlag: field.uniqueFlag,
      settingsJson: toSettingsJson(field.settingsJson),
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
  const nextFieldType = input.fieldType
    ? assertFieldType(input.fieldType)
    : existingField.fieldType;

  if (
    nextFieldType === "master_ref" &&
    input.settingsJson === undefined &&
    existingField.fieldType !== "master_ref"
  ) {
    throw new AppsServiceError("参照先テーブルが指定されていません", 400);
  }

  const nextSettingsJson =
    input.settingsJson !== undefined
      ? await normalizeFieldSettings(user, appId, nextFieldType, input.settingsJson)
      : undefined;

  const prisma = getPrismaClient();
  const field = await prisma.$transaction(async (tx) => {
    const updatedField = await tx.appField.update({
      where: { id: existingField.id },
      data: {
        name: nextName,
        code: nextCode,
        fieldType: nextFieldType,
        required: input.required ?? existingField.required,
        uniqueFlag: input.uniqueFlag ?? existingField.uniqueFlag,
        ...(input.defaultValue !== undefined
          ? { defaultValue: toJsonValue(input.defaultValue) }
          : {}),
        ...(input.settingsJson !== undefined
          ? { settingsJson: toJsonObject(nextSettingsJson) }
          : {}),
        sortOrder: input.sortOrder ?? existingField.sortOrder,
      },
    });

    if (existingField.code !== nextCode) {
      const views = await tx.appView.findMany({
        where: {
          tenantId: user.tenantId,
          appId,
          tableId,
        },
        select: {
          id: true,
          settingsJson: true,
        },
      });
      const forms = await tx.appForm.findMany({
        where: {
          tenantId: user.tenantId,
          appId,
          tableId,
        },
        select: {
          id: true,
          layoutJson: true,
        },
      });
      const viewUpdateOperations = views.flatMap((view) => {
        const settingsJson = replaceFieldCodeInViewSettings(
          view.settingsJson,
          existingField.code,
          nextCode
        );

        return settingsJson
          ? [
              tx.appView.update({
                where: { id: view.id },
                data: { settingsJson: toJsonObject(settingsJson) },
              }),
            ]
          : [];
      });
      const formUpdateOperations = forms.flatMap((form) => {
        const layoutJson = replaceFieldCodeInFormLayout(
          form.layoutJson,
          existingField.code,
          nextCode
        );

        return layoutJson
          ? [
              tx.appForm.update({
                where: { id: form.id },
                data: { layoutJson: toJsonObject(layoutJson) },
              }),
            ]
          : [];
      });

      await Promise.all([...viewUpdateOperations, ...formUpdateOperations]);
    }

    return updatedField;
  });

  await recordAuditLog(user, {
    actionType: "FIELD_UPDATE",
    resourceType: "field",
    resourceId: field.id,
    resourceName: field.name,
    detailJson: {
      appId,
      tableId,
      before: {
        name: existingField.name,
        code: existingField.code,
        fieldType: existingField.fieldType,
        required: existingField.required,
        uniqueFlag: existingField.uniqueFlag,
        defaultValue: existingField.defaultValue,
        settingsJson: toSettingsJson(existingField.settingsJson),
        sortOrder: existingField.sortOrder,
      },
      after: {
        name: field.name,
        code: field.code,
        fieldType: field.fieldType,
        required: field.required,
        uniqueFlag: field.uniqueFlag,
        defaultValue: field.defaultValue,
        settingsJson: toSettingsJson(field.settingsJson),
        sortOrder: field.sortOrder,
      },
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
  await prisma.$transaction(async (tx) => {
    const views = await tx.appView.findMany({
      where: {
        tenantId: user.tenantId,
        appId,
        tableId,
      },
      select: {
        id: true,
        settingsJson: true,
      },
    });
    const forms = await tx.appForm.findMany({
      where: {
        tenantId: user.tenantId,
        appId,
        tableId,
      },
      select: {
        id: true,
        layoutJson: true,
      },
    });
    const viewUpdateOperations = views.flatMap((view) => {
      const settingsJson = removeFieldCodeFromViewSettings(
        view.settingsJson,
        existingField.code
      );

      return settingsJson
        ? [
            tx.appView.update({
              where: { id: view.id },
              data: { settingsJson: toJsonObject(settingsJson) },
            }),
          ]
          : [];
    });
    const formUpdateOperations = forms.flatMap((form) => {
      const layoutJson = removeFieldCodeFromFormLayout(
        form.layoutJson,
        existingField.code
      );

      return layoutJson
        ? [
            tx.appForm.update({
              where: { id: form.id },
              data: { layoutJson: toJsonObject(layoutJson) },
            }),
          ]
        : [];
    });

    await Promise.all([...viewUpdateOperations, ...formUpdateOperations]);
    await tx.appField.delete({
      where: { id: existingField.id },
    });
  });

  await recordAuditLog(user, {
    actionType: "FIELD_DELETE",
    resourceType: "field",
    resourceId: existingField.id,
    resourceName: existingField.name,
    detailJson: {
      appId,
      tableId,
      code: existingField.code,
      fieldType: existingField.fieldType,
      required: existingField.required,
      uniqueFlag: existingField.uniqueFlag,
      settingsJson: toSettingsJson(existingField.settingsJson),
    },
  });
}

export async function listViewsForTable(
  user: User,
  appId: string,
  tableId: string
) {
  await ensureDemoBuilderData();
  await getTableOrThrow(user, appId, tableId);

  const prisma = getPrismaClient();
  const views = await prisma.appView.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return views.map((view) =>
    toAppView(view as typeof view & { viewType: AppViewType })
  );
}

export async function getViewForTable(
  user: User,
  appId: string,
  tableId: string,
  viewId: string
) {
  await ensureDemoBuilderData();
  const view = await getViewOrThrow(user, appId, tableId, viewId);
  return toAppView(view as typeof view & { viewType: AppViewType });
}

export async function createViewForTable(
  user: User,
  appId: string,
  tableId: string,
  input: CreateViewInput
) {
  await ensureDemoBuilderData();
  const table = await getTableOrThrow(user, appId, tableId);
  const name = assertNonEmpty(input.name, "View name");
  const viewType = input.viewType ? assertViewType(input.viewType) : "list";

  await ensureUniqueViewName(user, appId, tableId, name);

  const settingsJson = await normalizeViewSettings(
    user,
    appId,
    tableId,
    input.settingsJson
  );
  const prisma = getPrismaClient();
  const view = await prisma.appView.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId,
      tableId,
      name,
      viewType,
      settingsJson: toJsonObject(settingsJson),
      sortOrder: input.sortOrder ?? (await nextViewSortOrder(tableId)),
    },
  });

  await recordAuditLog(user, {
    actionType: "VIEW_CREATE",
    resourceType: "view",
    resourceId: view.id,
    resourceName: view.name,
    detailJson: {
      appId,
      tableId: table.id,
      tableName: table.name,
      tableCode: table.code,
      viewType: view.viewType,
      settingsJson: toSettingsJson(view.settingsJson),
      sortOrder: view.sortOrder,
    },
  });

  return toAppView(view as typeof view & { viewType: AppViewType });
}

export async function updateViewForTable(
  user: User,
  appId: string,
  tableId: string,
  viewId: string,
  input: UpdateViewInput
) {
  await ensureDemoBuilderData();
  const existingView = await getViewOrThrow(user, appId, tableId, viewId);
  const nextName = input.name?.trim() || existingView.name;
  const nextViewType = input.viewType
    ? assertViewType(input.viewType)
    : existingView.viewType;

  if (!nextName) {
    throw new AppsServiceError("ビュー名は必須です。", 400);
  }

  if (nextName !== existingView.name) {
    await ensureUniqueViewName(user, appId, tableId, nextName, existingView.id);
  }

  const nextSettingsJson =
    input.settingsJson !== undefined
      ? await normalizeViewSettings(user, appId, tableId, input.settingsJson)
      : undefined;

  const prisma = getPrismaClient();
  const view = await prisma.appView.update({
    where: { id: existingView.id },
    data: {
      name: nextName,
      viewType: nextViewType,
      ...(input.settingsJson !== undefined
        ? { settingsJson: toJsonObject(nextSettingsJson) }
        : {}),
      sortOrder: input.sortOrder ?? existingView.sortOrder,
    },
  });

  await recordAuditLog(user, {
    actionType: "VIEW_UPDATE",
    resourceType: "view",
    resourceId: view.id,
    resourceName: view.name,
    detailJson: {
      appId,
      tableId,
      before: {
        name: existingView.name,
        viewType: existingView.viewType,
        settingsJson: toSettingsJson(existingView.settingsJson),
        sortOrder: existingView.sortOrder,
      },
      after: {
        name: view.name,
        viewType: view.viewType,
        settingsJson: toSettingsJson(view.settingsJson),
        sortOrder: view.sortOrder,
      },
    },
  });

  return toAppView(view as typeof view & { viewType: AppViewType });
}

export async function deleteViewForTable(
  user: User,
  appId: string,
  tableId: string,
  viewId: string
) {
  await ensureDemoBuilderData();
  const existingView = await getViewOrThrow(user, appId, tableId, viewId);
  const prisma = getPrismaClient();

  await prisma.appView.delete({
    where: { id: existingView.id },
  });

  await recordAuditLog(user, {
    actionType: "VIEW_DELETE",
    resourceType: "view",
    resourceId: existingView.id,
    resourceName: existingView.name,
    detailJson: {
      appId,
      tableId,
      viewType: existingView.viewType,
      settingsJson: toSettingsJson(existingView.settingsJson),
      sortOrder: existingView.sortOrder,
    },
  });
}

export async function listFormsForTable(
  user: User,
  appId: string,
  tableId: string
) {
  await ensureDemoBuilderData();
  await getTableOrThrow(user, appId, tableId);

  const prisma = getPrismaClient();
  const forms = await prisma.appForm.findMany({
    where: {
      tenantId: user.tenantId,
      appId,
      tableId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return forms.map(toAppForm);
}

export async function getFormForTable(
  user: User,
  appId: string,
  tableId: string,
  formId: string
) {
  await ensureDemoBuilderData();
  const form = await getFormOrThrow(user, appId, tableId, formId);
  return toAppForm(form);
}

export async function createFormForTable(
  user: User,
  appId: string,
  tableId: string,
  input: CreateFormInput
) {
  await ensureDemoBuilderData();
  const table = await getTableOrThrow(user, appId, tableId);
  const name = assertNonEmpty(input.name, "Form name");

  await ensureUniqueFormName(user, appId, tableId, name);

  const layoutJson = await normalizeFormLayout(
    user,
    appId,
    tableId,
    input.layoutJson
  );
  const prisma = getPrismaClient();
  const form = await prisma.appForm.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      appId,
      tableId,
      name,
      layoutJson: toJsonObject(layoutJson),
      sortOrder: input.sortOrder ?? (await nextFormSortOrder(tableId)),
    },
  });

  await recordAuditLog(user, {
    actionType: "FORM_CREATE",
    resourceType: "form",
    resourceId: form.id,
    resourceName: form.name,
    detailJson: {
      appId,
      tableId: table.id,
      tableName: table.name,
      tableCode: table.code,
      layoutJson: toLayoutJson(form.layoutJson),
      sortOrder: form.sortOrder,
    },
  });

  return toAppForm(form);
}

export async function updateFormForTable(
  user: User,
  appId: string,
  tableId: string,
  formId: string,
  input: UpdateFormInput
) {
  await ensureDemoBuilderData();
  const existingForm = await getFormOrThrow(user, appId, tableId, formId);
  const nextName = input.name?.trim() || existingForm.name;

  if (!nextName) {
    throw new AppsServiceError("フォーム名は必須です。", 400);
  }

  if (nextName !== existingForm.name) {
    await ensureUniqueFormName(user, appId, tableId, nextName, existingForm.id);
  }

  const nextLayoutJson =
    input.layoutJson !== undefined
      ? await normalizeFormLayout(user, appId, tableId, input.layoutJson)
      : undefined;

  const prisma = getPrismaClient();
  const form = await prisma.appForm.update({
    where: { id: existingForm.id },
    data: {
      name: nextName,
      ...(input.layoutJson !== undefined
        ? { layoutJson: toJsonObject(nextLayoutJson) }
        : {}),
      sortOrder: input.sortOrder ?? existingForm.sortOrder,
    },
  });

  await recordAuditLog(user, {
    actionType: "FORM_UPDATE",
    resourceType: "form",
    resourceId: form.id,
    resourceName: form.name,
    detailJson: {
      appId,
      tableId,
      before: {
        name: existingForm.name,
        layoutJson: toLayoutJson(existingForm.layoutJson),
        sortOrder: existingForm.sortOrder,
      },
      after: {
        name: form.name,
        layoutJson: toLayoutJson(form.layoutJson),
        sortOrder: form.sortOrder,
      },
    },
  });

  return toAppForm(form);
}

export async function deleteFormForTable(
  user: User,
  appId: string,
  tableId: string,
  formId: string
) {
  await ensureDemoBuilderData();
  const existingForm = await getFormOrThrow(user, appId, tableId, formId);
  const prisma = getPrismaClient();

  await prisma.appForm.delete({
    where: { id: existingForm.id },
  });

  await recordAuditLog(user, {
    actionType: "FORM_DELETE",
    resourceType: "form",
    resourceId: existingForm.id,
    resourceName: existingForm.name,
    detailJson: {
      appId,
      tableId,
      layoutJson: toLayoutJson(existingForm.layoutJson),
      sortOrder: existingForm.sortOrder,
    },
  });
}
