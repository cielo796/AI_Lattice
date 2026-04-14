import { NextResponse } from "next/server";
import {
  createFieldForTable,
  type CreateFieldInput,
  listFieldsForTable,
} from "@/server/apps/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

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
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId } = await context.params;
    const input = await parseJsonBody<CreateFieldInput>(request);
    const field = await createFieldForTable(user, appId, tableId, input);
    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
