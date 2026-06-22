import { NextResponse } from "next/server";
import {
  listApprovalsForRuntimeApp,
  MAX_APPROVAL_LIMIT,
} from "@/server/workflows/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { Approval } from "@/types/record";

type RouteContext = {
  params: Promise<{ appCode: string }>;
};

function parseLimit(value: string | null) {
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, MAX_APPROVAL_LIMIT)
    : undefined;
}

function parseStatus(value: string | null) {
  return value && value !== "all"
    ? (value as Approval["status"])
    : undefined;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode } = await context.params;
    const url = new URL(request.url);
    const approvals = await listApprovalsForRuntimeApp(user, appCode, {
      status: parseStatus(url.searchParams.get("status")),
      limit: parseLimit(url.searchParams.get("limit")),
    });
    return NextResponse.json(approvals);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

