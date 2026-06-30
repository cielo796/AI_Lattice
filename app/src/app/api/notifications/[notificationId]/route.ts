import { NextResponse } from "next/server";
import {
  archiveNotificationForUser,
  deleteNotificationForUser,
  markNotificationReadForUser,
} from "@/server/notifications/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

type NotificationPatchBody = {
  action?: "read" | "archive";
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { notificationId } = await context.params;
    let input: NotificationPatchBody = {};

    try {
      input = await parseJsonBody<NotificationPatchBody>(request);
    } catch {
      input = {};
    }

    const notification =
      input.action === "archive"
        ? await archiveNotificationForUser(user, notificationId)
        : await markNotificationReadForUser(user, notificationId);

    return NextResponse.json(notification);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { notificationId } = await context.params;
    await deleteNotificationForUser(user, notificationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
