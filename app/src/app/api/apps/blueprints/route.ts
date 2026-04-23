import { NextResponse } from "next/server";
import { createAppFromBlueprint } from "@/server/apps/blueprints";
import type { GeneratedAppBlueprint } from "@/types/ai";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const blueprint = await parseJsonBody<GeneratedAppBlueprint>(request);
    const app = await createAppFromBlueprint(user, blueprint);
    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
