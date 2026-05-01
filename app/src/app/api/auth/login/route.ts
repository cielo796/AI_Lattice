import { NextResponse } from "next/server";
import { parseJsonBody, toRouteErrorResponse } from "@/app/api/_helpers";
import { recordAuditFailure, recordAuditLog } from "@/server/audit/service";
import {
  authenticateUser,
  findUserByEmailForAudit,
} from "@/server/auth/service";
import { createSessionForUser } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ email?: string; password?: string }>(
      request
    );
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json(
        { message: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const user = await authenticateUser({ email, password });
    if (!user) {
      const auditUser = await findUserByEmailForAudit(email);
      if (auditUser) {
        await recordAuditFailure(
          auditUser,
          {
            actionType: "AUTH_LOGIN",
            resourceType: "auth",
            resourceId: auditUser.id,
            resourceName: auditUser.email,
            detailJson: { email },
          },
          Object.assign(new Error("Invalid credentials"), { status: 401 })
        );
      }

      return NextResponse.json(
        { message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    await createSessionForUser(user);
    await recordAuditLog(user, {
      actionType: "AUTH_LOGIN",
      resourceType: "auth",
      resourceId: user.id,
      resourceName: user.email,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
