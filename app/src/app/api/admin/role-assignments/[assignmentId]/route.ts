import { NextResponse } from "next/server";
import { revokeRoleAssignmentForAdmin } from "@/server/admin/rbac";
import {
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ assignmentId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let assignmentId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ assignmentId } = await context.params);
    await revokeRoleAssignmentForAdmin(user, assignmentId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "USER_ROLE_REVOKE",
        resourceType: "user_role",
        resourceId: assignmentId,
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

