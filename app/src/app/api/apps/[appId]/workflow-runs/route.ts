import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { listWorkflowRunsForApp } from "@/server/workflows/service";

export async function GET(request: Request, context: { params: Promise<{ appId: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const workflowId = new URL(request.url).searchParams.get("workflowId") || undefined;
    return NextResponse.json(await listWorkflowRunsForApp(user, appId, workflowId));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
