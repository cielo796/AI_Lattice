import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";
import { getOpenAIClient } from "@/server/openai/client";
import { AppsServiceError } from "@/server/apps/service";
import type { Prisma } from "@prisma/client";
import type { App } from "@/types/app";
import type {
  GeneratedAppBlueprint,
  GeneratedBlueprintField,
  GeneratedBlueprintFieldType,
  GeneratedBlueprintTable,
} from "@/types/ai";
import type { User } from "@/types/user";

const MAX_TABLES = 3;
const MAX_FIELDS_PER_TABLE = 10;
const SAMPLE_RECORDS_PER_TABLE = 3;
const GENERATED_BLUEPRINT_FIELD_TYPES: GeneratedBlueprintFieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
];
const OPENAI_MODEL = "gpt-5-mini";

const BLUEPRINT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "code", "description", "aiInsight", "tables"],
  properties: {
    name: { type: "string" },
    code: { type: "string" },
    description: { type: "string" },
    aiInsight: { type: "string" },
    tables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "code", "fields"],
        properties: {
          name: { type: "string" },
          code: { type: "string" },
          fields: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "code", "fieldType", "required", "options"],
              properties: {
                name: { type: "string" },
                code: { type: "string" },
                fieldType: {
                  type: "string",
                  enum: GENERATED_BLUEPRINT_FIELD_TYPES,
                },
                required: { type: "boolean" },
                options: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const GENERATION_INSTRUCTIONS = [
  "You generate internal business app blueprints.",
  "Return JSON only.",
  "Generate a compact but useful first version of the app.",
  `Create between 1 and ${MAX_TABLES} tables.`,
  `Create between 1 and ${MAX_FIELDS_PER_TABLE} fields per table.`,
  "Use only these field types: text, textarea, number, date, datetime, boolean, select.",
  "Use snake_case field codes and kebab-case app and table codes.",
  "Use Japanese for display names, descriptions, and AI insights when the prompt is Japanese. Keep all code fields ASCII.",
  "Only select fields may include options; all other fields must use an empty options array.",
  "Do not generate workflows or views.",
  "Choose clear business-friendly names and descriptions.",
].join(" ");

const REPAIR_INSTRUCTIONS = [
  "Repair the previous invalid blueprint into valid JSON that matches the schema exactly.",
  "Keep the same business intent and stay within the same field type restrictions.",
  "Return JSON only.",
].join(" ");

class InvalidGeneratedBlueprintError extends AppsServiceError {}

type OpenAIClientLike = {
  responses: {
    create: (params: {
      model: string;
      instructions: string;
      input: string;
      text: {
        format: {
          type: "json_schema";
          name: string;
          strict: true;
          schema: typeof BLUEPRINT_RESPONSE_SCHEMA;
        };
      };
    }) => Promise<{
      output_text?: string;
    }>;
  };
};

function normalizeIdentifier(value: string, separator: "-" | "_") {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}+`, "g"), separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, "g"), "");
}

function getSampleRecordCode(tableCode: string, recordIndex: number) {
  const prefix = normalizeIdentifier(tableCode, "_").toUpperCase() || "RECORD";
  return `${prefix}-${String(recordIndex + 1).padStart(3, "0")}`;
}

function getStringSampleValue(
  blueprint: GeneratedAppBlueprint,
  table: GeneratedBlueprintTable,
  field: GeneratedBlueprintField,
  recordIndex: number
) {
  const code = field.code.toLowerCase();
  const values = {
    people: ["田中 太郎", "佐藤 花子", "鈴木 一郎"],
    departments: ["営業部", "開発部", "管理部"],
    companies: ["Acme 株式会社", "Nexus Systems", "GlobalTech 株式会社"],
    items: ["交通費精算", "会議用備品購入", "顧客訪問出張費"],
  };

  if (code === "id" || code.endsWith("_id") || code.endsWith("-id")) {
    return getSampleRecordCode(table.code, recordIndex);
  }

  if (
    code.includes("applicant") ||
    code.includes("requester") ||
    code.includes("employee") ||
    code.includes("user")
  ) {
    return values.people[recordIndex % values.people.length];
  }

  if (code.includes("department") || code.includes("team")) {
    return values.departments[recordIndex % values.departments.length];
  }

  if (code.includes("customer") || code.includes("client") || code.includes("company")) {
    return values.companies[recordIndex % values.companies.length];
  }

  if (
    code.includes("item") ||
    code.includes("title") ||
    code.includes("subject") ||
    code.includes("name")
  ) {
    return values.items[recordIndex % values.items.length];
  }

  if (code.includes("email")) {
    return `sample${recordIndex + 1}@example.com`;
  }

  if (code.includes("phone") || code.includes("tel")) {
    return `03-0000-000${recordIndex + 1}`;
  }

  return `${blueprint.name} ${field.name} ${recordIndex + 1}`;
}

function getSampleDateValue(recordIndex: number) {
  const day = 22 + recordIndex;
  return `2026-04-${String(day).padStart(2, "0")}`;
}

function getSampleFieldValue(
  blueprint: GeneratedAppBlueprint,
  table: GeneratedBlueprintTable,
  field: GeneratedBlueprintField,
  recordIndex: number
) {
  switch (field.fieldType) {
    case "text":
      return getStringSampleValue(blueprint, table, field, recordIndex);
    case "textarea":
      return `${table.name}のサンプルレコードです。内容確認、承認、履歴確認の動作テストに利用できます。`;
    case "number":
      return [12800, 3540, 89000][recordIndex % 3];
    case "date":
      return getSampleDateValue(recordIndex);
    case "datetime":
      return `${getSampleDateValue(recordIndex)}T09:00:00.000Z`;
    case "boolean":
      return recordIndex % 2 === 0;
    case "select":
      return field.options?.[recordIndex % field.options.length] ?? "";
    default:
      return "";
  }
}

function buildSampleRecordData(
  blueprint: GeneratedAppBlueprint,
  table: GeneratedBlueprintTable,
  recordIndex: number
) {
  const data = Object.fromEntries(
    table.fields.map((field) => [
      field.code,
      getSampleFieldValue(blueprint, table, field, recordIndex),
    ])
  ) as Record<string, unknown>;

  if (!("id" in data) && !("code" in data) && !("ticket_id" in data)) {
    data.id = getSampleRecordCode(table.code, recordIndex);
  }

  if (!("title" in data) && !("subject" in data) && !("name" in data)) {
    data.title = `${table.name} サンプル ${recordIndex + 1}`;
  }

  return data;
}

function getSampleRecordStatus(data: Record<string, unknown>, recordIndex: number) {
  for (const key of ["status", "approval_status", "state"]) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return ["pending", "active", "approved"][recordIndex % 3];
}

function toJsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

function assertObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppsServiceError(message, 400);
  }

  return value as Record<string, unknown>;
}

function assertString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppsServiceError(`${fieldName} is required`, 400);
  }

  return value.trim();
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGeneratedField(
  value: unknown,
  index: number
): GeneratedBlueprintField {
  const field = assertObject(value, `Field ${index + 1} is invalid`);
  const name = assertString(field.name, `Field ${index + 1} name`);
  const fieldType = assertString(field.fieldType, `Field ${index + 1} type`);
  const code = normalizeIdentifier(
    typeof field.code === "string" && field.code.trim() ? field.code : name,
    "_"
  );

  if (!code) {
    throw new AppsServiceError(`Field ${index + 1} code is required`, 400);
  }

  if (!GENERATED_BLUEPRINT_FIELD_TYPES.includes(fieldType as GeneratedBlueprintFieldType)) {
    throw new AppsServiceError(`Field ${name} has an invalid type`, 400);
  }

  if (typeof field.required !== "boolean") {
    throw new AppsServiceError(`Field ${name} required flag is invalid`, 400);
  }

  const options = normalizeStringArray(field.options);

  return {
    name,
    code,
    fieldType: fieldType as GeneratedBlueprintFieldType,
    required: field.required,
    ...(fieldType === "select" ? { options } : {}),
  };
}

function normalizeGeneratedTable(
  value: unknown,
  index: number
): GeneratedBlueprintTable {
  const table = assertObject(value, `Table ${index + 1} is invalid`);
  const name = assertString(table.name, `Table ${index + 1} name`);
  const code = normalizeIdentifier(
    typeof table.code === "string" && table.code.trim() ? table.code : name,
    "-"
  );

  if (!code) {
    throw new AppsServiceError(`Table ${index + 1} code is required`, 400);
  }

  if (!Array.isArray(table.fields) || table.fields.length === 0) {
    throw new AppsServiceError(`Table ${name} must contain at least one field`, 400);
  }

  if (table.fields.length > MAX_FIELDS_PER_TABLE) {
    throw new AppsServiceError(
      `Table ${name} exceeds the ${MAX_FIELDS_PER_TABLE} field limit`,
      400
    );
  }

  const fields = table.fields.map((field, fieldIndex) =>
    normalizeGeneratedField(field, fieldIndex)
  );
  const fieldCodes = new Set<string>();

  for (const field of fields) {
    if (fieldCodes.has(field.code)) {
      throw new AppsServiceError(
        `Table ${name} contains duplicate field code "${field.code}"`,
        400
      );
    }

    fieldCodes.add(field.code);
  }

  return {
    name,
    code,
    fields,
  };
}

function parseOpenAIResponse(response: { output_text?: string }) {
  const raw = response.output_text?.trim();

  if (!raw) {
    throw new InvalidGeneratedBlueprintError(
      "OpenAI returned an empty blueprint response",
      502
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new InvalidGeneratedBlueprintError(
      `OpenAI returned invalid blueprint JSON:\n${raw}`,
      502
    );
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getOpenAIRequestStatus(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : undefined;
}

function toOpenAIRequestError(error: unknown) {
  const message = getErrorMessage(error);
  const status = getOpenAIRequestStatus(error);

  if (/timed out|timeout/i.test(message)) {
    return new AppsServiceError(
      "OpenAI リクエストがタイムアウトしました。もう一度試すか OPENAI_TIMEOUT_MS を増やしてください。",
      504
    );
  }

  if (status === 401) {
    return new AppsServiceError("OpenAI API キーが拒否されました", 503);
  }

  if (status === 429) {
    return new AppsServiceError("OpenAI のレート制限を超えました。時間をおいて再試行してください。", 429);
  }

  if (typeof status === "number") {
    return new AppsServiceError(`OpenAI リクエストに失敗しました: ${message}`, 502);
  }

  return new AppsServiceError(`OpenAI リクエストに失敗しました: ${message}`, 502);
}

function createGenerationRequest(instructions: string, input: string) {
  return {
    model: OPENAI_MODEL,
    instructions,
    input,
    text: {
      format: {
        type: "json_schema" as const,
        name: "generated_app_blueprint",
        strict: true as const,
        schema: BLUEPRINT_RESPONSE_SCHEMA,
      },
    },
  };
}

export function normalizeGeneratedAppBlueprint(
  value: unknown
): GeneratedAppBlueprint {
  const blueprint = assertObject(value, "Blueprint payload is invalid");
  const name = assertString(blueprint.name, "App name");
  const description = assertString(blueprint.description, "App description");
  const aiInsight = assertString(blueprint.aiInsight, "AI insight");
  const code = normalizeIdentifier(
    typeof blueprint.code === "string" && blueprint.code.trim()
      ? blueprint.code
      : name,
    "-"
  );

  if (!code) {
    throw new AppsServiceError("App code is required", 400);
  }

  if (!Array.isArray(blueprint.tables) || blueprint.tables.length === 0) {
    throw new AppsServiceError("Blueprint must contain at least one table", 400);
  }

  if (blueprint.tables.length > MAX_TABLES) {
    throw new AppsServiceError(
      `Blueprint exceeds the ${MAX_TABLES} table limit`,
      400
    );
  }

  const tables = blueprint.tables.map((table, index) =>
    normalizeGeneratedTable(table, index)
  );
  const tableCodes = new Set<string>();

  for (const table of tables) {
    if (tableCodes.has(table.code)) {
      throw new AppsServiceError(
        `Blueprint contains duplicate table code "${table.code}"`,
        400
      );
    }

    tableCodes.add(table.code);
  }

  return {
    name,
    code,
    description,
    aiInsight,
    tables,
  };
}

async function requestBlueprint(
  client: OpenAIClientLike,
  instructions: string,
  input: string
) {
  let response: { output_text?: string };

  try {
    response = await client.responses.create(createGenerationRequest(instructions, input));
  } catch (error) {
    throw toOpenAIRequestError(error);
  }

  const parsed = parseOpenAIResponse(response);

  try {
    return normalizeGeneratedAppBlueprint(parsed);
  } catch (error) {
    if (error instanceof AppsServiceError) {
      throw new InvalidGeneratedBlueprintError(
        `OpenAI returned invalid blueprint data:\n${JSON.stringify(parsed)}`,
        502
      );
    }

    throw error;
  }
}

function toCreatedAppSummary(app: {
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

export async function generateBlueprintFromPrompt(
  prompt: string,
  client: OpenAIClientLike = getOpenAIClient()
) {
  const trimmedPrompt = assertString(prompt, "Prompt");

  try {
    return await requestBlueprint(client, GENERATION_INSTRUCTIONS, trimmedPrompt);
  } catch (error) {
    if (!(error instanceof InvalidGeneratedBlueprintError)) {
      throw error;
    }

    const repairInput = [
      `Original prompt:\n${trimmedPrompt}`,
      "",
      "Repair the following invalid blueprint response:",
      error.message,
    ].join("\n");

    try {
      return await requestBlueprint(client, REPAIR_INSTRUCTIONS, repairInput);
    } catch (repairError) {
      if (!(repairError instanceof InvalidGeneratedBlueprintError)) {
        throw repairError;
      }

      throw new AppsServiceError("有効なアプリ設計案を生成できませんでした", 502);
    }
  }
}

export async function createAppFromBlueprint(
  user: User,
  input: unknown,
  prisma = getPrismaClient()
) {
  await ensureDemoBuilderData();
  const blueprint = normalizeGeneratedAppBlueprint(input);

  return prisma.$transaction(async (tx) => {
    const duplicateApp = await tx.app.findFirst({
      where: {
        tenantId: user.tenantId,
        code: blueprint.code,
      },
      select: { id: true },
    });

    if (duplicateApp) {
      throw new AppsServiceError("同じアプリコードが既に存在します", 409);
    }

    const appId = crypto.randomUUID();
    const createdApp = await tx.app.create({
      data: {
        id: appId,
        tenantId: user.tenantId,
        name: blueprint.name,
        code: blueprint.code,
        description: blueprint.description,
        status: "draft",
        icon: "auto_awesome",
        createdById: user.id,
      },
    });

    for (const [tableIndex, table] of blueprint.tables.entries()) {
      const tableId = crypto.randomUUID();

      await tx.appTable.create({
        data: {
          id: tableId,
          tenantId: user.tenantId,
          appId,
          name: table.name,
          code: table.code,
          sortOrder: tableIndex,
        },
      });

      for (const [fieldIndex, field] of table.fields.entries()) {
        await tx.appField.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: user.tenantId,
            appId,
            tableId,
            name: field.name,
            code: field.code,
            fieldType: field.fieldType,
            required: field.required,
            uniqueFlag: false,
            settingsJson:
              field.fieldType === "select"
                ? { options: field.options ?? [] }
                : undefined,
            sortOrder: fieldIndex,
          },
        });
      }

      for (let recordIndex = 0; recordIndex < SAMPLE_RECORDS_PER_TABLE; recordIndex += 1) {
        const data = buildSampleRecordData(blueprint, table, recordIndex);

        await tx.appRecord.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: user.tenantId,
            appId,
            tableId,
            status: getSampleRecordStatus(data, recordIndex),
            dataJson: toJsonObject(data),
            createdById: user.id,
            updatedById: user.id,
          },
        });
      }
    }

    return {
      ...toCreatedAppSummary(createdApp),
      primaryTableCode: blueprint.tables[0]?.code,
      tableCount: blueprint.tables.length,
    };
  });
}

export {
  GENERATED_BLUEPRINT_FIELD_TYPES,
  MAX_FIELDS_PER_TABLE,
  MAX_TABLES,
  OPENAI_MODEL,
  SAMPLE_RECORDS_PER_TABLE,
};
