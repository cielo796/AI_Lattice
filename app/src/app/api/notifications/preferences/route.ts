import { NextResponse } from "next/server";
import {
  listNotificationPreferencesForUser,
  updateNotificationPreferencesForUser,
} from "@/server/notifications/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { NotificationPreference } from "@/types/notification";

type UpdateNotificationPreferencesBody = {
  preferences: NotificationPreference[];
};

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const preferences = await listNotificationPreferencesForUser(user);
    return NextResponse.json(preferences);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = await parseJsonBody<UpdateNotificationPreferencesBody>(request);
    const preferences = await updateNotificationPreferencesForUser(
      user,
      Array.isArray(input.preferences) ? input.preferences : []
    );
    return NextResponse.json(preferences);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
