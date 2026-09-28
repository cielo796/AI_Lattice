import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { resumeWorkflowRun } from "@/server/workflows/service";

export async function POST(_request: Request, context: { params: Promise<{ appId: string; runId: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, runId } = await context.params;
    return NextResponse.json(await resumeWorkflowRun(user, appId, runId));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
