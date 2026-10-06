import { NextResponse } from "next/server";
import { parseJsonBody, requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getDisplaySettings, updateDisplaySettings } from "@/server/display/service";

export async function GET() {
  try {
    return NextResponse.json(await getDisplaySettings(await requireAuthenticatedUser()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await updateDisplaySettings(user, await parseJsonBody<unknown>(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
