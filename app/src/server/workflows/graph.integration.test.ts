import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPrismaClient } from "@/server/db/prisma";
import { createWorkflowForApp, enqueueWorkflowsForRecord, listWorkflowRunsForApp, recoverWorkflowRun, resumeWorkflowRun, runApprovalWorkflowsForRecord, updateApprovalDecision, updateWorkflowForApp } from "./service";
import * as workflowService from "./service";
import * as auditService from "@/server/audit/service";
import { createRecordForTable, updateRecordForTable } from "@/server/records/service";
import { dispatchPendingWorkflowRuns, recoverExpiredWorkflowRuns } from "./worker";
import { workflowJson } from "./execution";
import type { WorkflowDefinition } from "@/types/workflow";
import type { User } from "@/types/user";

const connection = process.env.TEST_WORKFLOW_DATABASE_URL;
const actors: User[] = [];
let appId: string;
let tableId: string;
let sequence = 0;

function definition(): WorkflowDefinition {
  return {
    nodes: [
      { id: "done", data: { label: "完了", nodeType: "status_update", config: { status: "complete" } } },
      { id: "second", data: { label: "二次承認", nodeType: "approval", config: { policy: "override", approverId: actors[1].id } } },
      { id: "notify", data: { label: "一次承認後の通知", nodeType: "notification" } },
      { id: "first", data: { label: "一次承認", nodeType: "approval", config: { policy: "override", approverId: actors[0].id } } },
      { id: "no", data: { label: "自動処理", nodeType: "status_update", config: { status: "automatic" } } },
      { id: "rejected", data: { label: "却下処理", nodeType: "status_update", config: { status: "rejection_processed" } } },
      { id: "condition", data: { label: "金額条件", nodeType: "condition", config: { fieldCode: "amount", operator: "greater_than", value: 10 } } },
      { id: "start", data: { label: "開始", nodeType: "trigger" } },
    ],
    edges: [
      { id: "01", source: "start", target: "condition" },
      { id: "02", source: "condition", target: "first", label: "yes" },
      { id: "03", source: "condition", target: "no", label: "no" },
      { id: "04", source: "first", target: "notify", label: "approved" },
      { id: "05", source: "first", target: "rejected", label: "rejected" },
      { id: "06", source: "notify", target: "second" },
      { id: "07", source: "second", target: "done", label: "approved" },
    ],
  };
}

async function setupRun(amount: number, customDefinition = definition()) {
  const prisma = getPrismaClient();
  const record = await prisma.appRecord.create({ data: {
    tenantId: actors[0].tenantId, appId, tableId, recordNo: ++sequence, status: "draft",
    dataJson: { title: `申請${sequence}`, amount }, createdById: actors[0].id, updatedById: actors[0].id,
  } });
  const workflow = await createWorkflowForApp(actors[0], appId, { name: `Graph ${sequence}`, status: "active", triggerType: "create", definitionJson: customDefinition });
  const input = {
    appId, appCode: "workflow-integration", tableId, tableCode: "requests", tableName: "申請",
    recordId: record.id, recordTitle: `申請${sequence}`, triggerTypes: ["create" as const], workflowIds: [workflow.id], eventKey: `event:${record.id}`,
  };
  return { record, workflow, input };
}

async function setupOutboxApp(graph: WorkflowDefinition, triggerType: "create" | "update" = "create") {
  const prisma = getPrismaClient();
  const app = await prisma.app.create({ data: { tenantId: actors[0].tenantId, name: "Outbox", code: `outbox-${++sequence}`, createdById: actors[0].id } });
  const table = await prisma.appTable.create({ data: { tenantId: actors[0].tenantId, appId: app.id, name: "申請", code: "requests" } });
  await prisma.appField.createMany({ data: [
    { tenantId: actors[0].tenantId, appId: app.id, tableId: table.id, name: "件名", code: "title", fieldType: "text" },
    { tenantId: actors[0].tenantId, appId: app.id, tableId: table.id, name: "金額", code: "amount", fieldType: "number" },
  ] });
  const workflow = await createWorkflowForApp(actors[0], app.id, { name: "Outbox workflow", triggerType, status: "active", definitionJson: graph });
  return { app, table, workflow };
}

