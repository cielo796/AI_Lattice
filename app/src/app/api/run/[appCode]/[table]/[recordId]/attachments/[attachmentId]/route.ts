import { unlink } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
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

async function deleteUploadedFile(storagePath: string) {
  if (!storagePath.startsWith("/uploads/")) {
    return;
  }

  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const relativePath = storagePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(process.cwd(), "public", relativePath);

  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return;
  }

  await unlink(absolutePath).catch(() => undefined);
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId, attachmentId } = await context.params;
    const attachment = await deleteAttachmentForRecord(
      user,
      appCode,
      table,
      recordId,
      attachmentId
    );
    await deleteUploadedFile(attachment.storagePath);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
