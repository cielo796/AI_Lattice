import { NextResponse } from "next/server";
import { listAppApprovalUserCandidates } from "@/server/workflows/app-approval-settings";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const candidates = await listAppApprovalUserCandidates(user, appId);
    return NextResponse.json(candidates);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
