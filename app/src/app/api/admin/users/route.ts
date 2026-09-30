import { NextResponse } from "next/server";
import { createUserForAdmin, listUsersForAdmin, type CreateAdminUserInput } from "@/server/admin/users";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = await parseJsonBody<CreateAdminUserInput>(request);
    return NextResponse.json(await createUserForAdmin(user, input), { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const users = await listUsersForAdmin(user);
    return NextResponse.json(users);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
