import { NextResponse } from "next/server";
import {
  deleteFormForTable,
  getFormForTable,
  type UpdateFormInput,
  updateFormForTable,
} from "@/server/apps/service";
import {
  parseJsonBody,
  recordRouteFailure,
  requireAuthenticatedUser,
  toRouteErrorResponse,
} from "@/app/api/_helpers";
import type { User } from "@/types/user";

type RouteContext = {
  params: Promise<{ appId: string; tableId: string; formId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser();
    const { appId, tableId, formId } = await context.params;
    const form = await getFormForTable(user, appId, tableId, formId);
    return NextResponse.json(form);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let formId = "";
  let input: UpdateFormInput | undefined;

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId, formId } = await context.params);
    input = await parseJsonBody<UpdateFormInput>(request);
    const form = await updateFormForTable(user, appId, tableId, formId, input);
    return NextResponse.json(form);
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "FORM_UPDATE",
        resourceType: "form",
        resourceId: formId,
        resourceName: input?.name,
        detailJson: { appId, tableId, input },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  let user: User | null = null;
  let appId = "";
  let tableId = "";
  let formId = "";

  try {
    user = await requireAuthenticatedUser();
    ({ appId, tableId, formId } = await context.params);
    await deleteFormForTable(user, appId, tableId, formId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    await recordRouteFailure(
      user,
      {
        actionType: "FORM_DELETE",
        resourceType: "form",
        resourceId: formId,
        detailJson: { appId, tableId },
      },
      error
    );
    return toRouteErrorResponse(error);
  }
}
