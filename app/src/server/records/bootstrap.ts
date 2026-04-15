import type { Prisma } from "@prisma/client";
import {
  mockAttachments,
  mockComments,
  mockRecords,
} from "@/data/mock-records";
import { ensureDemoBuilderData } from "@/server/apps/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";

let bootstrapPromise: Promise<void> | null = null;

function toJsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject;
}

export async function ensureDemoRecordData() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureDemoBuilderData();

      const prisma = getPrismaClient();

      for (const record of mockRecords) {
        const existingRecord = await prisma.appRecord.findUnique({
          where: { id: record.id },
          select: { id: true },
        });

        if (!existingRecord) {
          await prisma.appRecord.create({
            data: {
              id: record.id,
              tenantId: record.tenantId,
              appId: record.appId,
              tableId: record.tableId,
              status: record.status,
              dataJson: toJsonObject(record.data),
              createdById: record.createdBy,
              updatedById: record.updatedBy,
              createdAt: new Date(record.createdAt),
              updatedAt: new Date(record.updatedAt),
              deletedAt: record.deletedAt ? new Date(record.deletedAt) : undefined,
            },
          });
        }
      }

      for (const comment of mockComments) {
        const existingComment = await prisma.recordComment.findUnique({
          where: { id: comment.id },
          select: { id: true },
        });

        if (!existingComment) {
          await prisma.recordComment.create({
            data: {
              id: comment.id,
              tenantId: comment.tenantId,
              recordId: comment.recordId,
              commentText: comment.commentText,
              createdById: comment.createdBy,
              createdAt: new Date(comment.createdAt),
              isSystem: comment.isSystem ?? false,
            },
          });
        }
      }

      for (const attachment of mockAttachments) {
        const existingAttachment = await prisma.attachment.findUnique({
          where: { id: attachment.id },
          select: { id: true },
        });

        if (!existingAttachment) {
          await prisma.attachment.create({
            data: {
              id: attachment.id,
              tenantId: attachment.tenantId,
              recordId: attachment.recordId,
              fileName: attachment.fileName,
              storagePath: attachment.storagePath,
              mimeType: attachment.mimeType,
              fileSize: attachment.fileSize,
              uploadedById: attachment.uploadedBy,
              createdAt: new Date(attachment.createdAt),
            },
          });
        }
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  await bootstrapPromise;
}
