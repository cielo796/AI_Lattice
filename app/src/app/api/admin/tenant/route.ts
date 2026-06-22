import { NextResponse } from "next/server";
import {
  getTenantForAdmin,
  type UpdateTenantInput,
  updateTenantForAdmin,
} from "@/server/admin/tenant";
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
    const tenant = await getTenantForAdmin(user);
    return NextResponse.json(tenant);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  let user: User | null = null;
  let input: UpdateTenantInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    input = await parseJsonBody<UpdateTenantInput>(request);
    const tenant = await updateTenantForAdmin(user, input);
    return NextResponse.json(tenant);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "TENANT_UPDATE",
        resourceType: "tenant",
        resourceId: user?.tenantId,
        resourceName: input?.name,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

