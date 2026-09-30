import { NextResponse } from "next/server";
import { parseJsonBody, requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { recoverWorkflowRun } from "@/server/workflows/service";
import type { WorkflowRecoveryInput } from "@/types/workflow";

export async function POST(request: Request, context: { params: Promise<{ appId: string; runId: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, runId } = await context.params;
    const input = await parseJsonBody<WorkflowRecoveryInput>(request);
    return NextResponse.json(await recoverWorkflowRun(user, appId, runId, input));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
