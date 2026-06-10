import { NextResponse } from "next/server";
import {
  listAIExecutionLogsForUser,
  MAX_AI_LOG_LIMIT,
} from "@/server/ai/model-gateway";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { AIExecutionLog } from "@/types/ai";

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, MAX_AI_LOG_LIMIT)
    : undefined;
}

function parseStatus(value: string | null) {
  if (!value || value === "all") {
    return undefined;
  }

  return value.trim() as AIExecutionLog["status"];
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const logs = await listAIExecutionLogsForUser(user, {
      limit: parseLimit(url.searchParams.get("limit")),
      operation: url.searchParams.get("operation")?.trim() || undefined,
      status: parseStatus(url.searchParams.get("status")),
    });

    return NextResponse.json(logs);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
