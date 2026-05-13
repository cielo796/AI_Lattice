import { NextResponse } from "next/server";
import {
  deleteWorkflowForApp,
  getWorkflowForApp,
  type UpdateWorkflowInput,
  updateWorkflowForApp,
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, workflowId } = await context.params;
    const workflow = await getWorkflowForApp(user, appId, workflowId);
    return NextResponse.json(workflow);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let workflowId = "";
  let input: UpdateWorkflowInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, workflowId } = await context.params);
    input = await parseJsonBody<UpdateWorkflowInput>(request);
    const workflow = await updateWorkflowForApp(user, appId, workflowId, input);
    return NextResponse.json(workflow);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "WORKFLOW_UPDATE",
        resourceType: "workflow",
        resourceId: workflowId,
        resourceName: input?.name,
        detailJson: { appId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let workflowId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId, workflowId } = await context.params);
    await deleteWorkflowForApp(user, appId, workflowId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "WORKFLOW_DELETE",
        resourceType: "workflow",
        resourceId: workflowId,
        detailJson: { appId },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
