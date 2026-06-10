import { recordAuditLog } from "@/server/audit/service";
import {
  generateJsonWithModelGateway,
  type ModelGatewayClientLike,
} from "@/server/ai/model-gateway";
import {
  AppsServiceError,
  createFieldForTable,
  createFormForTable,
  createViewForTable,
  getAppForUser,
  listFieldsForTable,
  listFormsForTable,
  listTablesForApp,
  listViewsForTable,
  updateFieldForTable,
} from "@/server/apps/service";
import type { AppField, AppForm, AppTable, AppView, AppViewType, FieldType } from "@/types/app";
import type {
  AppRefinementChange,
  AppRefinementOperation,
  AppRefinementPreview,
  AppRefinementResult,
} from "@/types/app-refinement";
import type { User } from "@/types/user";

const OPENAI_MODEL = "gpt-5-mini";
const MAX_REFINEMENT_OPERATIONS = 8;
const REFINEMENT_FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "user_ref",
  "file",
  "ai_generated",
  "calculated",
];
const REFINEMENT_VIEW_TYPES: AppViewType[] = [
  "list",
  "kanban",
  "calendar",
  "chart",
  "kpi",
];

const APP_REFINEMENT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "operations"],
  properties: {
    summary: { type: "string" },
    operations: {
      type: "array",
      maxItems: MAX_REFINEMENT_OPERATIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "action",
          "tableCode",
          "tableName",
          "fieldCode",
          "fieldName",
          "fieldType",
          "setRequired",
          "required",
          "options",
          "viewName",
          "viewType",
          "columns",
          "groupByFieldCode",
          "dateFieldCode",
          "metricFieldCode",
          "formName",
          "formFieldCodes",
          "helpText",
        ],
        properties: {
          action: {
            type: "string",
            enum: ["add_field", "update_field", "add_view", "add_form"],
          },
          tableCode: { type: "string" },
          tableName: { type: "string" },
          fieldCode: { type: "string" },
          fieldName: { type: "string" },
          fieldType: {
            type: "string",
            enum: ["", ...REFINEMENT_FIELD_TYPES],
          },
          setRequired: { type: "boolean" },
          required: { type: "boolean" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          viewName: { type: "string" },
          viewType: {
            type: "string",
            enum: REFINEMENT_VIEW_TYPES,
          },
          columns: {
            type: "array",
            items: { type: "string" },
          },
          groupByFieldCode: { type: "string" },
          dateFieldCode: { type: "string" },
          metricFieldCode: { type: "string" },
          formName: { type: "string" },
          formFieldCodes: {
            type: "array",
            items: { type: "string" },
          },
          helpText: { type: "string" },
        },
      },
    },
  },
} as const;

const REFINEMENT_INSTRUCTIONS = [
  "You refine an existing internal business app from a Japanese or English natural-language instruction.",
  "Return JSON only.",
  "Use only the provided tableCode and field codes unless creating a new field.",
  "Prefer the current active table when the user does not name a table.",
  "Use kebab-case for new tableCode and snake_case for new field codes.",
  "Do not delete tables, fields, views, forms, or records.",
  "Never create tables. Every app has exactly one table; add fields, views, or forms to the existing table instead.",
  "Use add_field for new fields, update_field for changing an existing field name/required/type/options, add_view for new runtime views, and add_form for new forms.",
  "For unused operation fields, return an empty string, empty array, or false. For viewType on non-view operations, use list.",
  "For update_field, set setRequired to true only when the instruction explicitly changes whether the field is required.",
  "Keep operations small and directly tied to the instruction.",
].join(" ");

type RawRefinementResponse = {
  summary: string;
  operations: AppRefinementOperation[];
};

type TableContext = {
  table: AppTable;
  fields: AppField[];
  views: AppView[];
  forms: AppForm[];
};

function assertObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppsServiceError(message, 400);
  }

  return value as Record<string, unknown>;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function parseOpenAIResponse(response: { outputText?: string }) {
  const raw = response.outputText?.trim();

  if (!raw) {
    throw new AppsServiceError("OpenAI returned an empty refinement response", 502);
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppsServiceError("OpenAI returned invalid refinement JSON", 502);
  }
}

