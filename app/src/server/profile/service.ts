import { recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { ServiceError } from "@/server/errors/service-error";
import type { User } from "@/types/user";

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string;
}

function toUser(user: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: "active" | "inactive";
  lastLoginAt: Date | null;
  createdAt: Date;
}): User {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? undefined,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getProfile(user: User) {
  const profile = await getPrismaClient().user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
  });

  if (!profile) {
    throw new ServiceError("プロフィールが見つかりません。", 404);
  }

  return toUser(profile);
}

export async function updateProfile(user: User, input: UpdateProfileInput) {
  const name = input.name?.trim();
  const avatarUrl = input.avatarUrl?.trim() || null;

  if (!name) {
    throw new ServiceError("表示名は必須です。", 400);
  }

  if (avatarUrl) {
    try {
      const url = new URL(avatarUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new ServiceError("画像URLは有効な http(s) URL で指定してください。", 400);
    }
  }

  const updated = await getPrismaClient().user.update({
    where: { id: user.id },
    data: { name, avatarUrl },
  });

  await recordAuditLog(user, {
    actionType: "PROFILE_UPDATE",
    resourceType: "user",
    resourceId: user.id,
    resourceName: name,
    detailJson: { avatarUpdated: avatarUrl !== (user.avatarUrl ?? null) },
  });

  return toUser(updated);
}
