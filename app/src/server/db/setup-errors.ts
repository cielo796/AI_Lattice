import { Prisma } from "@prisma/client";

const DATABASE_SETUP_ERROR_CODES = new Set([
  "P1000",
  "P1001",
  "P1003",
  "P1010",
  "P2021",
  "P2022",
]);

export const DATABASE_SETUP_ERROR_CODE = "DATABASE_SETUP_REQUIRED";

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isDatabaseSetupError(error: unknown) {
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