function normalizeRawOperation(value: unknown): AppRefinementOperation | null {
  const operation = assertObject(value, "Refinement operation is invalid");
  const action = normalizeString(operation.action);

  if (
    action !== "add_field" &&
    action !== "update_field" &&
    action !== "add_view" &&
    action !== "add_form"
  ) {
    return null;
  }

  const rawFieldType = normalizeString(operation.fieldType);
  const fieldType = REFINEMENT_FIELD_TYPES.includes(rawFieldType as FieldType)
    ? (rawFieldType as FieldType)
    : "";
  const rawViewType = normalizeString(operation.viewType);
  const viewType = REFINEMENT_VIEW_TYPES.includes(rawViewType as AppViewType)
    ? (rawViewType as AppViewType)
    : "list";

  return {
    action,
    tableCode: normalizeString(operation.tableCode),
    tableName: normalizeString(operation.tableName),
    fieldCode: normalizeString(operation.fieldCode),
    fieldName: normalizeString(operation.fieldName),
    fieldType,
    setRequired: operation.setRequired === true,
    required: operation.required === true,
    options: normalizeStringArray(operation.options),
    viewName: normalizeString(operation.viewName),
    viewType,
    columns: normalizeStringArray(operation.columns),
    groupByFieldCode: normalizeString(operation.groupByFieldCode),
    dateFieldCode: normalizeString(operation.dateFieldCode),
    metricFieldCode: normalizeString(operation.metricFieldCode),
    formName: normalizeString(operation.formName),
    formFieldCodes: normalizeStringArray(operation.formFieldCodes),
    helpText: normalizeString(operation.helpText),
  };
}

function normalizeRefinementResponse(value: unknown): RawRefinementResponse {
  const response = assertObject(value, "Refinement response is invalid");
  const summary = normalizeString(response.summary);

  if (!summary) {
    throw new AppsServiceError("Refinement summary is required", 400);
  }

  const operations = Array.isArray(response.operations)
    ? response.operations
        .map(normalizeRawOperation)
        .filter((operation): operation is AppRefinementOperation => operation !== null)
        .slice(0, MAX_REFINEMENT_OPERATIONS)
    : [];

  return { summary, operations };
}

function getFieldOptions(field: AppField) {
  const options = field.settingsJson?.options;

  return Array.isArray(options)
    ? options.filter((option): option is string => typeof option === "string")
    : [];
}

function buildPromptInput(input: {
  instruction: string;
  activeTableCode?: string;
  app: { name: string; code: string; description?: string };
  tables: TableContext[];
}) {
  return JSON.stringify(
    {
      instruction: input.instruction,
      activeTableCode: input.activeTableCode,
      app: input.app,
      tables: input.tables.map(({ table, fields, views, forms }) => ({
        name: table.name,
        code: table.code,
        fields: fields.map((field) => ({
          name: field.name,
          code: field.code,
          fieldType: field.fieldType,
          required: field.required,
          options: getFieldOptions(field),
        })),
        views: views.map((view) => ({
          name: view.name,
          viewType: view.viewType,
          settingsJson: view.settingsJson ?? {},
        })),
        forms: forms.map((form) => ({
          name: form.name,
          layoutJson: form.layoutJson ?? {},
        })),
      })),
    },
    null,
    2
  );
}

function getTableForOperation(
  operation: AppRefinementOperation,
  tables: TableContext[],
  activeTableCode?: string
) {
  const tableCode = operation.tableCode || activeTableCode || tables[0]?.table.code;
  const tableContext = tables.find((item) => item.table.code === tableCode);

  if (!tableContext) {
    throw new AppsServiceError(`Table "${tableCode}" was not found`, 400);
  }

  return tableContext;
}

function getFieldByCode(tableContext: TableContext, fieldCode: string) {
  const field = tableContext.fields.find((item) => item.code === fieldCode);

  if (!field) {
    throw new AppsServiceError(
      `Field "${fieldCode}" was not found in table "${tableContext.table.code}"`,
      400
    );
  }

  return field;
}

function normalizeFieldCodes(fieldCodes: string[], tableContext: TableContext) {
  const availableCodes = new Set(tableContext.fields.map((field) => field.code));
  const normalized = fieldCodes.filter((fieldCode) => availableCodes.has(fieldCode));

  return normalized.length > 0
    ? normalized
    : tableContext.fields.slice(0, 4).map((field) => field.code);
}

function getFormWidth(field: AppField) {
  return field.fieldType === "textarea" ? "full" : "half";
}

