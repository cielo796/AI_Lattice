import { Prisma } from "@prisma/client";

const DATABASE_SETUP_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "P1000",
  "P1001",
  "P1003",
  "P1010",
  "P2021",
  "P2022",
]);

export const DATABASE_SETUP_ERROR_CODE = "DATABASE_SETUP_REQUIRED";

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = error.code;
  return typeof code === "string" ? code : null;
}

function getMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map(getMessage)]
      .filter(Boolean)
      .join("; ");
  }

  return error instanceof Error ? error.message : String(error);
}

function containsDatabaseSetupErrorCode(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code && DATABASE_SETUP_ERROR_CODES.has(code)) {
    return true;
  }

  if (error instanceof AggregateError) {
    return error.errors.some(containsDatabaseSetupErrorCode);
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("cause" in error && containsDatabaseSetupErrorCode(error.cause)) {
    return true;
  }

  if ("errors" in error && Array.isArray(error.errors)) {
    return error.errors.some(containsDatabaseSetupErrorCode);
  }

  return false;
}

export function isDatabaseSetupError(error: unknown) {
  if (containsDatabaseSetupErrorCode(error)) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    DATABASE_SETUP_ERROR_CODES.has(error.code)
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = getMessage(error);

  return (
    message.includes("DATABASE_URL is not set") ||
    /table .* does not exist/i.test(message) ||
    /does not exist in the current database/i.test(message) ||
    /can't reach database server/i.test(message) ||
    /database .* does not exist/i.test(message)
  );
}

export function toDatabaseSetupErrorBody(error: unknown) {
  return {
    code: DATABASE_SETUP_ERROR_CODE,
    message:
      "データベースのセットアップが完了していません。管理者は DATABASE_URL、Prisma migration、seed の状態を確認してください。",
    adminHint:
      "npm run db:migrate:deploy を実行し、/api/health/db で missingTables と seed.missing を確認してください。",
    healthCheckPath: "/api/health/db",
    ...(process.env.NODE_ENV === "production"
      ? {}
      : { details: getMessage(error) }),
  };
}
