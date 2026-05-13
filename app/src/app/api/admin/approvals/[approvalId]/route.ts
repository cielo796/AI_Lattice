import { NextResponse } from "next/server";
import {
  getApprovalForUser,
  type UpdateApprovalDecisionInput,
  updateApprovalDecision,
} from "@/server/workflows/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ approvalId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { approvalId } = await context.params;
    const approval = await getApprovalForUser(user, approvalId);
    return NextResponse.json(approval);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let approvalId = "";
  let input: UpdateApprovalDecisionInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ approvalId } = await context.params);
    input = await parseJsonBody<UpdateApprovalDecisionInput>(request);
    const approval = await updateApprovalDecision(user, approvalId, input);
    return NextResponse.json(approval);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType:
          input?.status === "approved" ? "APPROVAL_APPROVE" : "APPROVAL_REJECT",
        resourceType: "approval",
        resourceId: approvalId,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