function cloneTableContexts(tables: TableContext[]): TableContext[] {
  return tables.map(({ table, fields, views, forms }) => ({
    table,
    fields: [...fields],
    views: [...views],
    forms: [...forms],
  }));
}

function getPreviewCreatedAt() {
  return "1970-01-01T00:00:00.000Z";
}

function makePreviewField(
  tableContext: TableContext,
  operation: AppRefinementOperation
): AppField {
  const name = operation.fieldName || operation.fieldCode;
  const code = operation.fieldCode || operation.fieldName;

  if (!name || !code) {
    throw new AppsServiceError("追加するフィールド名またはコードが不足しています。", 400);
  }

  return {
    id: `preview-field-${tableContext.table.code}-${code}`,
    tenantId: tableContext.table.tenantId,
    appId: tableContext.table.appId,
    tableId: tableContext.table.id,
    name,
    code,
    fieldType: operation.fieldType || "text",
    required: operation.required,
    uniqueFlag: false,
    settingsJson:
      operation.fieldType === "select" ? { options: operation.options } : undefined,
    sortOrder: tableContext.fields.length,
    createdAt: getPreviewCreatedAt(),
  };
}

function getOperationTableName(
  operation: AppRefinementOperation,
  tableContext: TableContext
) {
  return operation.tableName || tableContext.table.name;
}

function assertOptionalViewField(
  tableContext: TableContext,
  fieldCode: string,
  label: string,
  allowedTypes?: FieldType[]
) {
  if (!fieldCode) {
    return;
  }

  const field = tableContext.fields.find((item) => item.code === fieldCode);
  if (!field) {
    throw new AppsServiceError(
      `${label} "${fieldCode}" がテーブル "${tableContext.table.code}" に存在しません。`,
      400
    );
  }

  if (allowedTypes && !allowedTypes.includes(field.fieldType)) {
    throw new AppsServiceError(
      `${label} "${fieldCode}" は利用できないフィールド型です。`,
      400
    );
  }
}

async function loadAppContext(user: User, appId: string) {
  const app = await getAppForUser(user, appId);
  const tables = await listTablesForApp(user, appId);
  const tableContexts = await Promise.all(
    tables.map(async (table) => ({
      table,
      fields: await listFieldsForTable(user, appId, table.id),
      views: await listViewsForTable(user, appId, table.id),
      forms: await listFormsForTable(user, appId, table.id),
    }))
  );

  return { app, tables: tableContexts };
}

async function requestRefinementPlan(
  user: Pick<User, "id" | "tenantId" | "name" | "email">,
  appId: string,
  client: ModelGatewayClientLike | undefined,
  input: string
): Promise<RawRefinementResponse> {
  const response = await generateJsonWithModelGateway({
    user,
    appId,
    operation: "app_refinement.preview",
    model: OPENAI_MODEL,
    instructions: REFINEMENT_INSTRUCTIONS,
    input,
    responseFormatName: "app_refinement_operations",
    responseSchema: APP_REFINEMENT_RESPONSE_SCHEMA,
    metadata: {
      inputLength: input.length,
    },
  }, client);

  return normalizeRefinementResponse(parseOpenAIResponse(response));
}

