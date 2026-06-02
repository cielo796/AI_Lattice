import { NextResponse } from "next/server";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import { applyAppRefinementPreview } from "@/server/apps/refinements";
import type { AppRefinementOperation } from "@/types/app-refinement";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

type RefineAppApplyBody = {
  instruction?: string;
  activeTableCode?: string;
  summary?: string;
  operations?: AppRefinementOperation[];
};

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let input: RefineAppApplyBody | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<RefineAppApplyBody>(request);
    const result = await applyAppRefinementPreview(user, appId, input);
    return NextResponse.json(result);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_REFINE_APPLY",
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
