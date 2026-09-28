import { NextResponse } from "next/server";
import { parseJsonBody, toRouteErrorResponse } from "@/app/api/_helpers";
import { createInitialWorkspace, type InitialWorkspaceInput } from "@/server/setup/service";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody<InitialWorkspaceInput>(request);
    await createInitialWorkspace(input);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
