import { Prisma } from "@prisma/client";
import { AppsServiceError } from "@/server/apps/service";
import { getPrismaClient } from "@/server/db/prisma";
import { getOpenAIClient } from "@/server/openai/client";
import type { AIExecutionLog } from "@/types/ai";
import type { User } from "@/types/user";

const DEFAULT_AI_LOG_LIMIT = 100;
const MAX_AI_LOG_LIMIT = 500;
const OPENAI_PROVIDER = "openai";

type GatewayUser = Pick<User, "id" | "tenantId" | "name" | "email">;
type AIExecutionStatus = "success" | "error";

type ResponseUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
};

type OpenAIResponseLike = {
  output_text?: string;
  usage?: ResponseUsage;
};

export type ModelGatewayClientLike = {
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
          schema: Record<string, unknown>;
        };
      };
    }) => Promise<OpenAIResponseLike>;
  };
};

export interface ModelGatewayJsonRequest {
  user: GatewayUser;
  operation: string;
  model: string;
  instructions: string;
  input: string;
  responseFormatName: string;
  responseSchema: Record<string, unknown>;
  appId?: string;
  recordId?: string;
  promptTemplateVersionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelGatewayJsonResponse {
  outputText?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ListAIExecutionLogsOptions {
  limit?: number;
  operation?: string;
  status?: AIExecutionLog["status"] | "all";
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

function toModelGatewayError(error: unknown) {
  if (error instanceof AppsServiceError) {
    return error;
  }

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
    return new AppsServiceError(
      "OpenAI のレート制限を超えました。時間をおいて再試行してください。",
      429
    );
  }

  if (typeof status === "number") {
    return new AppsServiceError(`OpenAI リクエストに失敗しました: ${message}`, 502);
  }

  return new AppsServiceError(`OpenAI リクエストに失敗しました: ${message}`, 502);
}

function normalizeToken(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function normalizeUsage(usage: ResponseUsage | undefined) {
  const promptTokens = normalizeToken(usage?.input_tokens ?? usage?.prompt_tokens);
  const completionTokens = normalizeToken(
    usage?.output_tokens ?? usage?.completion_tokens
  );
  const totalTokens = normalizeToken(usage?.total_tokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens: totalTokens || promptTokens + completionTokens,
  };
}

function normalizeLimit(limit: number | undefined) {
  if (!Number.isInteger(limit) || !limit || limit <= 0) {
    return DEFAULT_AI_LOG_LIMIT;
  }

  return Math.min(limit, MAX_AI_LOG_LIMIT);
}

function toInputJson(value: Record<string, unknown> | undefined) {
  if (!value) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function toJsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function buildRequestParams(request: ModelGatewayJsonRequest) {
  return {
    model: request.model,
    instructions: request.instructions,
    input: request.input,
    text: {
      format: {
        type: "json_schema" as const,
        name: request.responseFormatName,
        strict: true as const,
        schema: request.responseSchema,
      },
    },
  };
}

function buildInputLog(request: ModelGatewayJsonRequest) {
  return {
    input: request.input,
    instructions: request.instructions,
    responseFormatName: request.responseFormatName,
    metadata: request.metadata,
  };
}

function toAIExecutionLog(log: {
  id: string;
  tenantId: string;
  appId: string | null;
  recordId: string | null;
  promptTemplateVersionId: string | null;
  actorId: string;
  operation: string;
  provider: string;
  modelName: string;
  status: string;
  inputJson: Prisma.JsonValue | null;
  outputJson: Prisma.JsonValue | null;
  errorMessage: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number | null;
  createdAt: Date;
  actor?: { name: string; email: string } | null;
  app?: { name: string; code: string } | null;
  promptTemplateVersion?: {
    version: number;
    promptTemplate: { key: string; name: string };
  } | null;
}): AIExecutionLog {
  return {
    id: log.id,
    tenantId: log.tenantId,
    appId: log.appId ?? undefined,
    recordId: log.recordId ?? undefined,
    promptTemplateVersionId: log.promptTemplateVersionId ?? undefined,
    actorId: log.actorId,
    actorName: log.actor?.name ?? log.actor?.email,
    operation: log.operation,
    provider: log.provider,
    modelName: log.modelName,
    status: log.status as AIExecutionLog["status"],
    inputJson: toJsonObject(log.inputJson),
    outputJson: toJsonObject(log.outputJson),
    errorMessage: log.errorMessage ?? undefined,
    promptTokens: log.promptTokens,
    completionTokens: log.completionTokens,
    totalTokens: log.totalTokens,
    durationMs: log.durationMs ?? undefined,
    createdAt: log.createdAt.toISOString(),
    appName: log.app?.name,
    appCode: log.app?.code,
    promptTemplateKey: log.promptTemplateVersion?.promptTemplate.key,
    promptTemplateName: log.promptTemplateVersion?.promptTemplate.name,
    promptTemplateVersion: log.promptTemplateVersion?.version,
  };
}

async function recordAIExecutionLog(input: {
  user: GatewayUser;
  request: ModelGatewayJsonRequest;
  status: AIExecutionStatus;
  outputText?: string;
  errorMessage?: string;
  usage?: ModelGatewayJsonResponse["usage"];
  durationMs: number;
}) {
  const prisma = getPrismaClient();
  const usage = input.usage ?? {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  await prisma.aiExecutionLog.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: input.user.tenantId,
      appId: input.request.appId,
      recordId: input.request.recordId,
      promptTemplateVersionId: input.request.promptTemplateVersionId,
      actorId: input.user.id,
      operation: input.request.operation,
      provider: OPENAI_PROVIDER,
      modelName: input.request.model,
      status: input.status,
      inputJson: toInputJson(buildInputLog(input.request)),
      outputJson: input.outputText
        ? toInputJson({ outputText: input.outputText })
        : undefined,
      errorMessage: input.errorMessage,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      durationMs: input.durationMs,
    },
  });
}

async function safeRecordAIExecutionLog(
  input: Parameters<typeof recordAIExecutionLog>[0]
) {
  try {
    await recordAIExecutionLog(input);
  } catch {
    // AI logging must not mask the actual model result or failure.
  }
}

export async function generateJsonWithModelGateway(
  request: ModelGatewayJsonRequest,
  client?: ModelGatewayClientLike
): Promise<ModelGatewayJsonResponse> {
  const startedAt = Date.now();

  try {
    const openAIClient = client ?? (await getOpenAIClient(request.user.tenantId));
    const response = await openAIClient.responses.create(buildRequestParams(request));
    const usage = normalizeUsage(response.usage);

    await safeRecordAIExecutionLog({
      user: request.user,
      request,
      status: "success",
      outputText: response.output_text,
      usage,
      durationMs: Date.now() - startedAt,
    });

    return {
      outputText: response.output_text,
      usage,
    };
  } catch (error) {
    const normalizedError = toModelGatewayError(error);

    await safeRecordAIExecutionLog({
      user: request.user,
      request,
      status: "error",
      errorMessage: normalizedError.message,
      durationMs: Date.now() - startedAt,
    });

    throw normalizedError;
  }
}

export async function listAIExecutionLogsForUser(
  user: Pick<User, "tenantId">,
  options: ListAIExecutionLogsOptions = {}
) {
  const prisma = getPrismaClient();
  const status =
    options.status && options.status !== "all" ? options.status : undefined;
  const logs = await prisma.aiExecutionLog.findMany({
    where: {
      tenantId: user.tenantId,
      ...(options.operation ? { operation: options.operation } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      actor: { select: { name: true, email: true } },
      app: { select: { name: true, code: true } },
      promptTemplateVersion: {
        select: {
          version: true,
          promptTemplate: { select: { key: true, name: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: normalizeLimit(options.limit),
  });

  return logs.map(toAIExecutionLog);
}

export { DEFAULT_AI_LOG_LIMIT, MAX_AI_LOG_LIMIT, OPENAI_PROVIDER };
