import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getAppByCodeForUser } from "@/server/apps/service";

type RouteContext = {
  params: Promise<{ appCode: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode } = await context.params;
    const app = await getAppByCodeForUser(user, appCode);
    return NextResponse.json(app);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
