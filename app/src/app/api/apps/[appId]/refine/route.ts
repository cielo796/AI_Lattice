import { NextResponse } from "next/server";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import { refineAppWithAI } from "@/server/apps/refinements";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

type RefineAppBody = {
  instruction?: string;
  activeTableCode?: string;
};

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let input: RefineAppBody | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<RefineAppBody>(request);
    const result = await refineAppWithAI(user, appId, input);
    return NextResponse.json(result);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_REFINE",
        resourceType: "app",
        resourceId: appId,
        detailJson: { appId, input },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
