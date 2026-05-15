import { NextResponse } from "next/server";
import {
  createViewForTable,
  type CreateViewInput,
  listViewsForTable,
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
    const views = await listViewsForTable(user, appId, tableId);
    return NextResponse.json(views);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let input: CreateViewInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId } = await context.params);
    input = await parseJsonBody<CreateViewInput>(request);
    const view = await createViewForTable(user, appId, tableId, input);
    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "VIEW_CREATE",
        resourceType: "view",
        resourceName: input?.name,
        detailJson: { appId, tableId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
