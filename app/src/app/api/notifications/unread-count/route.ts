import { NextResponse } from "next/server";
import { getUnreadNotificationCountForUser } from "@/server/notifications/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const count = await getUnreadNotificationCountForUser(user);
    return NextResponse.json({ count });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
