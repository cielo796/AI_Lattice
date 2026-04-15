import { NextResponse } from "next/server";
import { getRuntimeTableMeta } from "@/server/records/service";
import {
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";

type RouteContext = {
  params: Promise<{ appCode: string; table: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appCode, table } = await context.params;
    const meta = await getRuntimeTableMeta(user, appCode, table);
    return NextResponse.json(meta);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
