import { NextResponse } from "next/server";
import { requireAuthenticatedUser, toRouteErrorResponse } from "@/app/api/_helpers";
import { getWorkflowEditorContextForUser } from "@/server/workflows/editor-context";

export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    return NextResponse.json(await getWorkflowEditorContextForUser(user, appId));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
