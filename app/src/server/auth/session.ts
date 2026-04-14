import { cookies, headers } from "next/headers";
import { generateSessionToken, hashSessionToken } from "@/server/auth/crypto";
import { getPrismaClient } from "@/server/db/prisma";

export const SESSION_COOKIE_NAME = "stitch_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

interface SessionUser {
  id: string;
  tenantId: string;
}

function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

async function shouldUseSecureCookies() {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "";
  const isLocalHost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (forwardedProto) {
    return forwardedProto === "https";
  }

  return process.env.NODE_ENV === "production" && !isLocalHost;
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function setSessionToken(token: string) {
  const cookieStore = await cookies();
  const secure = await shouldUseSecureCookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function createSessionForUser(user: SessionUser) {
  const prisma = getPrismaClient();
  const token = generateSessionToken();

  await prisma.session.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: getSessionExpiresAt(),
    },
  });

  await setSessionToken(token);
}

export async function getCurrentSession() {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  const prisma = getPrismaClient();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({
      where: { id: session.id },
    });
    await clearSessionCookie();
    return null;
  }

  return session;
}

export async function getSessionUserId() {
  const session = await getCurrentSession();
  return session?.userId ?? null;
}

export async function clearSession() {
  const token = await getSessionToken();

  if (token) {
    const prisma = getPrismaClient();

    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  await clearSessionCookie();
}
