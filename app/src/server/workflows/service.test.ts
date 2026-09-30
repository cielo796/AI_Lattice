import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WORKFLOW_DEFINITION, createWorkflowForApp, listWorkflowsForApp, runApprovalWorkflowsForRecord, updateApprovalDecision } from "./service";
import type { User } from "@/types/user";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  getPrismaClient: vi.fn(), requirePermission: vi.fn(),
  recordAuditLog: vi.fn(), recordAuditFailure: vi.fn(), executeSavedWorkflowRun: vi.fn(),
  executeRuntimeAIAction: vi.fn(),
}));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: mocks.recordAuditLog, recordAuditFailure: mocks.recordAuditFailure }));
vi.mock("@/server/apps/bootstrap", () => ({ ensureDemoBuilderData: vi.fn() }));
vi.mock("@/server/notifications/service", () => ({
  createNotification: vi.fn(), createNotificationsForUsers: vi.fn(), listWorkflowNotificationRecipients: vi.fn(),
}));
vi.mock("./execution", async (importOriginal) => ({
  ...await importOriginal<typeof import("./execution")>(), executeSavedWorkflowRun: mocks.executeSavedWorkflowRun,
}));
vi.mock("@/server/ai/runtime-ai", () => ({ executeRuntimeAIAction: mocks.executeRuntimeAIAction, isRuntimeAIAction: (action: string) => ["summarize", "next_actions", "reply_draft"].includes(action) }));

const user: User = { id: "user_1", tenantId: "tenant_1", name: "Owner", email: "owner@example.com", status: "active", createdAt: "2026-04-24T00:00:00Z" };
const workflow = {
  id: "wf_1", tenantId: user.tenantId, appId: "app_1", name: "承認",
  triggerType: "update", status: "active", definitionJson: DEFAULT_WORKFLOW_DEFINITION,
  createdById: user.id, createdAt: new Date(), updatedAt: new Date(), _count: { approvals: 0 },
};
const input = {
  appId: "app_1", appCode: "requests", tableId: "table_1", tableCode: "requests", tableName: "申請",
  recordId: "record_1", recordTitle: "申請", triggerTypes: ["update" as const], eventKey: "event_1",
};

function approvalFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "approval_1", tenantId: user.tenantId, appId: "app_1", tableId: "table_1", recordId: "record_1",
    workflowId: null, workflowRunId: null, workflowNodeId: null, appApprovalSettingId: null,
    approverId: user.id, requestedById: user.id, actedById: null, status: "pending", title: "申請",
    description: null, commentText: null, actedAt: null, createdAt: new Date(), updatedAt: new Date(),
    approvedStatus: "ready_to_publish", record: { id: "record_1", status: "pending", dataJson: { title: "申請" } },
    workflow: null, assignees: [], ...overrides,
  };
}

