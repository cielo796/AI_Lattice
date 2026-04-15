import { NextResponse } from "next/server";
import {
  createAttachmentForRecord,
  type CreateAttachmentInput,
  listAttachmentsForRecord,
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
    const attachments = await listAttachmentsForRecord(
      user,
      appCode,
      table,
      recordId
    );
    return NextResponse.json(attachments);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const input = await parseJsonBody<CreateAttachmentInput>(request);
    const attachment = await createAttachmentForRecord(
      user,
      appCode,
      table,
      recordId,
      input
    );
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
