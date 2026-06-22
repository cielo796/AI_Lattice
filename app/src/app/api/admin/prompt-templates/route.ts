import { NextResponse } from "next/server";
import {
  createPromptTemplateForAdmin,
  listPromptTemplatesForAdmin,
  type CreatePromptTemplateInput,
} from "@/server/admin/prompt-templates";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const templates = await listPromptTemplatesForAdmin(user);
    return NextResponse.json(templates);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let user: User | null = null;
  let input: CreatePromptTemplateInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<CreatePromptTemplateInput>(request);
    const template = await createPromptTemplateForAdmin(user, input);
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "PROMPT_TEMPLATE_CREATE",
        resourceType: "prompt_template",
        resourceName: input?.name,
        detailJson: { input },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}


