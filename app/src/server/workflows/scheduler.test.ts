import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkflowScheduleForApp, runDueScheduledWorkflows, scheduledDefinitionHash, scheduledTriggerConfiguration, scheduleRecordLimit } from "./scheduler";
import type { User } from "@/types/user";

const mocks = vi.hoisted(() => ({ getPrismaClient: vi.fn(), enqueue: vi.fn(), audit: vi.fn(), requirePermission: vi.fn(), getWorkflow: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: mocks.getPrismaClient }));
vi.mock("@/server/workflows/service", () => ({ enqueueWorkflowsForRecord: mocks.enqueue, getWorkflowForApp: mocks.getWorkflow }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/server/admin/rbac", () => ({ requirePermission: mocks.requirePermission }));

const now = new Date("2026-09-30T01:00:00.000Z");
const graph = { nodes: [{ id: "start", data: { label: "Start", nodeType: "trigger", config: { tableCode: "requests", scheduleIntervalMinutes: 30 } } }, { id: "done", data: { label: "Done", nodeType: "status_update", config: { status: "complete" } } }], edges: [{ id: "edge", source: "start", target: "done" }] };
const actor = { id: "user", tenantId: "tenant", name: "Owner", email: "owner@example.com", avatarUrl: null, status: "active" as const, createdAt: now, lastLoginAt: null };
const workflow = { id: "workflow", tenantId: "tenant", appId: "app", name: "Schedule", updatedAt: now, definitionJson: graph, createdBy: actor, app: { code: "support" } };
const record = { id: "record", tableId: "table", dataJson: { title: "Ticket" }, table: { id: "table", code: "requests", name: "Requests" } };

function database() {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValueOnce([{ now }]).mockResolvedValue([]),
    workflow: { findUniqueOrThrow: vi.fn().mockResolvedValue(workflow) },
    workflowScheduleState: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null), upsert: vi.fn(), update: vi.fn() },
    appRecord: { findMany: vi.fn().mockResolvedValue([record]) },
    appTable: { count: vi.fn().mockResolvedValue(1) },
  };
  mocks.getPrismaClient.mockReturnValue({ ...transaction, $transaction: vi.fn(async (operation) => operation(transaction)) });
  return transaction;
}

