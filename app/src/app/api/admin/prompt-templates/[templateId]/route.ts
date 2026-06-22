import { NextResponse } from "next/server";
import {
  type UpdatePromptTemplateInput,
  updatePromptTemplateForAdmin,
} from "@/server/admin/prompt-templates";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ templateId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let user: User | null = null;
  let templateId = "";
  let input: UpdatePromptTemplateInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ templateId } = await context.params);
    input = await parseJsonBody<UpdatePromptTemplateInput>(request);
    const template = await updatePromptTemplateForAdmin(user, templateId, input);
    return NextResponse.json(template);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "PROMPT_TEMPLATE_UPDATE",
        resourceType: "prompt_template",
        resourceId: templateId,
        resourceName: input?.name,
        detailJson: { input },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}


