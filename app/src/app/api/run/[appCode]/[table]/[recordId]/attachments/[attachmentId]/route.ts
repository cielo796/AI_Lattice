import { NextResponse } from "next/server";
import { deleteAttachmentForRecord } from "@/server/records/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{
    appCode: string;
    table: string;
    recordId: string;
    attachmentId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId, attachmentId } = await context.params;
    await deleteAttachmentForRecord(
      user,
      appCode,
      table,
      recordId,
      attachmentId
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
