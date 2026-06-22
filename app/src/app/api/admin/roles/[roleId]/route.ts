import { NextResponse } from "next/server";
import {
  deleteRoleForAdmin,
  type UpdateRoleInput,
  updateRoleForAdmin,
} from "@/server/admin/rbac";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ roleId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  let user: User | null = null;
  let roleId = "";
  let input: UpdateRoleInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ roleId } = await context.params);
    input = await parseJsonBody<UpdateRoleInput>(request);
    const role = await updateRoleForAdmin(user, roleId, input);
    return NextResponse.json(role);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "ROLE_UPDATE",
        resourceType: "role",
        resourceId: roleId,
        resourceName: input?.name,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let roleId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ roleId } = await context.params);
    await deleteRoleForAdmin(user, roleId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "ROLE_DELETE",
        resourceType: "role",
        resourceId: roleId,
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

