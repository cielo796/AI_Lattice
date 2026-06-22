import { NextResponse } from "next/server";
import { publishAppForUser } from "@/server/apps/publish";
import {
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    const version = await publishAppForUser(user, appId);
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_PUBLISH",
        resourceType: "app",
        resourceId: appId,
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
