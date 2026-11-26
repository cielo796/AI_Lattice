import { NextResponse } from "next/server";
import { recordRouteFailure, requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { disableWorkflowWebhook, getWorkflowWebhookForApp, rotateWorkflowWebhookSecret } from "@/server/workflows/webhook";
import type { User } from "@/types/user";

type RouteContext = { params: Promise<{ appId: string; workflowId: string }> };
const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, workflowId } = await context.params;
    return NextResponse.json(await getWorkflowWebhookForApp(user, appId, workflowId), { headers: noStore });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

// 秘密鍵を発行（再発行）する。平文の秘密鍵はこのレスポンスでのみ返す。
export async function POST(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let workflowId = "";
  try {
    user = await requireAuthenticatedUser();
    ({ appId, workflowId } = await context.params);
    return NextResponse.json(await rotateWorkflowWebhookSecret(user, appId, workflowId), { headers: noStore });
  } catch (error) {
    await recordRouteFailure(user, { actionType: "WORKFLOW_WEBHOOK_SECRET_ROTATE", resourceType: "workflow", resourceId: workflowId, detailJson: { appId } }, error);
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let workflowId = "";
  try {
    user = await requireAuthenticatedUser();
    ({ appId, workflowId } = await context.params);
    return NextResponse.json(await disableWorkflowWebhook(user, appId, workflowId), { headers: noStore });
  } catch (error) {
    await recordRouteFailure(user, { actionType: "WORKFLOW_WEBHOOK_DISABLE", resourceType: "workflow", resourceId: workflowId, detailJson: { appId } }, error);
    return toRouteErrorResponse(error);
  }
}