function buildPreviewChanges(input: {
  appId: string;
  operations: AppRefinementOperation[];
  tables: TableContext[];
  activeTableCode?: string;
}) {
  const tables = cloneTableContexts(input.tables);
  const changes: AppRefinementChange[] = [];

  for (const operation of input.operations) {
    const tableContext = getTableForOperation(
      operation,
      tables,
      input.activeTableCode
    );

    if (operation.action === "add_field") {
      const field = makePreviewField(tableContext, operation);
      tableContext.fields.push(field);
      changes.push({
        type: "field_created",
        tableCode: tableContext.table.code,
        tableName: tableContext.table.name,
        resourceName: field.name,
        description: `${tableContext.table.name} にフィールド「${field.name}」を追加します。`,
      });
      continue;
    }

    if (operation.action === "update_field") {
      const existingField = getFieldByCode(tableContext, operation.fieldCode);
      const updatedField: AppField = {
        ...existingField,
        name: operation.fieldName || existingField.name,
        fieldType: operation.fieldType || existingField.fieldType,
        required: operation.setRequired ? operation.required : existingField.required,
        settingsJson:
          operation.fieldType === "select"
            ? {
                options:
                  operation.options.length > 0
                    ? operation.options
                    : getFieldOptions(existingField),
              }
            : existingField.settingsJson,
      };
      tableContext.fields = tableContext.fields.map((field) =>
        field.id === existingField.id ? updatedField : field
      );
      changes.push({
        type: "field_updated",
        tableCode: tableContext.table.code,
        tableName: tableContext.table.name,
        resourceName: updatedField.name,
        description: `${tableContext.table.name} のフィールド「${updatedField.name}」を更新します。`,
      });
      continue;
    }

    if (operation.action === "add_view") {
      normalizeFieldCodes(operation.columns, tableContext);
      assertOptionalViewField(tableContext, operation.groupByFieldCode, "グループ化フィールド");
      assertOptionalViewField(tableContext, operation.dateFieldCode, "日付フィールド", [
        "date",
        "datetime",
      ]);
      assertOptionalViewField(tableContext, operation.metricFieldCode, "指標フィールド", [
        "number",
      ]);
      const viewName = operation.viewName || `${getOperationTableName(operation, tableContext)} ビュー`;
      changes.push({
        type: "view_created",
        tableCode: tableContext.table.code,
        tableName: tableContext.table.name,
        resourceName: viewName,
        description: `${tableContext.table.name} にビュー「${viewName}」を追加します。`,
      });
      continue;
    }

    if (operation.action === "add_form") {
      normalizeFieldCodes(operation.formFieldCodes, tableContext);
      const formName = operation.formName || `${getOperationTableName(operation, tableContext)} フォーム`;
      changes.push({
        type: "form_created",
        tableCode: tableContext.table.code,
        tableName: tableContext.table.name,
        resourceName: formName,
        description: `${tableContext.table.name} にフォーム「${formName}」を追加します。`,
      });
    }
  }

  return changes;
}

async function applyOperation(input: {
  user: User;
  appId: string;
  operation: AppRefinementOperation;
  tables: TableContext[];
  activeTableCode?: string;
}): Promise<AppRefinementChange | null> {
  const { user, appId, operation, tables, activeTableCode } = input;

  const tableContext = getTableForOperation(operation, tables, activeTableCode);

  if (operation.action === "add_field") {
    const field = await createFieldForTable(user, appId, tableContext.table.id, {
      name: operation.fieldName || operation.fieldCode,
      code: operation.fieldCode || undefined,
      fieldType: operation.fieldType || "text",
      required: operation.required,
      settingsJson:
        operation.fieldType === "select" ? { options: operation.options } : undefined,
    });

    tableContext.fields.push(field);

    return {
      type: "field_created",
      tableCode: tableContext.table.code,
      tableName: tableContext.table.name,
      resourceName: field.name,
      description: `${tableContext.table.name} にフィールド「${field.name}」を追加しました。`,
    };
  }

  if (operation.action === "update_field") {
    const existingField = getFieldByCode(tableContext, operation.fieldCode);
    const settingsJson =
      operation.fieldType === "select"
        ? { options: operation.options.length > 0 ? operation.options : getFieldOptions(existingField) }
        : undefined;
    const field = await updateFieldForTable(
      user,
      appId,
      tableContext.table.id,
      existingField.id,
      {
        name: operation.fieldName || undefined,
        fieldType: operation.fieldType || undefined,
        ...(operation.setRequired ? { required: operation.required } : {}),
        ...(settingsJson ? { settingsJson } : {}),
      }
    );

    tableContext.fields = tableContext.fields.map((item) =>
      item.id === field.id ? field : item
    );

    return {
      type: "field_updated",
      tableCode: tableContext.table.code,
      tableName: tableContext.table.name,
      resourceName: field.name,
      description: `${tableContext.table.name} のフィールド「${field.name}」を更新しました。`,
    };
  }

  if (operation.action === "add_view") {
    const settingsJson: Record<string, unknown> = {
      columns: normalizeFieldCodes(operation.columns, tableContext),
      ...(operation.groupByFieldCode ? { groupByFieldCode: operation.groupByFieldCode } : {}),
      ...(operation.dateFieldCode ? { dateFieldCode: operation.dateFieldCode } : {}),
      ...(operation.metricFieldCode ? { metricFieldCode: operation.metricFieldCode } : {}),
    };
    const view = await createViewForTable(user, appId, tableContext.table.id, {
      name: operation.viewName || `${tableContext.table.name} ビュー`,
      viewType: operation.viewType,
      settingsJson,
    });

    tableContext.views.push(view);

    return {
      type: "view_created",
      tableCode: tableContext.table.code,
      tableName: tableContext.table.name,
      resourceName: view.name,
      description: `${tableContext.table.name} にビュー「${view.name}」を追加しました。`,
    };
  }

  if (operation.action === "add_form") {
    const fieldCodes = normalizeFieldCodes(operation.formFieldCodes, tableContext);
    const fieldByCode = new Map(tableContext.fields.map((field) => [field.code, field]));
    const form = await createFormForTable(user, appId, tableContext.table.id, {
      name: operation.formName || `${tableContext.table.name} フォーム`,
      layoutJson: {
        fields: fieldCodes.flatMap((fieldCode) => {
          const field = fieldByCode.get(fieldCode);
          if (!field) {
            return [];
          }

          return [
            {
              fieldCode,
              visible: true,
              required: field.required,
              width: getFormWidth(field),
              ...(operation.helpText ? { helpText: operation.helpText } : {}),
            },
          ];
        }),
      },
    });

    tableContext.forms.push(form);

    return {
      type: "form_created",
      tableCode: tableContext.table.code,
      tableName: tableContext.table.name,
      resourceName: form.name,
      description: `${tableContext.table.name} にフォーム「${form.name}」を追加しました。`,
    };
  }

  return null;
}

