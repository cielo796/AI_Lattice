import { NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/app/api/_helpers";
import { authorizeWorkflowCron } from "@/server/workflows/internal-auth";
import { dispatchPendingWorkflowRuns } from "@/server/workflows/worker";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    authorizeWorkflowCron(request);
    const limit = new URL(request.url).searchParams.get("limit");
    const result = await dispatchPendingWorkflowRuns(limit === null ? undefined : Number(limit));
    return NextResponse.json(result, { status: result.failures.length ? 207 : 200 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
