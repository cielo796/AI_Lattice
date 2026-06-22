import { getPrismaClient } from "@/server/db/prisma";
import { hasPermission } from "@/server/admin/rbac";
import { getAppByCodeForUser } from "@/server/apps/service";
import type {
  AppViewType,
  RuntimeAppOverview,
} from "@/types/app";
import type { User } from "@/types/user";

export async function getRuntimeAppOverview(
  user: User,
  appCode: string
): Promise<RuntimeAppOverview> {
  const app = await getAppByCodeForUser(user, appCode);
  const prisma = getPrismaClient();
  const [tables, pendingApprovals] = await Promise.all([
    prisma.appTable.findMany({
      where: {
        tenantId: user.tenantId,
        appId: app.id,
      },
      select: {
        id: true,
        name: true,
        code: true,
        views: {
          select: { viewType: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        _count: {
          select: {
            fields: true,
            records: { where: { deletedAt: null } },
            views: true,
            forms: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.approval.count({
      where: {
        tenantId: user.tenantId,
        appId: app.id,
        status: "pending",
      },
    }),
  ]);
  const permissions = await Promise.all(
    tables.map((table) =>
      hasPermission(user, "table:read", {
        appId: app.id,
        tableId: table.id,
      })
    )
  );
  const summaries = tables
    .filter((_table, index) => permissions[index])
    .map((table) => ({
      id: table.id,
      name: table.name,
      code: table.code,
      recordCount: table._count.records,
      fieldCount: table._count.fields,
      viewCount: table._count.views,
      formCount: table._count.forms,
      viewTypes: table.views.map((view) => view.viewType as AppViewType),
    }));

  return {
    app,
    tables: summaries,
    totals: {
      records: summaries.reduce((total, table) => total + table.recordCount, 0),
      pendingApprovals,
    },
  };
}
