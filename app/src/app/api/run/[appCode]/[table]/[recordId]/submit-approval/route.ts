import { NextResponse } from "next/server";
import {
  submitAppApprovalForRecord,
  type SubmitAppApprovalInput,
} from "@/server/workflows/app-approval-settings";
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

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appCode = "";
  let table = "";
  let recordId = "";
  let input: SubmitAppApprovalInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appCode, table, recordId } = await context.params);
    input = await parseJsonBody<SubmitAppApprovalInput>(request);
    const approval = await submitAppApprovalForRecord(
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
        actionType: "APP_APPROVAL_SUBMIT",
        resourceType: "approval",
        resourceName: input?.title,
        detailJson: { appCode, tableCode: table, recordId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
