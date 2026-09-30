import { requirePermission } from "@/server/admin/rbac";
import { AppsServiceError } from "@/server/apps/service";
import { getPrismaClient } from "@/server/db/prisma";
import type { User } from "@/types/user";
import type { WorkflowEditorContext } from "@/types/workflow";

export async function loadWorkflowEditorContext(user: User, appId: string): Promise<WorkflowEditorContext> {
  const prisma = getPrismaClient();
  const [tables, users, approvalPolicy, promptTemplates] = await Promise.all([
    prisma.appTable.findMany({ where: { tenantId: user.tenantId, appId }, select: { id: true, name: true, code: true, fields: { where: { tenantId: user.tenantId, appId }, select: { code: true, name: true, fieldType: true }, orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ where: { tenantId: user.tenantId, status: "active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.appApprovalSetting.findUnique({ where: { appId }, select: { enabled: true, targetTableId: true } }),
    prisma.promptTemplate.findMany({ where: { tenantId: user.tenantId, versions: { some: { tenantId: user.tenantId, isActive: true } } }, select: { key: true, name: true, operation: true } }),
  ]);
  return { tables, users, approvalPolicy, promptTemplates, allowedApiOrigins: (process.env.WORKFLOW_API_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean) };
}

export async function getWorkflowEditorContextForUser(user: User, appId: string) {
  await requirePermission(user, "workflow:read", { appId });
  const app = await getPrismaClient().app.findFirst({ where: { id: appId, tenantId: user.tenantId }, select: { id: true } });
  if (!app) throw new AppsServiceError("アプリが見つかりません。", 404);
  return loadWorkflowEditorContext(user, appId);
}
