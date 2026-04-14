import type { Prisma } from "@prisma/client";
import { mockApps } from "@/data/mock-apps";
import { mockFields, mockTables } from "@/data/mock-tables";
import { ensureDemoAuthData } from "@/server/auth/bootstrap";
import { getPrismaClient } from "@/server/db/prisma";

let bootstrapPromise: Promise<void> | null = null;

function toJsonObject(
  value: Record<string, unknown> | undefined
): Prisma.InputJsonObject | undefined {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonObject;
}

export async function ensureDemoBuilderData() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureDemoAuthData();

      const prisma = getPrismaClient();

      for (const app of mockApps) {
        const existingApp = await prisma.app.findUnique({
          where: { id: app.id },
          select: { id: true },
        });

        if (!existingApp) {
          await prisma.app.create({
            data: {
              id: app.id,
              tenantId: app.tenantId,
              name: app.name,
              code: app.code,
              description: app.description,
              status: app.status,
              icon: app.icon,
              createdById: app.createdBy,
              createdAt: new Date(app.createdAt),
              updatedAt: new Date(app.updatedAt),
            },
          });
        }
      }

      for (const table of mockTables) {
        const existingTable = await prisma.appTable.findUnique({
          where: { id: table.id },
          select: { id: true },
        });

        if (!existingTable) {
          await prisma.appTable.create({
            data: {
              id: table.id,
              tenantId: table.tenantId,
              appId: table.appId,
              name: table.name,
              code: table.code,
              isSystem: table.isSystem,
              sortOrder: table.sortOrder,
              createdAt: new Date(table.createdAt),
            },
          });
        }
      }

      for (const field of mockFields) {
        const existingField = await prisma.appField.findUnique({
          where: { id: field.id },
          select: { id: true },
        });

        if (!existingField) {
          await prisma.appField.create({
            data: {
              id: field.id,
              tenantId: field.tenantId,
              appId: field.appId,
              tableId: field.tableId,
              name: field.name,
              code: field.code,
              fieldType: field.fieldType,
              required: field.required,
              uniqueFlag: field.uniqueFlag,
              defaultValue:
                field.defaultValue === undefined
                  ? undefined
                  : (field.defaultValue as Prisma.InputJsonValue),
              settingsJson: toJsonObject(field.settingsJson),
              sortOrder: field.sortOrder,
              createdAt: new Date(field.createdAt),
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
