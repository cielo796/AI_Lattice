import { NextResponse } from "next/server";
import {
  createAppForUser,
  type CreateAppInput,
  listAppsForUser,
} from "@/server/apps/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

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
  try {
    const user = await requireAuthenticatedUser();
    const input = await parseJsonBody<CreateAppInput>(request);
    const app = await createAppForUser(user, input);
    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
