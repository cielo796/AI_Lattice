import { NextResponse } from "next/server";
import {
  createFieldForTable,
  type CreateFieldInput,
  listFieldsForTable,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string; tableId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId } = await context.params;
    const fields = await listFieldsForTable(user, appId, tableId);
    return NextResponse.json(fields);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let input: CreateFieldInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId } = await context.params);
    input = await parseJsonBody<CreateFieldInput>(request);
    const field = await createFieldForTable(user, appId, tableId, input);
    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "FIELD_CREATE",
        resourceType: "field",
        resourceName: input?.name,
        detailJson: { appId, tableId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
