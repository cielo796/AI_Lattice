import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getWorkflowScheduleForApp } from "@/server/workflows/scheduler";

export async function GET(_request: Request, context: { params: Promise<{ appId: string; workflowId: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, workflowId } = await context.params;
    return NextResponse.json(await getWorkflowScheduleForApp(user, appId, workflowId));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
