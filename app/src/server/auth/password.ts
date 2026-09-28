import { hashPassword, verifyPassword } from "@/server/auth/crypto";
import { validateNewPassword } from "@/server/auth/validation";
import { getPrismaClient } from "@/server/db/prisma";
import { ServiceError } from "@/server/errors/service-error";
import type { User } from "@/types/user";

export async function changePassword(user: User, input: { currentPassword?: unknown; newPassword?: unknown }) {
  if (typeof input?.currentPassword !== "string" || !input.currentPassword || input.currentPassword.length > 256) {
    throw new ServiceError("現在のパスワードを入力してください。", 400);
  }
  const newPassword = validateNewPassword(input.newPassword);
  if (newPassword === input.currentPassword) {
    throw new ServiceError("現在と異なるパスワードを入力してください。", 400);
  }

  const prisma = getPrismaClient();
  const account = await prisma.user.findFirst({
    where: { id: user.id, tenantId: user.tenantId, status: "active" },
    select: { passwordHash: true },
  });
  if (!account?.passwordHash || !await verifyPassword(input.currentPassword, account.passwordHash)) {
    throw new ServiceError("現在のパスワードが正しくありません。", 400);
  }
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: { id: user.id, tenantId: user.tenantId, passwordHash: account.passwordHash, status: "active" },
      data: { passwordHash },
    });
    if (updated.count !== 1) {
      throw new ServiceError("認証情報が変更されました。ログインし直してください。", 409);
    }
    await transaction.session.deleteMany({ where: { userId: user.id, tenantId: user.tenantId } });
    await transaction.auditLog.create({
      data: {
        tenantId: user.tenantId, actorId: user.id, actorName: user.name,
        actionType: "AUTH_PASSWORD_CHANGE", resourceType: "user", resourceId: user.id,
      },
    });
  });
}
