import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/service";
import { AppsServiceError } from "@/server/apps/service";

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new AppsServiceError("Unauthorized", 401);
  }

  return user;
}

export async function parseJsonBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppsServiceError("Invalid request body", 400);
  }
}

export function toRouteErrorResponse(error: unknown) {
  if (error instanceof AppsServiceError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { message: "Internal server error" },
    { status: 500 }
  );
}
