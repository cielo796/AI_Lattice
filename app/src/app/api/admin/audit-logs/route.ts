import { NextResponse } from "next/server";
import {
  listAuditLogsForUser,
  MAX_AUDIT_LOG_LIMIT,
} from "@/server/audit/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0
    ? Math.min(limit, MAX_AUDIT_LOG_LIMIT)
    : undefined;
}

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const logs = await listAuditLogsForUser(user, {
      limit: parseLimit(url.searchParams.get("limit")),
      actionType: url.searchParams.get("actionType")?.trim() || undefined,
      resourceType: url.searchParams.get("resourceType")?.trim() || undefined,
    });

    return NextResponse.json(logs);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