export async function refineAppWithAI(
  user: User,
  appId: string,
  input: { instruction?: string; activeTableCode?: string },
  client?: ModelGatewayClientLike
): Promise<AppRefinementResult> {
  const preview = await generateAppRefinementPreview(user, appId, input, client);

  return applyAppRefinementPreview(user, appId, {
    instruction: input.instruction,
    activeTableCode: input.activeTableCode,
    summary: preview.summary,
    operations: preview.operations,
  });
}

export async function generateAppRefinementPreview(
  user: User,
  appId: string,
  input: { instruction?: string; activeTableCode?: string },
  client?: ModelGatewayClientLike
): Promise<AppRefinementPreview> {
  const instruction = input.instruction?.trim();

  if (!instruction) {
    throw new AppsServiceError("AIへの修正指示を入力してください。", 400);
  }

  const { app, tables } = await loadAppContext(user, appId);
  const plan = await requestRefinementPlan(
    user,
    appId,
    client,
    buildPromptInput({
      instruction,
      activeTableCode: input.activeTableCode,
      app: {
        name: app.name,
        code: app.code,
        description: app.description,
      },
      tables,
    })
  );

  return {
    summary: plan.summary,
    operations: plan.operations,
    changes: buildPreviewChanges({
      appId,
      operations: plan.operations,
      tables,
      activeTableCode: input.activeTableCode,
    }),
  };
}

export async function applyAppRefinementPreview(
  user: User,
  appId: string,
  input: {
    instruction?: string;
    activeTableCode?: string;
    summary?: string;
    operations?: unknown;
  }
): Promise<AppRefinementResult> {
  const plan = normalizeRefinementResponse({
    summary: input.summary || "AI修正を適用しました。",
    operations: input.operations,
  });

  if (plan.operations.length === 0) {
    throw new AppsServiceError("適用できるAI修正案がありません。", 400);
  }

  const { app, tables } = await loadAppContext(user, appId);
  buildPreviewChanges({
    appId,
    operations: plan.operations,
    tables,
    activeTableCode: input.activeTableCode,
  });

  const changes: AppRefinementChange[] = [];
  for (const operation of plan.operations) {
    const change = await applyOperation({
      user,
      appId,
      operation,
      tables,
      activeTableCode: input.activeTableCode,
    });

    if (change) {
      changes.push(change);
    }
  }

  await recordAuditLog(user, {
    actionType: "APP_REFINE",
    resourceType: "app",
    resourceId: app.id,
    resourceName: app.name,
    detailJson: {
      instruction: input.instruction?.trim() || undefined,
      summary: plan.summary,
      changes,
    },
    aiInvolvement: "assisted",
  });

  return {
    summary: plan.summary,
    changes,
  };
}

export {
  APP_REFINEMENT_RESPONSE_SCHEMA,
  MAX_REFINEMENT_OPERATIONS,
  REFINEMENT_INSTRUCTIONS,
};