describe("workflows service", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); mocks.requirePermission.mockResolvedValue(undefined); });

  async function executor() {
    await runApprovalWorkflowsForRecord(user, input);
    return mocks.executeSavedWorkflowRun.mock.calls.at(-1)![2] as import("./execution").WorkflowNodeExecutor;
  }

  function dispatchPrisma() {
    return {
      workflow: { findMany: vi.fn().mockResolvedValue([workflow]) },
      appRecord: { findFirst: vi.fn().mockResolvedValue({ id: input.recordId, status: "draft", dataJson: {} }) },
      workflowRun: { upsert: vi.fn().mockResolvedValue({ id: "run_1" }) },
      approval: { findMany: vi.fn().mockResolvedValue([]) },
    };
  }

  it("executes configured API method, safe headers, JSON templates and timeout with a stable idempotency key", async () => {
    mocks.getPrismaClient.mockReturnValue(dispatchPrisma());
    vi.stubEnv("WORKFLOW_API_ALLOWED_ORIGINS", "https://example.com");
    const cancelBody = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel: cancelBody } });
    vi.stubGlobal("fetch", fetchMock);
    const execute = await executor();
    await execute(user, { ...input, recordTitle: 'A "quoted" title' }, { id: workflow.id, name: workflow.name, runId: "run_1", sourceWorkflowId: workflow.id }, {
      id: "api", data: { label: "API", nodeType: "api_call", config: { url: "https://example.com/records", method: "PATCH", timeoutMs: 1000, headers: '{"X-Record":"{{recordId}}","Content-Type":"application/json; charset=utf-8"}', bodyTemplate: '{"title":"{{recordTitle}}","amount":2}' } },
    }, { appRecord: { findFirst: vi.fn().mockResolvedValue({ id: input.recordId, dataJson: {} }) } } as never);
    const request = fetchMock.mock.calls[0][1];
    expect(request).toMatchObject({ method: "PATCH", redirect: "manual", headers: { "x-record": input.recordId, "idempotency-key": "run_1:api", "content-type": "application/json; charset=utf-8" } });
    expect(Object.keys(request.headers)).toHaveLength(3);
    expect(cancelBody).toHaveBeenCalledOnce();
    expect(JSON.parse(request.body)).toEqual({ title: 'A "quoted" title', amount: 2 });
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it("applies AI model/prompt config and writes output to a validated field without discarding other values", async () => {
    mocks.getPrismaClient.mockReturnValue(dispatchPrisma());
    mocks.executeRuntimeAIAction.mockResolvedValue({ summary: "要約", modelName: "configured-model", usage: { totalTokens: 4 } });
    const transaction = {
      appRecord: { findFirst: vi.fn().mockResolvedValue({ id: input.recordId, dataJson: { title: "元の件名", amount: 5 } }), update: vi.fn() },
      appField: { findFirst: vi.fn().mockResolvedValue({ code: "title", fieldType: "text" }) },
      recordComment: { create: vi.fn() },
    };
    const execute = await executor();
    await execute(user, input, { id: workflow.id, name: workflow.name, runId: "run_1", sourceWorkflowId: workflow.id }, {
      id: "ai", data: { label: "AI", nodeType: "ai_action", config: { action: "summarize", model: "configured-model", promptTemplateKey: "summary", output: "field", outputFieldCode: "title" } },
    }, transaction as never);
    expect(mocks.executeRuntimeAIAction).toHaveBeenCalledWith(user, input.appCode, input.tableCode, input.recordId, "summarize", undefined, { model: "configured-model", promptTemplateKey: "summary" });
    expect(transaction.appRecord.update).toHaveBeenCalledWith({ where: { id: input.recordId }, data: { dataJson: { title: "AI summary: 要約", amount: 5 }, updatedById: user.id } });
    expect(transaction.recordComment.create).not.toHaveBeenCalled();
  });

  it("creates the compatible default definition for an app without workflows", async () => {
    const prisma = {
      app: { findFirst: vi.fn().mockResolvedValue({ id: "app_1" }) },
      workflow: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(workflow), findMany: vi.fn().mockResolvedValue([workflow]) },
      approval: { count: vi.fn().mockResolvedValue(0) },
    };
    mocks.getPrismaClient.mockReturnValue(prisma);
    expect(await listWorkflowsForApp(user, "app_1")).toEqual([expect.objectContaining({ id: workflow.id, pendingApprovalCount: 0 })]);
    expect(prisma.workflow.create).toHaveBeenCalledWith({ data: expect.objectContaining({ definitionJson: DEFAULT_WORKFLOW_DEFINITION }) });
  });

  it("persists an event-scoped immutable graph before dispatching, rather than running array order", async () => {
    const prisma = {
      workflow: { findMany: vi.fn().mockResolvedValue([workflow]) },
      appRecord: { findFirst: vi.fn().mockResolvedValue({ id: input.recordId, status: "draft", dataJson: {} }) },
      workflowRun: { upsert: vi.fn().mockResolvedValue({ id: "run_1" }) },
      approval: { findMany: vi.fn().mockResolvedValue([]) },
    };
    mocks.getPrismaClient.mockReturnValue(prisma);
    await runApprovalWorkflowsForRecord(user, input);
    expect(prisma.workflowRun.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { workflowId_eventKey: { workflowId: workflow.id, eventKey: "event_1" } },
      update: {},
      create: expect.objectContaining({ actorId: user.id, definitionJson: expect.objectContaining({ edges: DEFAULT_WORKFLOW_DEFINITION.edges }), stateJson: { queue: ["wf-node-1"], executions: [] } }),
    }));
    expect(mocks.executeSavedWorkflowRun).toHaveBeenCalledWith(user, "run_1", expect.any(Function));
  });

  it("recovers a racing unique event insert by dispatching the already persisted run", async () => {
    const prisma = dispatchPrisma();
    prisma.workflowRun.upsert.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Duplicate event", { code: "P2002", clientVersion: "7.7.0" }));
    const findFirst = vi.fn().mockResolvedValue({ id: "winner_run" });
    mocks.getPrismaClient.mockReturnValue({ ...prisma, workflowRun: { ...prisma.workflowRun, findFirst } });
    await runApprovalWorkflowsForRecord(user, input);
    expect(findFirst).toHaveBeenCalledWith({ where: { workflowId: workflow.id, eventKey: input.eventKey, tenantId: user.tenantId } });
    expect(mocks.executeSavedWorkflowRun).toHaveBeenCalledWith(user, "winner_run", expect.any(Function));
  });

  it("rejects activation of a cyclic graph before writing", async () => {
    const prisma = {
      app: { findFirst: vi.fn().mockResolvedValue({ id: "app_1" }) },
      workflow: { create: vi.fn() },
    };
    mocks.getPrismaClient.mockReturnValue(prisma);
    const definition = structuredClone(DEFAULT_WORKFLOW_DEFINITION);
    definition.edges.push({ id: "cycle", source: "wf-node-3", target: "wf-node-2" });
    await expect(createWorkflowForApp(user, "app_1", { name: "Bad graph", status: "active", definitionJson: definition })).rejects.toMatchObject({ status: 400 });
    expect(prisma.workflow.create).not.toHaveBeenCalled();
  });

  it("updates legacy approval, record, comment and audit inside one locked transaction", async () => {
    const approved = approvalFixture({ status: "approved", actedById: user.id });
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "approval_1" }]),
      approval: { findFirst: vi.fn().mockResolvedValue(approvalFixture()), update: vi.fn(), findUniqueOrThrow: vi.fn().mockResolvedValue(approved) },
      appRecord: { update: vi.fn() }, recordComment: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (action) => action(transaction)) };
    mocks.getPrismaClient.mockReturnValue(prisma);
    expect(await updateApprovalDecision(user, "approval_1", { status: "approved", commentText: "確認済み" })).toMatchObject({ status: "approved" });
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.appRecord.update).toHaveBeenCalledWith({ where: { id: "record_1" }, data: { status: "ready_to_publish", updatedById: user.id } });
    expect(mocks.requirePermission).toHaveBeenCalledWith(user, "approval:manage", { appId: "app_1", tableId: "table_1" });
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(user, expect.objectContaining({ actionType: "APPROVAL_APPROVE" }), transaction);
    expect(mocks.executeSavedWorkflowRun).not.toHaveBeenCalled();
  });

  it.each([
    [{ approverId: "someone_else" }, 403],
    [{ status: "approved" }, 409],
    [{ assignees: [{ id: "other", userId: "someone_else", active: true, status: "pending", sortOrder: 0, required: true }] }, 403],
    [{ approvalMode: "sequential", assignees: [
      { id: "first", userId: "someone_else", active: true, status: "pending", sortOrder: 0, required: true },
      { id: "second", userId: user.id, active: true, status: "pending", sortOrder: 1, required: true },
    ] }, 409],
  ])("rejects unauthorized, already decided and out-of-order judgments", async (overrides, status) => {
    const transaction = {
      $queryRaw: vi.fn(), approval: { findFirst: vi.fn().mockResolvedValue(approvalFixture(overrides)), update: vi.fn() },
    };
    mocks.getPrismaClient.mockReturnValue({ $transaction: vi.fn(async (action) => action(transaction)) });
    await expect(updateApprovalDecision(user, "approval_1", { status: "approved" })).rejects.toMatchObject({ status });
    expect(transaction.approval.update).not.toHaveBeenCalled();
  });
});
