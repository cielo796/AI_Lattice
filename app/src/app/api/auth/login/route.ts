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
    const body = await parseJsonBody<{ email?: unknown; password?: unknown; tenantCode?: unknown }>(
      request
    );
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const tenantCode = typeof body?.tenantCode === "string" ? body.tenantCode.trim() : undefined;

    if (!email || !password || email.length > 254 || password.length > 256 || (tenantCode?.length ?? 0) > 64) {
      return NextResponse.json(
        { message: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const user = await authenticateUser({ email, password, tenantCode });
    if (!user) {
      const auditUser = await findUserByEmailForAudit(email, tenantCode);
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
