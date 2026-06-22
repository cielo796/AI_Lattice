import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { AppsServiceError } from "@/server/apps/service";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import type { AppVersionSummary } from "@/types/app";
import type { User } from "@/types/user";

const MAX_VERSION_LIST_LIMIT = 50;

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

async function buildAppMetadataSnapshot(user: User, appId: string) {
  const prisma = getPrismaClient();
  const [tables, fields, views, forms, workflows] = await Promise.all([
    prisma.appTable.findMany({
      where: { tenantId: user.tenantId, appId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.appField.findMany({
      where: { tenantId: user.tenantId, appId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.appView.findMany({
      where: { tenantId: user.tenantId, appId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.appForm.findMany({
      where: { tenantId: user.tenantId, appId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.workflow.findMany({
      where: { tenantId: user.tenantId, appId },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const fieldsByTable = new Map<string, typeof fields>();
  for (const field of fields) {
    const tableFields = fieldsByTable.get(field.tableId) ?? [];
    tableFields.push(field);
    fieldsByTable.set(field.tableId, tableFields);
  }

  return {
    tables: tables.map((table) => ({
      id: table.id,
      name: table.name,
      code: table.code,
      sortOrder: table.sortOrder,
      fields: (fieldsByTable.get(table.id) ?? []).map((field) => ({
        id: field.id,
        name: field.name,
        code: field.code,
        fieldType: field.fieldType,
        required: field.required,
        uniqueFlag: field.uniqueFlag,
        defaultValue: field.defaultValue,
        settingsJson: field.settingsJson,
        sortOrder: field.sortOrder,
      })),
    })),
    views: views.map((view) => ({
      id: view.id,
      tableId: view.tableId,
      name: view.name,
      viewType: view.viewType,
      settingsJson: view.settingsJson,
      sortOrder: view.sortOrder,
    })),
    forms: forms.map((form) => ({
      id: form.id,
      tableId: form.tableId,
      name: form.name,
      layoutJson: form.layoutJson,
      sortOrder: form.sortOrder,
    })),
    workflows: workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      triggerType: workflow.triggerType,
      status: workflow.status,
      definitionJson: workflow.definitionJson,
    })),
  };
}

function toAppVersionSummary(version: {
  id: string;
  tenantId: string;
  appId: string;
  versionNo: number;
  publishedAt: Date;
  createdAt: Date;
  publishedBy?: { name: string; email: string } | null;
  metadataJson: Prisma.JsonValue;
}): AppVersionSummary {
  const metadata =
    version.metadataJson &&
    typeof version.metadataJson === "object" &&
    !Array.isArray(version.metadataJson)
      ? (version.metadataJson as Record<string, unknown>)
      : {};
  const tables = Array.isArray(metadata.tables) ? metadata.tables : [];
  const views = Array.isArray(metadata.views) ? metadata.views : [];
  const workflows = Array.isArray(metadata.workflows) ? metadata.workflows : [];

  return {
    id: version.id,
    tenantId: version.tenantId,
    appId: version.appId,
    versionNo: version.versionNo,
    publishedByName: version.publishedBy?.name ?? version.publishedBy?.email,
    publishedAt: version.publishedAt.toISOString(),
    createdAt: version.createdAt.toISOString(),
    tableCount: tables.length,
    viewCount: views.length,
    workflowCount: workflows.length,
  };
}

export async function publishAppForUser(user: User, appId: string) {
  await ensureDemoBuilderData();

  const app = await getAppOrThrow(user, appId);
  await requirePermission(user, "app:publish", { appId: app.id });
  const prisma = getPrismaClient();
  const metadata = await buildAppMetadataSnapshot(user, app.id);

  if (metadata.tables.length === 0) {
    throw new AppsServiceError(
      "テーブルがないアプリは公開できません。先にテーブルを作成してください。",
      400
    );
  }

  const latest = await prisma.appVersion.aggregate({
    where: { appId: app.id },
    _max: { versionNo: true },
  });
  const nextVersionNo = (latest._max.versionNo ?? 0) + 1;

  const [version] = await prisma.$transaction([
    prisma.appVersion.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: user.tenantId,
        appId: app.id,
        versionNo: nextVersionNo,
        metadataJson: JSON.parse(
          JSON.stringify(metadata)
        ) as Prisma.InputJsonObject,
        publishedById: user.id,
      },
      include: {
        publishedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.app.update({
      where: { id: app.id },
      data: { status: "published" },
    }),
  ]);

  await recordAuditLog(user, {
    actionType: "APP_PUBLISH",
    resourceType: "app",
    resourceId: app.id,
    resourceName: app.name,
    detailJson: {
      versionNo: nextVersionNo,
      tableCount: metadata.tables.length,
      viewCount: metadata.views.length,
      formCount: metadata.forms.length,
      workflowCount: metadata.workflows.length,
    },
  });

  return toAppVersionSummary(version);
}

export async function listAppVersionsForUser(user: User, appId: string) {
  await ensureDemoBuilderData();

  const app = await getAppOrThrow(user, appId);
  await requirePermission(user, "app:read", { appId: app.id });
  const prisma = getPrismaClient();
  const versions = await prisma.appVersion.findMany({
    where: { tenantId: user.tenantId, appId: app.id },
    include: {
      publishedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ versionNo: "desc" }],
    take: MAX_VERSION_LIST_LIMIT,
  });

  return versions.map(toAppVersionSummary);
}
