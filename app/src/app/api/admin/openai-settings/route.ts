import { NextResponse } from "next/server";
import {
  clearOpenAISettings,
  getOpenAISettingsStatus,
  saveOpenAISettings,
} from "@/server/admin/openai-settings";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

interface SaveOpenAISettingsBody {
  apiKey?: string;
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const status = await getOpenAISettingsStatus(user);

    return NextResponse.json(status);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  let user: User | null = null;

  try {
    user = await requireAuthenticatedUser();
    const input = await parseJsonBody<SaveOpenAISettingsBody>(request);
    const status = await saveOpenAISettings(user, input);

    return NextResponse.json(status);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "OPENAI_API_KEY_UPDATE",
        resourceType: "ai_settings",
        resourceName: "OpenAI API key",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE() {
  let user: User | null = null;

  try {
    user = await requireAuthenticatedUser();
    const status = await clearOpenAISettings(user);

    return NextResponse.json(status);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "OPENAI_API_KEY_CLEAR",
        resourceType: "ai_settings",
        resourceName: "OpenAI API key",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
