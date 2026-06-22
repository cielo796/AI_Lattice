import { NextResponse } from "next/server";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import {
  getProfile,
  updateProfile,
  type UpdateProfileInput,
} from "@/server/profile/service";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json(await getProfile(user));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = await parseJsonBody<UpdateProfileInput>(request);
    return NextResponse.json(await updateProfile(user, input));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
