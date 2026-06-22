import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import { getCurrentTenant } from "@/server/admin/tenant";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const tenant = await getCurrentTenant(user);
    return NextResponse.json([tenant]);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

