import { NextResponse } from "next/server";
import { ServiceError } from "@/server/errors/service-error";
import { runDueScheduledWorkflows } from "@/server/workflows/scheduler";
import { toRouteErrorResponse } from "@/app/api/_helpers";

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new ServiceError("CRON_SECRET is not configured.", 503);
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    throw new ServiceError("Unauthorized", 401);
  }
}

export async function POST(request: Request) {
  try {
    authorize(request);
    const url = new URL(request.url);
    const limitValue = url.searchParams.get("limit");
    const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
    const result = await runDueScheduledWorkflows(limit);
    return NextResponse.json(result, {
      status: result.failures.length > 0 ? 207 : 200,
    });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
