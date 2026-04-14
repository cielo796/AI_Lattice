import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/service";

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
