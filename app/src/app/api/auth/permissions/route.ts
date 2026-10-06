import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getPermissionMap } from "@/server/admin/rbac";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const appId = url.searchParams.get("appId") || undefined;
    const tableId = url.searchParams.get("tableId") || undefined;
    return NextResponse.json(await getPermissionMap(user, { appId, tableId }));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
