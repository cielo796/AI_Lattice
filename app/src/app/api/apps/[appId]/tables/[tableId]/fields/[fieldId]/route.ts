import { NextResponse } from "next/server";
import {
  deleteFieldForTable,
  getFieldForTable,
  type UpdateFieldInput,
  updateFieldForTable,
} from "@/server/apps/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appId: string; tableId: string; fieldId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId, fieldId } = await context.params;
    const field = await getFieldForTable(user, appId, tableId, fieldId);
    return NextResponse.json(field);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId, fieldId } = await context.params;
    const input = await parseJsonBody<UpdateFieldInput>(request);
    const field = await updateFieldForTable(
      user,
      appId,
      tableId,
      fieldId,
      input
    );
    return NextResponse.json(field);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId, fieldId } = await context.params;
    await deleteFieldForTable(user, appId, tableId, fieldId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
