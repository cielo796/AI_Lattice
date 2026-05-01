import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/service";
import { recordAuditFailure, type RecordAuditLogInput } from "@/server/audit/service";
import { AppsServiceError } from "@/server/apps/service";
import {
  isDatabaseSetupError,
  toDatabaseSetupErrorBody,
} from "@/server/db/setup-errors";
import type { User } from "@/types/user";

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AppsServiceError("認証が必要です", 401);
  }

  return user;
}

export async function parseJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppsServiceError("リクエスト本文が不正です", 400);
  }
}

export function toRouteErrorResponse(error: unknown) {
  if (error instanceof AppsServiceError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status }
    );
  }

  if (isDatabaseSetupError(error)) {
    return NextResponse.json(toDatabaseSetupErrorBody(error), { status: 503 });
  }

  return NextResponse.json(
    { message: "サーバー内部エラーが発生しました" },
    { status: 500 }
  );
}

export async function recordRouteFailure(
  user: User | null | undefined,
  input: Omit<RecordAuditLogInput, "result">,
  error: unknown
) {
  if (!user) {
    return;
  }

  await recordAuditFailure(user, input, error);
}
