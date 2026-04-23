import { NextResponse } from "next/server";
import { generateBlueprintFromPrompt } from "@/server/apps/blueprints";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

interface GenerateBlueprintInput {
  prompt?: string;
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const input = await parseJsonBody<GenerateBlueprintInput>(request);
    const blueprint = await generateBlueprintFromPrompt(input.prompt ?? "");
    return NextResponse.json(blueprint);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
