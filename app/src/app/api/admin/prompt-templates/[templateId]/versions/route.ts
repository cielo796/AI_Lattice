import { NextResponse } from "next/server";
import {
  createPromptTemplateVersionForAdmin,
  type CreatePromptTemplateVersionInput,
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

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let templateId = "";
  let input: CreatePromptTemplateVersionInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ templateId } = await context.params);
    input = await parseJsonBody<CreatePromptTemplateVersionInput>(request);
    const version = await createPromptTemplateVersionForAdmin(
      user,
      templateId,
      input
    );
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "PROMPT_TEMPLATE_VERSION_CREATE",
        resourceType: "prompt_template",
        resourceId: templateId,
        detailJson: { input },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}


