import { NextResponse } from "next/server";
import { parseJsonBody, recordRouteFailure, requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getTableDesign, saveTableDesign } from "@/server/apps/designer";
import type { User } from "@/types/user";

type Context = { params: Promise<{ appId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    return NextResponse.json(await getTableDesign(user, appId));
  } catch (error) { return toRouteErrorResponse(error); }
}

export async function PUT(request: Request, context: Context) {
  let user: User | null = null;
  let appId = "";
  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    const input = await parseJsonBody<unknown>(request);
    return NextResponse.json(await saveTableDesign(user, appId, input));
  } catch (error) {
    await recordRouteFailure(user, { actionType: "TABLE_DESIGN_SAVE", resourceType: "table", detailJson: { appId } }, error);
    return toRouteErrorResponse(error);
  }
}
