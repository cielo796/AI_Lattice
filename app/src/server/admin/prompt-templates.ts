import { Prisma } from "@prisma/client";
import { AppsServiceError } from "@/server/apps/service";
import { recordAuditLog } from "@/server/audit/service";
import { ensureDemoAuthData } from "@/server/auth/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";
import { requirePermission } from "@/server/admin/rbac";
import type { PromptTemplate, PromptTemplateVersion } from "@/types/prompt-template";
import type { User } from "@/types/user";

export interface CreatePromptTemplateInput {
  key: string;
  name: string;
  operation: string;
  description?: string;
  modelName: string;
  instructions: string;
  responseSchemaJson?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  operation?: string;
  description?: string;
}

export interface CreatePromptTemplateVersionInput {
  modelName: string;
  instructions: string;
  responseSchemaJson?: Record<string, unknown>;
  isActive?: boolean;
}

export interface ActivePromptTemplateVersion {
  id: string;
  key: string;
  name: string;
  operation: string;
  version: number;
  modelName: string;
  instructions: string;
  responseSchemaJson?: Record<string, unknown>;
}

function assertNonEmpty(value: string | undefined, fieldName: string) {
  if (!value || !value.trim()) {
    throw new AppsServiceError(`${fieldName}は必須です。`, 400);
  }

  return value.trim();
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function toJsonObject(value: Record<string, unknown> | undefined) {
  return value ? (value as Prisma.InputJsonObject) : undefined;
}

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toVersion(version: {
  id: string;
  tenantId: string;
  promptTemplateId: string;
  version: number;
  modelName: string;
  instructions: string;
  responseSchemaJson: Prisma.JsonValue | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  createdBy?: { name: string; email: string } | null;
}): PromptTemplateVersion {
  return {
    id: version.id,
    tenantId: version.tenantId,
    promptTemplateId: version.promptTemplateId,
    version: version.version,
    modelName: version.modelName,
    instructions: version.instructions,
    responseSchemaJson: jsonObject(version.responseSchemaJson),
    isActive: version.isActive,
    createdBy: version.createdById ?? undefined,
    createdByName: version.createdBy?.name ?? version.createdBy?.email,
    createdAt: version.createdAt.toISOString(),
  };
}

function toTemplate(template: {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  operation: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions?: Array<Parameters<typeof toVersion>[0]>;
  _count?: { versions: number };
}): PromptTemplate {
  const versions = template.versions?.map(toVersion);

  return {
    id: template.id,
    tenantId: template.tenantId,
    key: template.key,
    name: template.name,
    operation: template.operation,
    description: template.description ?? undefined,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
    activeVersion: versions?.find((version) => version.isActive),
    versions,
    versionCount: template._count?.versions ?? versions?.length,
  };
}

async function getTemplateOrThrow(user: Pick<User, "tenantId">, templateId: string) {
  const prisma = getPrismaClient();
  const template = await prisma.promptTemplate.findFirst({
    where: {
      id: assertNonEmpty(templateId, "Prompt Template"),
      tenantId: user.tenantId,
    },
  });

  if (!template) {
    throw new AppsServiceError("Prompt Template が見つかりません。", 404);
  }

  return template;
}

async function nextVersionNo(promptTemplateId: string) {
  const prisma = getPrismaClient();
  const aggregate = await prisma.promptTemplateVersion.aggregate({
    where: { promptTemplateId },
    _max: { version: true },
  });

  return (aggregate._max.version ?? 0) + 1;
}

async function activateVersion(
  tenantId: string,
  promptTemplateId: string,
  versionId: string
) {
  const prisma = getPrismaClient();

  await prisma.$transaction([
    prisma.promptTemplateVersion.updateMany({
      where: { tenantId, promptTemplateId },
      data: { isActive: false },
    }),
    prisma.promptTemplateVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);
}

export async function listPromptTemplatesForAdmin(user: User) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:prompt_templates");

  const prisma = getPrismaClient();
  const templates = await prisma.promptTemplate.findMany({
    where: { tenantId: user.tenantId },
    include: {
      versions: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: [{ version: "desc" }],
      },
      _count: { select: { versions: true } },
    },
    orderBy: [{ operation: "asc" }, { key: "asc" }],
  });

  return templates.map(toTemplate);
}

export async function createPromptTemplateForAdmin(
  user: User,
  input: CreatePromptTemplateInput
) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:prompt_templates");

  const key = normalizeKey(assertNonEmpty(input.key, "キー"));
  const name = assertNonEmpty(input.name, "名前");
  const operation = assertNonEmpty(input.operation, "operation");
  const modelName = assertNonEmpty(input.modelName, "モデル");
  const instructions = assertNonEmpty(input.instructions, "instructions");
  const prisma = getPrismaClient();

  const template = await prisma.$transaction(async (tx) => {
    const createdTemplate = await tx.promptTemplate.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        key,
        name,
        operation,
        description: input.description?.trim() || undefined,
      },
    });

    await tx.promptTemplateVersion.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        promptTemplateId: createdTemplate.id,
        version: 1,
        modelName,
        instructions,
        responseSchemaJson: toJsonObject(input.responseSchemaJson),
        isActive: input.isActive ?? true,
        createdById: user.id,
      },
    });

    return tx.promptTemplate.findUniqueOrThrow({
      where: { id: createdTemplate.id },
      include: {
        versions: {
          include: { createdBy: { select: { name: true, email: true } } },
          orderBy: [{ version: "desc" }],
        },
        _count: { select: { versions: true } },
      },
    });
  });

  await recordAuditLog(user, {
    actionType: "PROMPT_TEMPLATE_CREATE",
    resourceType: "prompt_template",
    resourceId: template.id,
    resourceName: template.name,
    detailJson: { key, operation, modelName },
    aiInvolvement: "assisted",
  });

  return toTemplate(template);
}

