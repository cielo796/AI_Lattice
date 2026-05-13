import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET as listWorkflows,
  POST as createWorkflow,
} from "@/app/api/apps/[appId]/workflows/route";
import {
  DELETE as deleteWorkflow,
  PUT as updateWorkflow,
} from "@/app/api/apps/[appId]/workflows/[workflowId]/route";
import { GET as listApprovals } from "@/app/api/admin/approvals/route";
import { PUT as decideApproval } from "@/app/api/admin/approvals/[approvalId]/route";
import {
  GET as listRecordApprovals,
  POST as createRecordApproval,
} from "@/app/api/run/[appCode]/[table]/[recordId]/approvals/route";
import { AppsServiceError } from "@/server/apps/service";

const {
  requireAuthenticatedUser,
  createApprovalForRecord,
  createWorkflowForApp,
  deleteWorkflowForApp,
  listApprovalsForRecord,
  listApprovalsForUser,
  listWorkflowsForApp,
  updateApprovalDecision,
  updateWorkflowForApp,
} = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  createApprovalForRecord: vi.fn(),
  createWorkflowForApp: vi.fn(),
  deleteWorkflowForApp: vi.fn(),
  listApprovalsForRecord: vi.fn(),
  listApprovalsForUser: vi.fn(),
  listWorkflowsForApp: vi.fn(),
  updateApprovalDecision: vi.fn(),
  updateWorkflowForApp: vi.fn(),
}));

vi.mock("@/app/api/_helpers", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/_helpers")>(
    "@/app/api/_helpers"
  );

  return {
    ...actual,
    requireAuthenticatedUser,
  };
});

vi.mock("@/server/workflows/service", () => ({
  MAX_APPROVAL_LIMIT: 500,
  createApprovalForRecord,
  createWorkflowForApp,
  deleteWorkflowForApp,
  listApprovalsForRecord,
  listApprovalsForUser,
  listWorkflowsForApp,
  updateApprovalDecision,
  updateWorkflowForApp,
}));

const user = {
  id: "u-001",
  tenantId: "t-001",
};

function appContext() {
  return {
    params: Promise.resolve({ appId: "app-001" }),
  };
}

function workflowContext() {
  return {
    params: Promise.resolve({ appId: "app-001", workflowId: "wf-001" }),
  };
}

function approvalContext() {
  return {
    params: Promise.resolve({ approvalId: "appr-001" }),
  };
}

function recordContext() {
  return {
    params: Promise.resolve({
      appCode: "support-desk",
      table: "tickets",
      recordId: "rec-001",
    }),
  };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("workflow and approval routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedUser.mockResolvedValue(user);
  });

  it("returns 401 before entering workflow services", async () => {
    requireAuthenticatedUser.mockRejectedValue(
      new AppsServiceError("Unauthorized", 401)
    );

    const response = await listWorkflows(
      new Request("http://localhost/api/apps/app-001/workflows"),
      appContext()
    );

    expect(response.status).toBe(401);
    expect(listWorkflowsForApp).not.toHaveBeenCalled();
  });

  it("covers workflow list, create, update, and delete routes", async () => {
    const workflow = {
      id: "wf-001",
      name: "承認フロー",
      status: "active",
      triggerType: "update",
    };
    const createInput = {
      name: "承認フロー",
      triggerType: "update",
      status: "draft",
      definitionJson: { nodes: [], edges: [] },
    };
    const updateInput = {
      status: "active",
      definitionJson: { nodes: [], edges: [] },
    };

    listWorkflowsForApp.mockResolvedValue([workflow]);
    createWorkflowForApp.mockResolvedValue({ ...workflow, status: "draft" });
    updateWorkflowForApp.mockResolvedValue(workflow);
    deleteWorkflowForApp.mockResolvedValue(undefined);

    const listResponse = await listWorkflows(
      new Request("http://localhost/api/apps/app-001/workflows"),
      appContext()
    );
    const createResponse = await createWorkflow(
      jsonRequest(
        "http://localhost/api/apps/app-001/workflows",
        "POST",
        createInput
      ),
      appContext()
    );
    const updateResponse = await updateWorkflow(
      jsonRequest(
        "http://localhost/api/apps/app-001/workflows/wf-001",
        "PUT",
        updateInput
      ),
      workflowContext()
    );
    const deleteResponse = await deleteWorkflow(
      new Request("http://localhost/api/apps/app-001/workflows/wf-001", {
        method: "DELETE",
      }),
      workflowContext()
    );

    expect(await listResponse.json()).toEqual([workflow]);
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(204);
    expect(createWorkflowForApp).toHaveBeenCalledWith(user, "app-001", createInput);
    expect(updateWorkflowForApp).toHaveBeenCalledWith(
      user,
      "app-001",
      "wf-001",
      updateInput
    );
  });

  it("covers admin and record approval routes", async () => {
    const approval = {
      id: "appr-001",
      title: "問い合わせの承認",
      status: "pending",
    };
    const decisionInput = {
      status: "approved",
      commentText: "確認しました。",
    };
    const createInput = {
      workflowId: "wf-001",
      title: "問い合わせの承認",
    };

    listApprovalsForUser.mockResolvedValue([approval]);
    updateApprovalDecision.mockResolvedValue({
      ...approval,
      status: "approved",
    });
    listApprovalsForRecord.mockResolvedValue([approval]);
    createApprovalForRecord.mockResolvedValue(approval);

    const adminListResponse = await listApprovals(
      new Request("http://localhost/api/admin/approvals?status=pending")
    );
    const decisionResponse = await decideApproval(
      jsonRequest(
        "http://localhost/api/admin/approvals/appr-001",
        "PUT",
        decisionInput
      ),
      approvalContext()
    );
    const recordListResponse = await listRecordApprovals(
      new Request(
        "http://localhost/api/run/support-desk/tickets/rec-001/approvals"
      ),
      recordContext()
    );
    const recordCreateResponse = await createRecordApproval(
      jsonRequest(
        "http://localhost/api/run/support-desk/tickets/rec-001/approvals",
        "POST",
        createInput
      ),
      recordContext()
    );

    expect(await adminListResponse.json()).toEqual([approval]);
    expect(await decisionResponse.json()).toEqual({
      ...approval,
      status: "approved",
    });
    expect(await recordListResponse.json()).toEqual([approval]);
    expect(recordCreateResponse.status).toBe(201);
    expect(listApprovalsForUser).toHaveBeenCalledWith(user, {
      status: "pending",
      limit: undefined,
    });
    expect(updateApprovalDecision).toHaveBeenCalledWith(
      user,
      "appr-001",
      decisionInput
    );
    expect(createApprovalForRecord).toHaveBeenCalledWith(
      user,
      "support-desk",
      "tickets",
      "rec-001",
      createInput
    );
  });
});
