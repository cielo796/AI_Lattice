import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import { getRuntimeAppOverview } from "@/server/runtime/overview";

type RouteContext = {
  params: Promise<{ appCode: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode } = await context.params;
    const overview = await getRuntimeAppOverview(user, appCode);
    return NextResponse.json(overview);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

