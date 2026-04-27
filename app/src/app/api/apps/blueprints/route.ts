import { NextResponse } from "next/server";
import { createAppFromBlueprint } from "@/server/apps/blueprints";
import type { GeneratedAppBlueprint } from "@/types/ai";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

export async function POST(request: Request) {
  let user: User | null = null;
  let blueprint: GeneratedAppBlueprint | undefined;

  try {
    user = await requireAuthenticatedUser();
    blueprint = await parseJsonBody<GeneratedAppBlueprint>(request);
    const app = await createAppFromBlueprint(user, blueprint);
    return NextResponse.json(app, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "APP_CREATE",
        resourceType: "app",
        resourceName: blueprint?.name,
        detailJson: {
          source: "ai_blueprint",
          code: blueprint?.code,
        },
        aiInvolvement: "assisted",
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
