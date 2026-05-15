import { NextResponse } from "next/server";
import {
  deleteViewForTable,
  getViewForTable,
  type UpdateViewInput,
  updateViewForTable,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string; tableId: string; viewId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId, viewId } = await context.params;
    const view = await getViewForTable(user, appId, tableId, viewId);
    return NextResponse.json(view);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let viewId = "";
  let input: UpdateViewInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId, viewId } = await context.params);
    input = await parseJsonBody<UpdateViewInput>(request);
    const view = await updateViewForTable(user, appId, tableId, viewId, input);
    return NextResponse.json(view);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "VIEW_UPDATE",
        resourceType: "view",
        resourceId: viewId,
        resourceName: input?.name,
        detailJson: { appId, tableId, input },
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
  let viewId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId, viewId } = await context.params);
    await deleteViewForTable(user, appId, tableId, viewId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "VIEW_DELETE",
        resourceType: "view",
        resourceId: viewId,
        detailJson: { appId, tableId },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
