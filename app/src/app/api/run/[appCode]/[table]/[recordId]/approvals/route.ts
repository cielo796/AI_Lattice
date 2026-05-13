import { NextResponse } from "next/server";
import {
  createApprovalForRecord,
  type CreateApprovalInput,
  listApprovalsForRecord,
} from "@/server/workflows/service";
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
    const approvals = await listApprovalsForRecord(user, appCode, table, recordId);
    return NextResponse.json(approvals);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appCode = "";
  let table = "";
  let recordId = "";
  let input: CreateApprovalInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appCode, table, recordId } = await context.params);
    input = await parseJsonBody<CreateApprovalInput>(request);
    const approval = await createApprovalForRecord(
      user,
      appCode,
      table,
      recordId,
      input
    );
    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APPROVAL_CREATE",
        resourceType: "approval",
        resourceName: input?.title,
        detailJson: { appCode, tableCode: table, recordId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
