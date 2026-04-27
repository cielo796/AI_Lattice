import type { User } from "@/types/user";
import { ensureDemoAuthData } from "@/server/auth/bootstrap";
import { verifyPassword } from "@/server/auth/crypto";
import { getCurrentSession } from "@/server/auth/session";
import { getPrismaClient } from "@/server/db/prisma";

interface LoginInput {
  email: string;
  password: string;
}

function toPublicUser(user: {
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

export async function authenticateUser({ email, password }: LoginInput) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return null;
  }

  await ensureDemoAuthData();

  const prisma = getPrismaClient();
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      status: "active",
    },
  });

  if (!user?.passwordHash) {
    return null;
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    return null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return toPublicUser(updatedUser);
}

export async function findUserById(userId: string) {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  return user ? toPublicUser(user) : null;
}

export async function findUserByEmailForAudit(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  await ensureDemoAuthData();

  const prisma = getPrismaClient();
  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
    },
  });

  return user ? toPublicUser(user) : null;
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const session = await getCurrentSession();

  if (!session || session.user.status !== "active") {
    return null;
  }

  return toPublicUser(session.user);
}
