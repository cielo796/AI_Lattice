import { NextResponse } from "next/server";
import {
  createManagedNotificationsForUser,
  listNotificationsForUser,
} from "@/server/notifications/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { Notification } from "@/types/notification";

type CreateManagedNotificationBody = {
  recipientIds?: string[];
  roleType?: string;
  type?: Notification["type"];
  title: string;
  body?: string;
  href?: string;
  dedupeKey?: string;
};

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const notifications = await listNotificationsForUser(user, {
      unreadOnly: searchParams.get("unread") === "true",
      archivedOnly: searchParams.get("archived") === "true",
      limit: Number(searchParams.get("limit") ?? undefined),
      cursor: searchParams.get("cursor") ?? undefined,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = await parseJsonBody<CreateManagedNotificationBody>(request);
    const notifications = await createManagedNotificationsForUser(user, input);
    return NextResponse.json(notifications, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
