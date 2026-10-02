import { NextResponse } from "next/server";
import { parseJsonBody, recordRouteFailure, requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getAIModelSettings, saveAIModelSettings } from "@/server/ai/model-settings";
import type { User } from "@/types/user";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await getAIModelSettings(user));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  let user: User | null = null;
  try {
    user = await requireAuthenticatedUser();
    const input = await parseJsonBody<{ defaultModel?: unknown }>(request);
    return NextResponse.json(await saveAIModelSettings(user, input));
  } catch (error) {
    await recordRouteFailure(user, {
      actionType: "AI_MODEL_SETTINGS_UPDATE", resourceType: "ai_settings", resourceName: "AI default model",
    }, error);
    return toRouteErrorResponse(error);
  }
}
