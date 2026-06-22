import { NextResponse } from "next/server";
import {
  assignRoleForAdmin,
  listRoleAssignmentsForAdmin,
  type AssignRoleInput,
} from "@/server/admin/rbac";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const assignments = await listRoleAssignmentsForAdmin(user);
    return NextResponse.json(assignments);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let user: User | null = null;
  let input: AssignRoleInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<AssignRoleInput>(request);
    const assignment = await assignRoleForAdmin(user, input);
    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "USER_ROLE_ASSIGN",
        resourceType: "user_role",
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

