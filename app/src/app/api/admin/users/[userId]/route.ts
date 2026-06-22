import { NextResponse } from "next/server";
import { updateUserStatusForAdmin } from "@/server/admin/users";
import { AppsServiceError } from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

interface UpdateUserStatusInput {
  status?: string;
}

export async function PATCH(request: Request, context: RouteContext) {
  let user: User | null = null;
  let userId = "";
  let input: UpdateUserStatusInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ userId } = await context.params);
    input = await parseJsonBody<UpdateUserStatusInput>(request);

    if (input.status !== "active" && input.status !== "inactive") {
      throw new AppsServiceError("ステータスの指定が不正です。", 400);
    }

    const updated = await updateUserStatusForAdmin(user, userId, input.status);
    return NextResponse.json(updated);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "USER_STATUS_UPDATE",
        resourceType: "user",
        resourceId: userId,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
