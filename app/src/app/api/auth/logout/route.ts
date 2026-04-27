import { NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/app/api/_helpers";
import { recordAuditLog } from "@/server/audit/service";
import { clearSession } from "@/server/auth/session";
import { getAuthenticatedUser } from "@/server/auth/service";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();

    if (user) {
      await recordAuditLog(user, {
        actionType: "AUTH_LOGOUT",
        resourceType: "auth",
        resourceId: user.id,
        resourceName: user.email,
      });
    }

    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
