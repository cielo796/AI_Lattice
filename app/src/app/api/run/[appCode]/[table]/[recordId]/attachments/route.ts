import { mkdir, unlink, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { AppsServiceError } from "@/server/apps/service";
import {
  createAttachmentForRecord,
  type CreateAttachmentInput,
  getRecordForTable,
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

function sanitizeFileName(fileName: string) {
  const normalized = path
    .basename(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "attachment";
}

async function parseMultipartAttachment(
  request: Request,
  recordId: string
) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new AppsServiceError("Attachment file is required", 400);
  }

  const safeFileName = sanitizeFileName(file.name || "attachment");
  const storedFileName = `${crypto.randomUUID()}-${safeFileName}`;
  const recordDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "records",
    recordId
  );
  const absolutePath = path.join(recordDirectory, storedFileName);

  await mkdir(recordDirectory, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    absolutePath,
    input: {
      fileName: safeFileName,
      storagePath: `/uploads/records/${recordId}/${storedFileName}`,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    } satisfies CreateAttachmentInput,
  };
}

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
  let uploadedFilePath: string | null = null;

  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table, recordId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    let input: CreateAttachmentInput;

    if (contentType.includes("multipart/form-data")) {
      await getRecordForTable(user, appCode, table, recordId);
      const uploaded = await parseMultipartAttachment(request, recordId);
      uploadedFilePath = uploaded.absolutePath;
      input = uploaded.input;
    } else {
      input = await parseJsonBody<CreateAttachmentInput>(request);
    }

    const attachment = await createAttachmentForRecord(
      user,
      appCode,
      table,
      recordId,
      input
    );
    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (uploadedFilePath) {
      await unlink(uploadedFilePath).catch(() => undefined);
    }
    return toRouteErrorResponse(error);
  }
}
