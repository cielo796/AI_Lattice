import { NextResponse } from "next/server";
import {
  createWorkflowForApp,
  type CreateWorkflowInput,
  listWorkflowsForApp,
} from "@/server/workflows/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const workflows = await listWorkflowsForApp(user, appId);
    return NextResponse.json(workflows);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let input: CreateWorkflowInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<CreateWorkflowInput>(request);
    const workflow = await createWorkflowForApp(user, appId, input);
    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "WORKFLOW_CREATE",
        resourceType: "workflow",
        resourceName: input?.name,
        detailJson: { appId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
