import { NextResponse } from "next/server";
import {
  createCommentForRecord,
  type CreateRecordCommentInput,
  listCommentsForRecord,
} from "@/server/records/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appCode: string; table: string; recordId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const comments = await listCommentsForRecord(user, appCode, table, recordId);
    return NextResponse.json(comments);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const input = await parseJsonBody<CreateRecordCommentInput>(request);
    const comment = await createCommentForRecord(user, appCode, table, recordId, input);
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
