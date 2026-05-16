import { NextResponse } from "next/server";
import {
  createFormForTable,
  type CreateFormInput,
  listFormsForTable,
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
    const forms = await listFormsForTable(user, appId, tableId);
    return NextResponse.json(forms);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let input: CreateFormInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId } = await context.params);
    input = await parseJsonBody<CreateFormInput>(request);
    const form = await createFormForTable(user, appId, tableId, input);
    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "FORM_CREATE",
        resourceType: "form",
        resourceName: input?.name,
        detailJson: { appId, tableId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
