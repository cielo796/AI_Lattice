import { NextResponse } from "next/server";
import { parseJsonBody, toRouteErrorResponse } from "@/app/api/_helpers";
import { authenticateUser } from "@/server/auth/service";
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
      return NextResponse.json(
        { message: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    await createSessionForUser(user);

    return NextResponse.json({ user });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
