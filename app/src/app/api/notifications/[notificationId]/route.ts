import { NextResponse } from "next/server";
import { markNotificationReadForUser } from "@/server/notifications/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { notificationId } = await context.params;
    const notification = await markNotificationReadForUser(user, notificationId);
    return NextResponse.json(notification);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

