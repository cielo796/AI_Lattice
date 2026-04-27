import { NextResponse } from "next/server";
import { generateBlueprintFromPrompt } from "@/server/apps/blueprints";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

interface GenerateBlueprintInput {
  prompt?: string;
}

export async function POST(request: Request) {
  let user: User | null = null;
  let input: GenerateBlueprintInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<GenerateBlueprintInput>(request);
    const blueprint = await generateBlueprintFromPrompt(input.prompt ?? "");
    return NextResponse.json(blueprint);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_GENERATE",
        resourceType: "ai",
        resourceName: "Prompt to App",
        detailJson: {
          promptLength: input?.prompt?.length ?? 0,
        },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
