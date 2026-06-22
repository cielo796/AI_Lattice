import { NextResponse } from "next/server";
import {
  runWorkflowForRecord,
  type RunWorkflowForRecordInput,
} from "@/server/workflows/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string; workflowId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let workflowId = "";
  let input: RunWorkflowForRecordInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, workflowId } = await context.params);
    input = await parseJsonBody<RunWorkflowForRecordInput>(request);
    const approvals = await runWorkflowForRecord(user, appId, workflowId, input);
    return NextResponse.json({ approvals });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "WORKFLOW_RUN",
        resourceType: "workflow",
        resourceId: workflowId,
        detailJson: { appId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

