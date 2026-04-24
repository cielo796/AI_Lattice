import { NextResponse } from "next/server";
import { toRouteErrorResponse } from "@/app/api/_helpers";
import { getAuthenticatedUser } from "@/server/auth/service";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
