import { NextResponse } from "next/server";
import { generateApprovalStatusViews } from "@/server/workflows/app-approval-settings";
import {
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    const result = await generateApprovalStatusViews(user, appId);
    return NextResponse.json(result);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_APPROVAL_VIEWS_GENERATE",
        resourceType: "app",
        resourceId: appId,
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
