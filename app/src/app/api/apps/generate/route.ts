import { NextResponse } from "next/server";
import { adjustBlueprintFromInstruction, generateBlueprintFromPrompt, getBlueprintModelInfo } from "@/server/apps/blueprints";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

interface GenerateBlueprintInput {
  prompt?: string;
  blueprint?: unknown;
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await getBlueprintModelInfo(user));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let user: User | null = null;
  let input: GenerateBlueprintInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<GenerateBlueprintInput>(request);
    const blueprint = input.blueprint === undefined
      ? await generateBlueprintFromPrompt(input.prompt ?? "", user, undefined, request.signal)
      : await adjustBlueprintFromInstruction(input.prompt ?? "", input.blueprint, user, undefined, request.signal);
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
