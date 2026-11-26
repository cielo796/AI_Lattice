import { NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/app/api/_helpers";
import { receiveWorkflowWebhook } from "@/server/workflows/webhook";

export const maxDuration = 60;

// 外部システムからの受信口。ログインセッションではなく、ワークフローごとのHMAC署名で認証する。
export async function POST(request: Request, context: { params: Promise<{ workflowId: string }> }) {
  try {
    const { workflowId } = await context.params;
    const receipt = await receiveWorkflowWebhook(workflowId, request);
    return NextResponse.json(receipt, { status: receipt.duplicate ? 200 : 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
