import { NextResponse } from "next/server";
import {
  createAppForUser,
  type CreateAppInput,
  listAppsForUser,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const apps = await listAppsForUser(user);
    return NextResponse.json(apps);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let user: User | null = null;
  let input: CreateAppInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<CreateAppInput>(request);
    const app = await createAppForUser(user, input);
    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_CREATE",
        resourceType: "app",
        resourceName: input?.name,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
