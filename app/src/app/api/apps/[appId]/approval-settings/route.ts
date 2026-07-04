import { NextResponse } from "next/server";
import {
  getAppApprovalSetting,
  saveAppApprovalSetting,
  type SaveAppApprovalSettingInput,
} from "@/server/workflows/app-approval-settings";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const setting = await getAppApprovalSetting(user, appId);
    return NextResponse.json(setting);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let input: SaveAppApprovalSettingInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<SaveAppApprovalSettingInput>(request);
    const setting = await saveAppApprovalSetting(user, appId, input);
    return NextResponse.json(setting);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_APPROVAL_SETTING_UPDATE",
        resourceType: "app",
        resourceId: appId,
        detailJson: { input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
