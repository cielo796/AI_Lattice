import { NextResponse } from "next/server";
import { listNotificationsForUser } from "@/server/notifications/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const notifications = await listNotificationsForUser(user, {
      unreadOnly: searchParams.get("unread") === "true",
      limit: Number(searchParams.get("limit") ?? undefined),
    });

    return NextResponse.json(notifications);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

