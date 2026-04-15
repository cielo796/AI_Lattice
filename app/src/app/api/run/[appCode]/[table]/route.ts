import { NextResponse } from "next/server";
import {
  createRecordForTable,
  type CreateRecordInput,
  listRecordsForTable,
} from "@/server/records/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

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
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table } = await context.params;
    const input = await parseJsonBody<CreateRecordInput>(request);
    const record = await createRecordForTable(user, appCode, table, input);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
