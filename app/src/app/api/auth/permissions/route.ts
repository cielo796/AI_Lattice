import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { hasPermission, PERMISSIONS } from "@/server/admin/rbac";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const appId = url.searchParams.get("appId") || undefined;
    const tableId = url.searchParams.get("tableId") || undefined;
    const entries = await Promise.all(
      PERMISSIONS.map(async (permission) => [
        permission,
        await hasPermission(user, permission, { appId, tableId }),
      ] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
