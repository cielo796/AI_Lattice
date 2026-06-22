import { NextResponse } from "next/server";
import { activatePromptTemplateVersionForAdmin } from "@/server/admin/prompt-templates";
import {
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ templateId: string; versionId: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let templateId = "";
  let versionId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ templateId, versionId } = await context.params);
    const version = await activatePromptTemplateVersionForAdmin(
      user,
      templateId,
      versionId
    );
    return NextResponse.json(version);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "PROMPT_TEMPLATE_VERSION_ACTIVATE",
        resourceType: "prompt_template",
        resourceId: templateId,
        detailJson: { versionId },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}


