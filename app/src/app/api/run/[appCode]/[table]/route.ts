import { NextResponse } from "next/server";
import {
  createRecordForTable,
  type CreateRecordInput,
  listRecordsForTable,
} from "@/server/records/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appCode: string; table: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table } = await context.params;
    const records = await listRecordsForTable(user, appCode, table);
    return NextResponse.json(records);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appCode = "";
  let table = "";
  let input: CreateRecordInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appCode, table } = await context.params);
    input = await parseJsonBody<CreateRecordInput>(request);
    const record = await createRecordForTable(user, appCode, table, input);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "RECORD_CREATE",
        resourceType: "record",
        resourceName: table,
        detailJson: { appCode, tableCode: table, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
