import { NextResponse } from "next/server";
import { listAppVersionsForUser } from "@/server/apps/publish";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const versions = await listAppVersionsForUser(user, appId);
    return NextResponse.json(versions);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
