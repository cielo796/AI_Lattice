import { NextResponse } from "next/server";
import {
  deleteAppForUser,
  getAppForUser,
  type UpdateAppInput,
  updateAppForUser,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const app = await getAppForUser(user, appId);
    return NextResponse.json(app);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let input: UpdateAppInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<UpdateAppInput>(request);
    const app = await updateAppForUser(user, appId, input);
    return NextResponse.json(app);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_UPDATE",
        resourceType: "app",
        resourceId: appId,
        resourceName: input?.name,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    await deleteAppForUser(user, appId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_DELETE",
        resourceType: "app",
        resourceId: appId,
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
