import { NextResponse } from "next/server";
import { listBackReferencesForRecord } from "@/server/records/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appCode: string; table: string; recordId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const groups = await listBackReferencesForRecord(user, appCode, table, recordId);
    return NextResponse.json(groups);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
