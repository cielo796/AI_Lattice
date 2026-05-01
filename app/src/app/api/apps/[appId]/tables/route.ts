import { NextResponse } from "next/server";
import {
  createTableForApp,
  type CreateTableInput,
  listTablesForApp,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

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
  let user: User | null = null;
  let appId = "";
  let input: CreateTableInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId } = await context.params);
    input = await parseJsonBody<CreateTableInput>(request);
    const table = await createTableForApp(user, appId, input);
    return NextResponse.json(table, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "TABLE_CREATE",
        resourceType: "table",
        resourceName: input?.name,
        detailJson: { appId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
