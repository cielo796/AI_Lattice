import { NextResponse } from "next/server";
import { authorizeWorkflowCron } from "@/server/workflows/internal-auth";
import { runDueScheduledWorkflows, scheduleRecordLimit } from "@/server/workflows/scheduler";
import { toRouteErrorResponse } from "@/app/api/_helpers";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    authorizeWorkflowCron(request);
    const url = new URL(request.url);
    const limitValue = url.searchParams.get("limit");
    const limit = limitValue === null ? undefined : scheduleRecordLimit(Number(limitValue));
    const result = await runDueScheduledWorkflows(limit);
    return NextResponse.json(result, {
      status: result.failures.length > 0 ? 207 : 200,
    });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
