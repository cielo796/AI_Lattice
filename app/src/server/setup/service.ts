import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/server/auth/crypto";
import { validateDisplayName, validateEmail, validateNewPassword } from "@/server/auth/validation";
import { getPrismaClient } from "@/server/db/prisma";
import { isTransactionConflict } from "@/server/db/transaction-errors";
import { isDemoAutoSeedEnabled } from "@/server/demo/seed-policy";
import { ServiceError } from "@/server/errors/service-error";
import type { User } from "@/types/user";

export interface InitialWorkspaceInput {
  setupToken?: unknown;
  organizationName?: unknown;
  organizationCode?: unknown;
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

function configuredSetupToken() {
  const token = process.env.SETUP_TOKEN?.trim() ?? "";
  return token.length >= 32 ? token : null;
}

export async function getSetupStatus() {
  if (isDemoAutoSeedEnabled() || !configuredSetupToken()) {
    return { available: false };
  }

  return { available: (await getPrismaClient().tenant.count()) === 0 };
}

export async function createInitialWorkspace(input: InitialWorkspaceInput): Promise<User> {
  const token = configuredSetupToken();
  if (isDemoAutoSeedEnabled() || !token) {
    throw new ServiceError("初期設定は現在利用できません。", 403);
  }

  if (
    typeof input?.setupToken !== "string" ||
    input.setupToken.length > 1024 ||
    !timingSafeEqual(
      createHash("sha256").update(token).digest(),
      createHash("sha256").update(input.setupToken).digest()
    )
  ) {
    throw new ServiceError("初期設定トークンが正しくありません。", 403);
  }

  const organizationName = validateDisplayName(input.organizationName, "組織名");
  const organizationCode = typeof input.organizationCode === "string"
    ? input.organizationCode.trim().toLowerCase()
    : "";
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(organizationCode)) {
    throw new ServiceError("組織コードは3〜64文字の半角英数字・ハイフンで入力してください。先頭と末尾にハイフンは使えません。", 400);
  }
  const name = validateDisplayName(input.name);
  const email = validateEmail(input.email);
  const passwordHash = await hashPassword(validateNewPassword(input.password));
  const prisma = getPrismaClient();

  try {
    return await prisma.$transaction(async (transaction) => {
      if (await transaction.tenant.count() > 0) {
        throw new ServiceError("初期設定は完了しています。ログインしてください。", 409);
      }

      const tenant = await transaction.tenant.create({
        data: { name: organizationName, code: organizationCode, planType: "standard" },
      });
      const user = await transaction.user.create({
        data: { tenantId: tenant.id, name, email, passwordHash },
      });
      const role = await transaction.role.create({
        data: {
          tenantId: tenant.id,
          name: "Tenant Admin",
          roleType: "tenant_admin",
          permissionsJson: ["*"],
          isSystem: true,
        },
      });
      await transaction.userRole.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: role.id, createdById: user.id },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorId: user.id,
          actorName: name,
          actionType: "WORKSPACE_SETUP",
          resourceType: "tenant",
          resourceId: tenant.id,
          resourceName: organizationName,
        },
      });

      return {
        id: user.id,
        tenantId: tenant.id,
        email: user.email,
        name: user.name,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (
      isTransactionConflict(error) ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    ) {
      throw new ServiceError("別の初期設定が実行されました。画面を更新して確認してください。", 409);
    }
    throw error;
  }
}
