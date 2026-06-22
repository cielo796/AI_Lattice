import { NextResponse } from "next/server";
import {
  createRoleForAdmin,
  listRolesForAdmin,
  type CreateRoleInput,
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
    const roles = await listRolesForAdmin(user);
    return NextResponse.json(roles);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let user: User | null = null;
  let input: CreateRoleInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<CreateRoleInput>(request);
    const role = await createRoleForAdmin(user, input);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "ROLE_CREATE",
        resourceType: "role",
        resourceName: input?.name,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

