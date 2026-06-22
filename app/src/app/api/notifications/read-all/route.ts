import { NextResponse } from "next/server";
import { markAllNotificationsReadForUser } from "@/server/notifications/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    await markAllNotificationsReadForUser(user);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

