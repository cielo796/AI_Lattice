import { NextResponse } from "next/server";
import { authenticateUser } from "@/server/auth/service";
import { createSessionForUser } from "@/server/auth/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "リクエスト本文が不正です" }, { status: 400 });
  }

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
}