export async function updatePromptTemplateForAdmin(
  user: User,
  templateId: string,
  input: UpdatePromptTemplateInput
) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:prompt_templates");

  const existing = await getTemplateOrThrow(user, templateId);
  const prisma = getPrismaClient();
  const template = await prisma.promptTemplate.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() || existing.name,
      operation: input.operation?.trim() || existing.operation,
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
    },
    include: {
      versions: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: [{ version: "desc" }],
      },
      _count: { select: { versions: true } },
    },
  });

  await recordAuditLog(user, {
    actionType: "PROMPT_TEMPLATE_UPDATE",
    resourceType: "prompt_template",
    resourceId: template.id,
    resourceName: template.name,
    detailJson: {
      before: {
        name: existing.name,
        operation: existing.operation,
        description: existing.description,
      },
      after: {
        name: template.name,
        operation: template.operation,
        description: template.description,
      },
    },
    aiInvolvement: "assisted",
  });

  return toTemplate(template);
}

export async function createPromptTemplateVersionForAdmin(
  user: User,
  templateId: string,
  input: CreatePromptTemplateVersionInput
) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:prompt_templates");

  const template = await getTemplateOrThrow(user, templateId);
  const modelName = assertNonEmpty(input.modelName, "モデル");
  const instructions = assertNonEmpty(input.instructions, "instructions");
  const prisma = getPrismaClient();
  const versionNo = await nextVersionNo(template.id);
  const version = await prisma.promptTemplateVersion.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: user.tenantId,
      promptTemplateId: template.id,
      version: versionNo,
      modelName,
      instructions,
      responseSchemaJson: toJsonObject(input.responseSchemaJson),
      isActive: false,
      createdById: user.id,
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  if (input.isActive ?? true) {
    await activateVersion(user.tenantId, template.id, version.id);
  }

  const refreshed = await prisma.promptTemplateVersion.findUniqueOrThrow({
    where: { id: version.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  await recordAuditLog(user, {
    actionType: "PROMPT_TEMPLATE_VERSION_CREATE",
    resourceType: "prompt_template",
    resourceId: template.id,
    resourceName: template.name,
    detailJson: { version: versionNo, modelName, isActive: input.isActive ?? true },
    aiInvolvement: "assisted",
  });

  return toVersion(refreshed);
}

export async function activatePromptTemplateVersionForAdmin(
  user: User,
  templateId: string,
  versionId: string
) {
  await ensureDemoAuthData();
  await requirePermission(user, "admin:prompt_templates");

  const template = await getTemplateOrThrow(user, templateId);
  const prisma = getPrismaClient();
  const version = await prisma.promptTemplateVersion.findFirst({
    where: {
      id: assertNonEmpty(versionId, "version"),
      tenantId: user.tenantId,
      promptTemplateId: template.id,
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  if (!version) {
    throw new AppsServiceError("Prompt Template version が見つかりません。", 404);
  }

  await activateVersion(user.tenantId, template.id, version.id);
  const refreshed = await prisma.promptTemplateVersion.findUniqueOrThrow({
    where: { id: version.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  await recordAuditLog(user, {
    actionType: "PROMPT_TEMPLATE_VERSION_ACTIVATE",
    resourceType: "prompt_template",
    resourceId: template.id,
    resourceName: template.name,
    detailJson: { version: version.version, modelName: version.modelName },
    aiInvolvement: "assisted",
  });

  return toVersion(refreshed);
}

export async function resolveActivePromptTemplateVersion(
  user: Pick<User, "tenantId">,
  input: { operation: string; key?: string }
): Promise<ActivePromptTemplateVersion | null> {
  const prisma = getPrismaClient();
  const version = await prisma.promptTemplateVersion.findFirst({
    where: {
      tenantId: user.tenantId,
      isActive: true,
      promptTemplate: {
        tenantId: user.tenantId,
        operation: input.operation,
        ...(input.key ? { key: input.key } : {}),
      },
    },
    include: {
      promptTemplate: {
        select: {
          key: true,
          name: true,
          operation: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    key: version.promptTemplate.key,
    name: version.promptTemplate.name,
    operation: version.promptTemplate.operation,
    version: version.version,
    modelName: version.modelName,
    instructions: version.instructions,
    responseSchemaJson: jsonObject(version.responseSchemaJson),
  };
}


