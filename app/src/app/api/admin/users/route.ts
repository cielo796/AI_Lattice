import { NextResponse } from "next/server";
import { listUsersForAdmin } from "@/server/admin/users";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const users = await listUsersForAdmin(user);
    return NextResponse.json(users);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
