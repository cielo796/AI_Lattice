import { NextResponse } from "next/server";
import {
  deleteRecordForTable,
  getRecordForTable,
  type UpdateRecordInput,
  updateRecordForTable,
} from "@/server/records/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appCode: string; table: string; recordId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const record = await getRecordForTable(user, appCode, table, recordId);
    return NextResponse.json(record);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const input = await parseJsonBody<UpdateRecordInput>(request);
    const record = await updateRecordForTable(user, appCode, table, recordId, input);
    return NextResponse.json(record);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    await deleteRecordForTable(user, appCode, table, recordId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
