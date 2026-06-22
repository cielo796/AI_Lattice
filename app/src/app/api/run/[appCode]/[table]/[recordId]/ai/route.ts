import { NextResponse } from "next/server";
import {
  executeRuntimeAIAction,
  isRuntimeAIAction,
} from "@/server/ai/runtime-ai";
import { requirePermission } from "@/server/admin/rbac";
import { AppsServiceError } from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appCode: string; table: string; recordId: string }>;
};

interface RuntimeAIRequestInput {
  action?: string;
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appCode = "";
  let table = "";
  let recordId = "";
  let input: RuntimeAIRequestInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    await requirePermission(user, "ai:execute");
    ({ appCode, table, recordId } = await context.params);
    input = await parseJsonBody<RuntimeAIRequestInput>(request);

    if (!isRuntimeAIAction(input.action)) {
      throw new AppsServiceError("サポートされていないAIアクションです。", 400);
    }

    const result = await executeRuntimeAIAction(
      user,
      appCode,
      table,
      recordId,
      input.action
    );
    return NextResponse.json(result);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "AI_EXECUTE",
        resourceType: "ai",
        resourceName: recordId,
        detailJson: {
          appCode,
          tableCode: table,
          recordId,
          action: input?.action ?? "",
        },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
