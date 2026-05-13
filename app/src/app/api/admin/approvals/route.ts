import { NextResponse } from "next/server";
import {
  listApprovalsForUser,
  MAX_APPROVAL_LIMIT,
} from "@/server/workflows/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { Approval } from "@/types/record";

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, MAX_APPROVAL_LIMIT)
    : undefined;
}

function parseStatus(value: string | null) {
  if (!value || value === "all") {
    return undefined;
  }

  return value.trim() as Approval["status"];
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const approvals = await listApprovalsForUser(user, {
      status: parseStatus(url.searchParams.get("status")),
      limit: parseLimit(url.searchParams.get("limit")),
    });

    return NextResponse.json(approvals);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
