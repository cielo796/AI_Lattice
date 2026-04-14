import { NextResponse } from "next/server";
import {
  deleteTableForApp,
  getTableForApp,
  type UpdateTableInput,
  updateTableForApp,
} from "@/server/apps/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

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
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId } = await context.params;
    const input = await parseJsonBody<UpdateTableInput>(request);
    const table = await updateTableForApp(user, appId, tableId, input);
    return NextResponse.json(table);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId } = await context.params;
    await deleteTableForApp(user, appId, tableId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
