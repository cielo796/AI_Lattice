import { NextResponse } from "next/server";
import {
  deleteTableForApp,
  getTableForApp,
  type UpdateTableInput,
  updateTableForApp,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string; tableId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId } = await context.params;
    const table = await getTableForApp(user, appId, tableId);
    return NextResponse.json(table);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let input: UpdateTableInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId } = await context.params);
    input = await parseJsonBody<UpdateTableInput>(request);
    const table = await updateTableForApp(user, appId, tableId, input);
    return NextResponse.json(table);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "TABLE_UPDATE",
        resourceType: "table",
        resourceId: tableId,
        resourceName: input?.name,
        detailJson: { appId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId } = await context.params);
    await deleteTableForApp(user, appId, tableId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "TABLE_DELETE",
        resourceType: "table",
        resourceId: tableId,
        detailJson: { appId },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
