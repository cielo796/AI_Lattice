import { NextResponse } from "next/server";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import { generateAppRefinementPreview } from "@/server/apps/refinements";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

type RefineAppPreviewBody = {
  instruction?: string;
  activeTableCode?: string;
};

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let input: RefineAppPreviewBody | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<RefineAppPreviewBody>(request);
    const result = await generateAppRefinementPreview(user, appId, input);
    return NextResponse.json(result);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_REFINE_PREVIEW",
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