describe("durable workflow schedule producer", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.enqueue.mockResolvedValue(["run"]); });
  afterEach(() => vi.unstubAllEnvs());

  it.each([0, 501, 1.5, NaN, Infinity])("rejects invalid record budgets: %s", (limit) => {
    expect(() => scheduleRecordLimit(limit)).toThrow("1〜500");
  });

  it("defaults to 100 records and a 60-minute interval without a schedule override", () => {
    expect(scheduleRecordLimit()).toBe(100);
    const definition = structuredClone(graph);
    definition.nodes[0].data.config = {} as typeof definition.nodes[0]["data"]["config"];
    expect(scheduledTriggerConfiguration(definition).intervalMinutes).toBe(60);
    expect(scheduledTriggerConfiguration(graph)).toMatchObject({ tableCode: "requests", intervalMinutes: 30 });
  });

  it("ignores presentation and property order but detects changed processing semantics", () => {
    const changed = structuredClone(graph);
    const moved = changed.nodes[0] as typeof changed.nodes[0] & { position?: { x: number; y: number } };
    moved.position = { x: 800, y: 100 };
    moved.data.label = "Renamed trigger";
    changed.nodes.reverse();
    changed.nodes.find((node) => node.id === "start")!.data.config = { scheduleIntervalMinutes: 30, tableCode: "requests" };
    expect(scheduledDefinitionHash(changed)).toBe(scheduledDefinitionHash(graph));
    changed.nodes.find((node) => node.id === "done")!.data.config.status = "different";
    expect(scheduledDefinitionHash(changed)).not.toBe(scheduledDefinitionHash(graph));
  });

  it("queues a scoped cycle and commits its cursor with jobs without invoking side effects", async () => {
    const transaction = database();
    const result = await runDueScheduledWorkflows(10);
    expect(result).toMatchObject({ workflowCount: 1, batchCount: 1, recordCount: 1, queuedRunCount: 1, completedCycleCount: 1, runIds: ["run"], failures: [] });
    expect(transaction.appRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant", appId: "app", table: expect.objectContaining({ code: "requests" }), createdAt: { lte: now } }), orderBy: { id: "asc" }, take: 11 }));
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ id: "user" }), expect.objectContaining({ eventKey: expect.stringMatching(/^schedule:.*:record$/), workflowIds: ["workflow"], triggerTypes: ["schedule"] }), transaction);
    expect(transaction.workflowScheduleState.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ cycleId: null, cursorRecordId: null, nextDueAt: new Date(now.getTime() + 30 * 60000) }) }));
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.objectContaining({ id: "user" }), "record:write", { appId: "app", tableId: "table" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: "WORKFLOW_SCHEDULE_BATCH" }), transaction);
  });

  it("treats edge order as processing semantics because fan-out actions execute in that order", () => {
    const forked = { ...graph, nodes: [...graph.nodes, { id: "other", data: { label: "Other", nodeType: "status_update", config: { status: "other" } } }], edges: [...graph.edges, { id: "other-edge", source: "start", target: "other" }] };
    expect(scheduledDefinitionHash({ ...forked, edges: [...forked.edges].reverse() })).not.toBe(scheduledDefinitionHash(forked));
  });

  it("continues a captured cycle through a stable ID cursor, at most ten records per batch", async () => {
    const transaction = database();
    transaction.workflowScheduleState.findUnique.mockResolvedValue({ definitionHash: scheduledDefinitionHash(graph), updatedAt: now, cycleId: "captured", cycleStartedAt: now, cursorRecordId: "previous", nextDueAt: now });
    transaction.appRecord.findMany.mockResolvedValue(Array.from({ length: 11 }, (unused, index) => ({ ...record, id: `record-${index}` })));
    const result = await runDueScheduledWorkflows(10);
    expect(result.recordCount).toBe(10);
    expect(transaction.appRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { gt: "previous" } }) }));
    expect(transaction.workflowScheduleState.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ cycleId: "captured", cursorRecordId: "record-9", nextDueAt: now }) }));
  });

  it("acknowledges a layout-only edit without replaying a cycle before its due time", async () => {
    const transaction = database();
    transaction.workflowScheduleState.findUnique.mockResolvedValue({ definitionHash: scheduledDefinitionHash(graph), updatedAt: now, cycleId: null, nextDueAt: new Date(now.getTime() + 60000) });
    transaction.$queryRaw.mockReset().mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValue([]);
    expect((await runDueScheduledWorkflows()).queuedRunCount).toBe(0);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(transaction.workflowScheduleState.update).toHaveBeenCalledWith({ where: { workflowId: "workflow" }, data: { workflowUpdatedAt: now, revision: { increment: 1 } } });
  });

  it("persists an audited backoff after rollback instead of repeatedly selecting a broken workflow", async () => {
    const transaction = database();
    transaction.$queryRaw.mockReset().mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValue([]);
    mocks.enqueue.mockRejectedValue(new Error("queue write failed"));
    expect(await runDueScheduledWorkflows()).toMatchObject({ recordCount: 0, failures: [{ workflowId: "workflow", message: "queue write failed", backoffPersisted: true }] });
    expect(transaction.workflowScheduleState.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ lastError: "queue write failed", nextDueAt: new Date(now.getTime() + 300000) }) }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: "WORKFLOW_SCHEDULE_FAILED" }), transaction);
  });

  it("does not overwrite a newer worker's state while recording failure backoff", async () => {
    const transaction = database();
    transaction.$queryRaw.mockReset().mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValue([]);
    transaction.workflowScheduleState.findUnique.mockResolvedValueOnce({ revision: 1, updatedAt: now, definitionHash: scheduledDefinitionHash(graph), nextDueAt: now }).mockResolvedValueOnce({ revision: 2, updatedAt: now });
    mocks.enqueue.mockRejectedValue(new Error("rolled back"));
    expect((await runDueScheduledWorkflows()).failures[0].backoffPersisted).toBe(false);
    expect(transaction.workflowScheduleState.upsert).not.toHaveBeenCalled();
  });

  it("reports a deleted trigger scope instead of treating it as a successful empty cycle", async () => {
    const transaction = database();
    transaction.appTable.count.mockResolvedValue(0);
    transaction.$queryRaw.mockReset().mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValueOnce([{ id: "workflow", now }]).mockResolvedValue([]);
    expect((await runDueScheduledWorkflows()).failures[0]).toMatchObject({ workflowId: "workflow", message: expect.stringContaining("対象テーブル"), backoffPersisted: true });
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(transaction.appRecord.findMany).not.toHaveBeenCalled();
  });

  it("checks scoped workflow read access before returning operational metadata", async () => {
    const transaction = database();
    mocks.getWorkflow.mockResolvedValue({ triggerType: "schedule", status: "active" });
    expect(await getWorkflowScheduleForApp(actor as unknown as User, "app", "workflow")).toMatchObject({ nextDueAt: null, cycleInProgress: false });
    expect(mocks.getWorkflow).toHaveBeenCalledWith(actor, "app", "workflow");
    expect(transaction.workflowScheduleState.findFirst).toHaveBeenCalledWith({ where: { workflowId: "workflow", tenantId: "tenant" } });
  });
});