describe.skipIf(!connection)("workflow graph against PostgreSQL", () => {
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", connection!);
    vi.stubEnv("DEMO_AUTO_SEED", "false");
    const prisma = getPrismaClient();
    expect(await prisma.tenant.count(), "Use an empty, migrated workflow test database").toBe(0);
    const tenant = await prisma.tenant.create({ data: { name: "Workflow integration", code: "workflow-integration", planType: "test" } });
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: "Test admin", roleType: "tenant_admin", permissionsJson: ["*"] } });
    for (const name of ["requester", "reviewer", "outsider"]) {
      const user = await prisma.user.create({ data: { tenantId: tenant.id, name, email: `${name}@integration.example` } });
      await prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: role.id, createdById: user.id } });
      actors.push({ id: user.id, tenantId: tenant.id, name, email: user.email, status: "active", createdAt: user.createdAt.toISOString() });
    }
    const app = await prisma.app.create({ data: { tenantId: tenant.id, name: "Workflow app", code: "workflow-integration", createdById: actors[0].id } });
    appId = app.id;
    const table = await prisma.appTable.create({ data: { tenantId: tenant.id, appId, name: "申請", code: "requests" } });
    tableId = table.id;
    await prisma.appField.createMany({ data: [
      { tenantId: tenant.id, appId, tableId, name: "件名", code: "title", fieldType: "text" },
      { tenantId: tenant.id, appId, tableId, name: "金額", code: "amount", fieldType: "number" },
    ] });
  });

  afterAll(async () => { await getPrismaClient().$disconnect(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("runs the false edge without touching approval nodes, independent of array order", async () => {
    const { record, workflow, input } = await setupRun(5);
    expect(await runApprovalWorkflowsForRecord(actors[0], input)).toEqual([]);
    expect(await getPrismaClient().appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "automatic" });
    const [run] = await listWorkflowRunsForApp(actors[0], appId, workflow.id);
    expect(run.status).toBe("completed");
    expect(run.state.executions.filter((step) => step.status === "success").map((step) => step.nodeId)).toEqual(["start", "condition", "no"]);
    expect(run.state.executions.find((step) => step.nodeId === "first")?.status).toBe("skip");
  });

  it("deduplicates concurrent events, suspends twice, resumes a snapshot and rejects duplicate decisions", async () => {
    const { record, workflow, input } = await setupRun(50);
    await Promise.all([runApprovalWorkflowsForRecord(actors[0], input), runApprovalWorkflowsForRecord(actors[0], input)]);
    const prisma = getPrismaClient();
    expect(await prisma.workflowRun.count({ where: { workflowId: workflow.id } })).toBe(1);
    const [first] = await prisma.approval.findMany({ where: { workflowId: workflow.id } });
    expect(first.workflowNodeId).toBe("first");
    expect(await prisma.notification.count({ where: { recordId: record.id, type: "workflow" } })).toBe(0);
    await expect(updateApprovalDecision(actors[2], first.id, { status: "approved" })).rejects.toMatchObject({ status: 403 });
    const changed = definition();
    changed.nodes.find((node) => node.id === "done")!.data.config = { status: "wrong_new_definition" };
    await updateWorkflowForApp(actors[0], appId, workflow.id, { definitionJson: changed });
    const decisions = await Promise.allSettled([
      updateApprovalDecision(actors[0], first.id, { status: "approved" }),
      updateApprovalDecision(actors[0], first.id, { status: "approved" }),
    ]);
    expect(decisions.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(decisions.find((result) => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    const second = await prisma.approval.findFirstOrThrow({ where: { workflowId: workflow.id, workflowNodeId: "second" } });
    expect(second.workflowRunId).toBe(first.workflowRunId);
    expect(await prisma.notification.count({ where: { recordId: record.id, type: "workflow" } })).toBe(1);
    expect((await listWorkflowRunsForApp(actors[0], appId, workflow.id))[0].status).toBe("waiting");
    await updateApprovalDecision(actors[1], second.id, { status: "approved" });
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "complete" });
    expect((await listWorkflowRunsForApp(actors[0], appId, workflow.id))[0].status).toBe("completed");
    expect(await prisma.auditLog.count({ where: { resourceId: first.workflowRunId!, actionType: "WORKFLOW_RESUME" } })).toBe(2);
  });

  it("uses the app policy and serializes simultaneous all-mode assignee decisions", async () => {
    const prisma = getPrismaClient();
    await prisma.appApprovalSetting.create({ data: {
      tenantId: actors[0].tenantId, appId, enabled: true, approvalMode: "all", targetTableId: tableId,
      approvers: { create: actors.slice(0, 2).map((actor, index) => ({ tenantId: actor.tenantId, userId: actor.id, sortOrder: index })) },
    } });
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "policy", data: { label: "アプリ承認", nodeType: "approval", config: { policy: "app" } } },
        { id: "done", data: { label: "完了", nodeType: "status_update", config: { status: "policy_complete" } } },
      ],
      edges: [{ id: "01", source: "start", target: "policy" }, { id: "02", source: "policy", target: "done", label: "approved" }],
    };
    const { record, workflow, input } = await setupRun(50, graph);
    const [approval] = await runApprovalWorkflowsForRecord(actors[0], input);
    expect(approval.assignees).toHaveLength(2);
    await Promise.all(actors.slice(0, 2).map((actor) => updateApprovalDecision(actor, approval.id, { status: "approved" })));
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "policy_complete" });
    expect((await listWorkflowRunsForApp(actors[0], appId, workflow.id))[0].status).toBe("completed");
    expect(await prisma.auditLog.count({ where: { resourceId: record.id, actionType: "WORKFLOW_STATUS_UPDATE" } })).toBe(1);
  });

  it("runs the rejected branch, without executing the approved continuation", async () => {
    const { record, workflow, input } = await setupRun(50);
    const [approval] = await runApprovalWorkflowsForRecord(actors[0], input);
    await updateApprovalDecision(actors[0], approval.id, { status: "rejected" });
    const prisma = getPrismaClient();
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "rejection_processed" });
    expect(await prisma.approval.count({ where: { workflowId: workflow.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { recordId: record.id, type: "workflow" } })).toBe(0);
  });

  it.each(["any", "sequential", "quorum"] as const)("honors %s policy, notification order and captured quorum", async (mode) => {
    const prisma = getPrismaClient();
    await prisma.appApprovalSetting.update({ where: { appId }, data: { approvalMode: mode, quorumCount: mode === "quorum" ? 2 : null } });
    const graph: WorkflowDefinition = {
      nodes: [{ id: "start", data: { label: "開始", nodeType: "trigger" } }, { id: "policy", data: { label: "アプリ承認", nodeType: "approval", config: { policy: "app" } } }],
      edges: [{ id: "01", source: "start", target: "policy" }],
    };
    const { record, workflow, input } = await setupRun(50, graph);
    const [approval] = await runApprovalWorkflowsForRecord(actors[0], input);
    expect(await prisma.notification.count({ where: { recordId: record.id } })).toBe(mode === "sequential" ? 1 : 2);
    if (mode === "sequential") await expect(updateApprovalDecision(actors[1], approval.id, { status: "approved" })).rejects.toMatchObject({ status: 409 });
    if (mode === "quorum") await prisma.appApprovalSetting.update({ where: { appId }, data: { quorumCount: 1 } });
    const first = await updateApprovalDecision(actors[0], approval.id, { status: "approved" });
    expect(first.status).toBe(mode === "any" ? "approved" : "pending");
    if (mode !== "any") await updateApprovalDecision(actors[1], approval.id, { status: "approved" });
    expect((await listWorkflowRunsForApp(actors[0], appId, workflow.id))[0].status).toBe("completed");
    expect(await prisma.approvalAssignee.count({ where: { approvalId: approval.id, active: true, status: "pending" } })).toBe(0);
  });

  it.each(["fail", "continue"])("records node failures and honors the %s policy", async (failurePolicy) => {
    vi.stubEnv("WORKFLOW_API_ALLOWED_ORIGINS", "https://blocked.example");
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "api", data: { label: "未許可API", nodeType: "api_call", config: { url: "https://blocked.example", failurePolicy } } },
        { id: "after", data: { label: "後続", nodeType: "status_update", config: { status: "after_failure" } } },
      ],
      edges: [{ id: "01", source: "start", target: "api" }, { id: "02", source: "api", target: "after" }],
    };
    const { record, workflow, input } = await setupRun(50, graph);
    vi.stubEnv("WORKFLOW_API_ALLOWED_ORIGINS", "");
    await runApprovalWorkflowsForRecord(actors[0], input);
    const [run] = await listWorkflowRunsForApp(actors[0], appId, workflow.id);
    expect(run.status).toBe(failurePolicy === "fail" ? "failed" : "completed");
    expect(run.state.executions.find((step) => step.nodeId === "api")).toMatchObject({ status: "failure", error: expect.stringContaining("許可されていません") });
    expect(await getPrismaClient().appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: failurePolicy === "fail" ? "draft" : "after_failure" });
  });

  it("recovers a saved decision without skipping pending approvals or duplicating continuation", async () => {
    const { workflow, input } = await setupRun(50);
    const [approval] = await runApprovalWorkflowsForRecord(actors[0], input);
    const runId = approval.workflowRunId!;
    expect((await resumeWorkflowRun(actors[0], appId, runId)).status).toBe("waiting");
    await getPrismaClient().approval.update({ where: { id: approval.id }, data: { status: "approved" } });
    await Promise.all([resumeWorkflowRun(actors[0], appId, runId), resumeWorkflowRun(actors[0], appId, runId)]);
    expect(await getPrismaClient().approval.count({ where: { workflowId: workflow.id, workflowNodeId: "second" } })).toBe(1);
  });

  it("commits a captured record event atomically, then drains it despite older pending approvals", async () => {
    vi.stubEnv("WORKFLOW_INLINE_DISPATCH", "false");
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "condition", data: { label: "金額", nodeType: "condition", config: { fieldCode: "amount", operator: "greater_than", value: 10 } } },
        { id: "yes", data: { label: "元のイベント", nodeType: "status_update", config: { status: "from_snapshot" } } },
        { id: "no", data: { label: "後の値", nodeType: "status_update", config: { status: "wrong_later_value" } } },
      ],
      edges: [{ id: "01", source: "start", target: "condition" }, { id: "02", source: "condition", target: "yes", label: "yes" }, { id: "03", source: "condition", target: "no", label: "no" }],
    };
    const { app, table } = await setupOutboxApp(graph);
    const record = await createRecordForTable(actors[0], app.code, table.code, { status: "draft", data: { title: "Queue", amount: 50 } });
    expect(record.workflowDispatchPending).toBe(true);
    expect(record.workflowRunIds).toHaveLength(1);
    const prisma = getPrismaClient();
    const runId = record.workflowRunIds![0];
    expect(await prisma.workflowRun.findUnique({ where: { id: runId } })).toMatchObject({ status: "ready", contextJson: { recordSnapshot: { status: "draft", dataJson: { title: "Queue", amount: 50 } } } });
    expect(await prisma.workflowRun.count({ where: { status: "waiting" } })).toBeGreaterThan(0);
    await prisma.appRecord.update({ where: { id: record.id }, data: { dataJson: { title: "Changed later", amount: 5 } } });
    expect((await dispatchPendingWorkflowRuns(1)).processed).toEqual([{ id: runId, status: "completed" }]);
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "from_snapshot" });
  });

  it("rolls back record and its audit when queue persistence fails", async () => {
    const { app, table } = await setupOutboxApp({ nodes: [{ id: "start", data: { label: "開始", nodeType: "trigger" } }], edges: [] });
    const prisma = getPrismaClient();
    const auditCount = await prisma.auditLog.count();
    const failure = vi.spyOn(workflowService, "enqueueWorkflowsForRecord").mockRejectedValueOnce(new Error("injected queue storage failure"));
    try {
      await expect(createRecordForTable(actors[0], app.code, table.code, { data: { title: "Rollback" } })).rejects.toThrow("queue storage failure");
    } finally { failure.mockRestore(); }
    expect(await prisma.appRecord.count({ where: { appId: app.id } })).toBe(0);
    expect(await prisma.workflowRun.count({ where: { appId: app.id } })).toBe(0);
    expect(await prisma.auditLog.count()).toBe(auditCount);
  });

  it("returns saved data and pending metadata when post-commit dispatch is unavailable", async () => {
    vi.stubEnv("WORKFLOW_INLINE_DISPATCH", "true");
    const { app, table } = await setupOutboxApp({ nodes: [{ id: "start", data: { label: "開始", nodeType: "trigger" } }], edges: [] });
    const failure = vi.spyOn(workflowService, "dispatchWorkflowRunIds").mockRejectedValueOnce(new Error("injected post-commit failure"));
    let record;
    try { record = await createRecordForTable(actors[0], app.code, table.code, { data: { title: "Saved once" } }); }
    finally { failure.mockRestore(); }
    expect(record.workflowDispatchPending).toBe(true);
    expect(await getPrismaClient().appRecord.count({ where: { appId: app.id } })).toBe(1);
    expect((await dispatchPendingWorkflowRuns(1)).processed).toEqual([{ id: record.workflowRunIds![0], status: "completed" }]);
  });

  it("serializes concurrent updates without clobbering unrelated status or duplicating event keys", async () => {
    vi.stubEnv("WORKFLOW_INLINE_DISPATCH", "false");
    const { app, table } = await setupOutboxApp({ nodes: [{ id: "start", data: { label: "開始", nodeType: "trigger" } }], edges: [] }, "update");
    const record = await createRecordForTable(actors[0], app.code, table.code, { status: "draft", data: { title: "Old", amount: 10 } });
    const results = await Promise.all([
      updateRecordForTable(actors[0], app.code, table.code, record.id, { data: { title: "New", amount: 77 } }),
      updateRecordForTable(actors[0], app.code, table.code, record.id, { status: "review" }),
    ]);
    expect(results.every((saved) => saved.workflowDispatchPending)).toBe(true);
    const prisma = getPrismaClient();
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "review", dataJson: { title: "New", amount: 77 } });
    const jobs = await prisma.workflowRun.findMany({ where: { recordId: record.id } });
    expect(jobs).toHaveLength(2);
    expect(new Set(jobs.map((run) => run.eventKey)).size).toBe(2);
    expect((await dispatchPendingWorkflowRuns(50)).failures).toEqual([]);
  });

  it("recovers an expired DB-only step exactly once despite two recovery workers", async () => {
    const { input, record } = await setupRun(5);
    const [runId] = await enqueueWorkflowsForRecord(actors[0], input);
    const prisma = getPrismaClient();
    await prisma.workflowRun.update({ where: { id: runId }, data: {
      status: "running", leaseToken: "crashed-worker", leaseExpiresAt: new Date(Date.now() - 1000),
      stateJson: workflowJson({ queue: [], executions: [
        { nodeId: "start", nodeType: "trigger", status: "success", startedAt: new Date().toISOString() },
        { nodeId: "condition", nodeType: "condition", status: "success", outcome: "no", startedAt: new Date().toISOString() },
        { nodeId: "no", nodeType: "status_update", status: "running", startedAt: new Date().toISOString() },
      ] }),
    } });
    await Promise.all([dispatchPendingWorkflowRuns(50), dispatchPendingWorkflowRuns(50)]);
    expect(await prisma.workflowRun.findUnique({ where: { id: runId } })).toMatchObject({ status: "completed", leaseToken: null, leaseExpiresAt: null });
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "automatic" });
    expect(await prisma.auditLog.count({ where: { resourceId: record.id, actionType: "WORKFLOW_STATUS_UPDATE" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { resourceId: runId, actionType: "WORKFLOW_LEASE_RECOVERED" } })).toBe(1);
    expect((await prisma.workflowRun.updateMany({ where: { id: runId, status: "running", leaseToken: "crashed-worker" }, data: { status: "failed" } })).count).toBe(0);
  });

  it("does not recover a node while its DB transaction still holds the execution row lock", async () => {
    const { input } = await setupRun(5);
    const [runId] = await enqueueWorkflowsForRecord(actors[0], input);
    const prisma = getPrismaClient();
    await prisma.workflowRun.update({ where: { id: runId }, data: { status: "running", leaseToken: "locked-worker", leaseExpiresAt: new Date(Date.now() - 1000) } });
    let release!: () => void;
    let signal!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const locked = new Promise<void>((resolve) => { signal = resolve; });
    const holder = prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM workflow_runs WHERE id = ${runId} FOR UPDATE`;
      signal();
      await released;
    }, { timeout: 10000 });
    await locked;
    try { expect(await recoverExpiredWorkflowRuns(50)).toEqual([]); }
    finally { release(); await holder; }
    expect(await recoverExpiredWorkflowRuns(50)).toEqual([{ id: runId, status: "ready" }]);
    await dispatchPendingWorkflowRuns(50);
  });

  it.each(["retry", "skip", "fail"] as const)("quarantines uncertain API effects and accepts only an explicit audited %s decision", async (action) => {
    vi.stubEnv("WORKFLOW_API_ALLOWED_ORIGINS", "https://example.com");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel: vi.fn() } });
    vi.stubGlobal("fetch", fetchMock);
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "api", data: { label: "外部", nodeType: "api_call", config: { url: "https://example.com" } } },
        { id: "done", data: { label: "後続", nodeType: "status_update", config: { status: "recovered" } } },
      ], edges: [{ id: "01", source: "start", target: "api" }, { id: "02", source: "api", target: "done" }],
    };
    const { input, record } = await setupRun(5, graph);
    const [runId] = await enqueueWorkflowsForRecord(actors[0], input);
    const prisma = getPrismaClient();
    await prisma.workflowRun.update({ where: { id: runId }, data: {
      status: "running", leaseToken: "crashed-external", leaseExpiresAt: new Date(Date.now() - 1000),
      stateJson: workflowJson({ queue: [], executions: [
        { nodeId: "start", nodeType: "trigger", status: "success", startedAt: new Date().toISOString() },
        { nodeId: "api", nodeType: "api_call", status: "running", startedAt: new Date().toISOString() },
      ] }),
    } });
    await dispatchPendingWorkflowRuns(50);
    const interrupted = await prisma.workflowRun.findUniqueOrThrow({ where: { id: runId } });
    expect(interrupted.status).toBe("interrupted");
    expect(fetchMock).not.toHaveBeenCalled();
    const decision = { action, reason: "実行先の履歴を確認済み", expectedUpdatedAt: interrupted.updatedAt.toISOString(), confirmExternalOutcome: true };
    await expect(recoverWorkflowRun({ ...actors[0], tenantId: "foreign" }, appId, runId, decision)).rejects.toMatchObject({ status: 403 });
    if (action !== "fail") await expect(recoverWorkflowRun(actors[0], appId, runId, { ...decision, confirmExternalOutcome: false })).rejects.toMatchObject({ status: 400 });
    await expect(recoverWorkflowRun(actors[0], appId, runId, { ...decision, expectedUpdatedAt: "2020-01-01T00:00:00Z" })).rejects.toMatchObject({ status: 409 });
    const result = await recoverWorkflowRun(actors[0], appId, runId, decision);
    expect(result.status).toBe(action === "fail" ? "failed" : "completed");
    expect(fetchMock).toHaveBeenCalledTimes(action === "retry" ? 1 : 0);
    if (action === "retry") expect(fetchMock.mock.calls[0][1].headers["idempotency-key"]).toBe(`${runId}:api`);
    expect(await prisma.appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: action === "fail" ? "draft" : "recovered" });
    expect(await prisma.auditLog.count({ where: { resourceId: runId, actionType: "WORKFLOW_RECOVERY_DECISION" } })).toBe(1);
    await expect(recoverWorkflowRun(actors[0], appId, runId, decision)).rejects.toMatchObject({ status: 409 });
  });

  it("refreshes captured status after a local status update before evaluating a downstream condition", async () => {
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "update", data: { label: "更新", nodeType: "status_update", config: { status: "changed" } } },
        { id: "condition", data: { label: "変更後", nodeType: "condition", config: { fieldCode: "status", value: "changed" } } },
        { id: "yes", data: { label: "変更確認", nodeType: "status_update", config: { status: "confirmed" } } },
        { id: "no", data: { label: "古い値", nodeType: "status_update", config: { status: "stale_snapshot" } } },
      ], edges: [{ id: "01", source: "start", target: "update" }, { id: "02", source: "update", target: "condition" }, { id: "03", source: "condition", target: "yes", label: "yes" }, { id: "04", source: "condition", target: "no", label: "no" }],
    };
    const { record, input } = await setupRun(5, graph);
    await runApprovalWorkflowsForRecord(actors[0], input);
    expect(await getPrismaClient().appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "confirmed" });
  });

  it("does not publish a rolled-back record snapshot when a node checkpoint audit fails", async () => {
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "update", data: { label: "失敗する更新", nodeType: "status_update", config: { status: "rolled_back", failurePolicy: "continue" } } },
        { id: "condition", data: { label: "元の状態", nodeType: "condition", config: { fieldCode: "status", value: "draft" } } },
        { id: "yes", data: { label: "回復確認", nodeType: "status_update", config: { status: "rollback_confirmed" } } },
        { id: "no", data: { label: "不整合", nodeType: "status_update", config: { status: "corrupt_snapshot" } } },
      ], edges: [{ id: "01", source: "start", target: "update" }, { id: "02", source: "update", target: "condition" }, { id: "03", source: "condition", target: "yes", label: "yes" }, { id: "04", source: "condition", target: "no", label: "no" }],
    };
    const { record, input } = await setupRun(5, graph);
    const original = auditService.recordAuditLog;
    let injected = false;
    const failure = vi.spyOn(auditService, "recordAuditLog").mockImplementation(async (...args) => {
      if (!injected && args[1].actionType === "WORKFLOW_NODE_EXECUTE" && args[1].detailJson?.nodeId === "update") {
        injected = true;
        throw new Error("injected checkpoint audit failure");
      }
      return original(...args);
    });
    try { await runApprovalWorkflowsForRecord(actors[0], input); }
    finally { failure.mockRestore(); }
    expect(injected).toBe(true);
    expect(await getPrismaClient().appRecord.findUnique({ where: { id: record.id } })).toMatchObject({ status: "rollback_confirmed" });
    expect(await getPrismaClient().auditLog.count({ where: { resourceId: record.id, actionType: "WORKFLOW_STATUS_UPDATE" } })).toBe(1);
  });
});
