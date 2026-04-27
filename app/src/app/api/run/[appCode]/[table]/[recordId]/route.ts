import { NextResponse } from "next/server";
import {
  deleteRecordForTable,
  getRecordForTable,
  type UpdateRecordInput,
  updateRecordForTable,
} from "@/server/records/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

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
  let user: User | null = null;
  let appCode = "";
  let table = "";
  let recordId = "";
  let input: UpdateRecordInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appCode, table, recordId } = await context.params);
    input = await parseJsonBody<UpdateRecordInput>(request);
    const record = await updateRecordForTable(user, appCode, table, recordId, input);
    return NextResponse.json(record);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "RECORD_UPDATE",
        resourceType: "record",
        resourceId: recordId,
        resourceName: table,
        detailJson: { appCode, tableCode: table, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appCode = "";
  let table = "";
  let recordId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appCode, table, recordId } = await context.params);
    await deleteRecordForTable(user, appCode, table, recordId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "RECORD_DELETE",
        resourceType: "record",
        resourceId: recordId,
        resourceName: table,
        detailJson: { appCode, tableCode: table },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
