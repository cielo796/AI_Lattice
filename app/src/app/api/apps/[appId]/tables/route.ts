import { NextResponse } from "next/server";
import {
  createTableForApp,
  type CreateTableInput,
  listTablesForApp,
} from "@/server/apps/service";
import {
  parseJsonBody,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const tables = await listTablesForApp(user, appId);
    return NextResponse.json(tables);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId } = await context.params;
    const input = await parseJsonBody<CreateTableInput>(request);
    const table = await createTableForApp(user, appId, input);
    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
