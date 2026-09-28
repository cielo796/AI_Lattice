import { NextResponse } from "next/server";
import { parseJsonBody, requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { changePassword } from "@/server/auth/password";
import { clearSession } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = await parseJsonBody<{ currentPassword?: unknown; newPassword?: unknown }>(request);
    await changePassword(user, input);
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
