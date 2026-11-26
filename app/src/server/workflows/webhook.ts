import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { requirePermission } from "@/server/admin/rbac";
import { recordAuditFailure, recordAuditLog } from "@/server/audit/service";
import { getPrismaClient } from "@/server/db/prisma";
import { ServiceError } from "@/server/errors/service-error";
import { createPreparedRecord, prepareRecordCreation } from "@/server/records/service";
import { decryptSecret, encryptSecret } from "@/server/secrets/encryption";
import { getRecordTitle } from "@/lib/runtime-records";
import type { AppRecord } from "@/types/record";
import type { User } from "@/types/user";
import type { WorkflowWebhookInfo, WorkflowWebhookReceipt, WorkflowWebhookSecretResult } from "@/types/workflow";
import { dispatchWorkflowRunIds, enqueueWorkflowsForRecord, getWorkflowForApp } from "./service";
import { parseWebhookPayload, readWebhookBody, verifyWebhookSignature, webhookEnvelope } from "./webhook-signature";

const RECENT_DELIVERY_LIMIT = 5;
const WORKFLOW_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

type WebhookPayload = ReturnType<typeof parseWebhookPayload>;
type DeliveryRow = { deliveryId: string; payloadHash: string; recordId: string | null; runIdsJson: Prisma.JsonValue; createdAt: Date };

export function workflowWebhookPath(workflowId: string) {
  return `/api/webhooks/workflows/${encodeURIComponent(workflowId)}`;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function notFound() {
  return new ServiceError("Webhookが見つからないか、無効です。", 404);
}

function toActor(user: { id: string; tenantId: string; email: string; name: string; avatarUrl: string | null; status: string; lastLoginAt: Date | null; createdAt: Date }): User {
  return { id: user.id, tenantId: user.tenantId, email: user.email, name: user.name, avatarUrl: user.avatarUrl ?? undefined, status: user.status === "active" ? "active" : "inactive", lastLoginAt: user.lastLoginAt?.toISOString(), createdAt: user.createdAt.toISOString() };
}

function titleOf(record: { id: string; recordNo: number | null; dataJson: Prisma.JsonValue }) {
  return getRecordTitle({ id: record.id, recordNo: record.recordNo ?? undefined, data: object(record.dataJson) } as AppRecord);
}

function triggerTableScope(definitionJson: Prisma.JsonValue) {
  const nodes = Array.isArray(object(definitionJson).nodes) ? object(definitionJson).nodes as unknown[] : [];
  const trigger = nodes.find((node) => object(object(node).data).nodeType === "trigger");
  const config = object(object(object(trigger).data).config);
  return { tableId: typeof config.tableId === "string" && config.tableId ? config.tableId : undefined, tableCode: typeof config.tableCode === "string" && config.tableCode ? config.tableCode : undefined };
}

/** 送信元の指定とトリガー設定を突き合わせ、レコードの所属先として許可するテーブル条件を返す。 */
export function resolveWebhookTableScope(definitionJson: Prisma.JsonValue, payload: Pick<WebhookPayload, "tableId" | "tableCode">) {
  const configured = triggerTableScope(definitionJson);
  if ((payload.tableId && configured.tableId && payload.tableId !== configured.tableId) || (payload.tableCode && configured.tableCode && payload.tableCode !== configured.tableCode)) throw new ServiceError("Webhookの対象テーブルがワークフローの設定と一致しません。", 422);
  return { tableId: payload.tableId ?? configured.tableId, tableCode: payload.tableCode ?? configured.tableCode };
}

function toDelivery(row: Omit<DeliveryRow, "payloadHash">) {
  return { deliveryId: row.deliveryId, recordId: row.recordId, runIds: stringList(row.runIdsJson), receivedAt: row.createdAt.toISOString() };
}

async function loadWebhookInfo(tenantId: string, workflowId: string): Promise<WorkflowWebhookInfo> {
  const prisma = getPrismaClient();
  const [state, deliveries] = await Promise.all([
    prisma.workflow.findFirstOrThrow({ where: { id: workflowId, tenantId }, select: { webhookEnabled: true, webhookSecretEncrypted: true, webhookKeyVersion: true, webhookSecretUpdatedAt: true } }),
    prisma.workflowWebhookEvent.findMany({ where: { workflowId, tenantId }, orderBy: { createdAt: "desc" }, take: RECENT_DELIVERY_LIMIT, select: { deliveryId: true, recordId: true, runIdsJson: true, createdAt: true } }),
  ]);
  return {
    enabled: state.webhookEnabled && !!state.webhookSecretEncrypted,
    endpointPath: workflowWebhookPath(workflowId),
    keyVersion: state.webhookKeyVersion,
    secretUpdatedAt: state.webhookSecretUpdatedAt?.toISOString() ?? null,
    recentDeliveries: deliveries.map(toDelivery),
  };
}

export async function getWorkflowWebhookForApp(user: User, appId: string, workflowId: string) {
  const workflow = await getWorkflowForApp(user, appId, workflowId);
  if (workflow.triggerType !== "webhook") throw new ServiceError("Webhookトリガーのワークフローではありません。", 400);
  return loadWebhookInfo(user.tenantId, workflow.id);
}

export async function rotateWorkflowWebhookSecret(user: User, appId: string, workflowId: string): Promise<WorkflowWebhookSecretResult> {
  const workflow = await getWorkflowForApp(user, appId, workflowId);
  await requirePermission(user, "workflow:manage", { appId });
  if (workflow.triggerType !== "webhook") throw new ServiceError("Webhookトリガーのワークフローではありません。", 400);
  if (process.env.NODE_ENV === "production" && !process.env.SECRET_ENCRYPTION_KEY?.trim()) throw new ServiceError("Webhook秘密鍵を保存するにはSECRET_ENCRYPTION_KEYを設定してください。", 503);
  const secret = `whsec_${randomBytes(32).toString("base64url")}`;
  await getPrismaClient().$transaction(async (transaction) => {
    const saved = await transaction.workflow.update({
      where: { id: workflow.id },
      data: { webhookEnabled: true, webhookSecretEncrypted: encryptSecret(secret), webhookKeyVersion: { increment: 1 }, webhookSecretUpdatedAt: new Date() },
      select: { webhookKeyVersion: true },
    });
    await recordAuditLog(user, { actionType: "WORKFLOW_WEBHOOK_SECRET_ROTATE", resourceType: "workflow", resourceId: workflow.id, resourceName: workflow.name, detailJson: { appId, keyVersion: saved.webhookKeyVersion } }, transaction);
  });
  return { ...await loadWebhookInfo(user.tenantId, workflow.id), secret };
}

export async function disableWorkflowWebhook(user: User, appId: string, workflowId: string) {
  const workflow = await getWorkflowForApp(user, appId, workflowId);
  await requirePermission(user, "workflow:manage", { appId });
  await getPrismaClient().$transaction(async (transaction) => {
    await transaction.workflow.update({ where: { id: workflow.id }, data: { webhookEnabled: false, webhookSecretEncrypted: null, webhookSecretUpdatedAt: new Date() } });
    await recordAuditLog(user, { actionType: "WORKFLOW_WEBHOOK_DISABLE", resourceType: "workflow", resourceId: workflow.id, resourceName: workflow.name, detailJson: { appId } }, transaction);
  });
  return loadWebhookInfo(user.tenantId, workflow.id);
}

async function findDelivery(workflowId: string, deliveryId: string) {
  return getPrismaClient().workflowWebhookEvent.findUnique({ where: { workflowId_deliveryId: { workflowId, deliveryId } }, select: { deliveryId: true, payloadHash: true, recordId: true, runIdsJson: true, createdAt: true } });
}

async function pendingRunCount(tenantId: string, runIds: string[]) {
  return runIds.length ? getPrismaClient().workflowRun.count({ where: { id: { in: runIds }, tenantId, status: { in: ["ready", "running"] } } }) : 0;
}

async function duplicateReceipt(tenantId: string, previous: DeliveryRow, payloadHash: string): Promise<WorkflowWebhookReceipt> {
  if (previous.payloadHash !== payloadHash) throw new ServiceError("同じ配信IDで異なる本文が送信されました。", 409);
  const runIds = stringList(previous.runIdsJson);
  return { deliveryId: previous.deliveryId, recordId: previous.recordId, runIds, duplicate: true, dispatchPending: await pendingRunCount(tenantId, runIds) > 0 };
}

/**
 * 署名付きWebhookを受け付け、ワークフローの実行を登録する。
 * 受信記録・レコード作成・実行登録は1トランザクションで確定し、同じ配信IDの再送は最初の結果を返す。
 */
export async function receiveWorkflowWebhook(workflowId: string, request: Request): Promise<WorkflowWebhookReceipt> {
  const envelope = webhookEnvelope(request);
  const body = await readWebhookBody(request);
  const prisma = getPrismaClient();
  const workflow = WORKFLOW_ID_PATTERN.test(workflowId)
    ? await prisma.workflow.findUnique({ where: { id: workflowId }, include: { app: true, tenant: { select: { status: true } }, createdBy: true } })
    : null;
  if (!workflow || workflow.triggerType !== "webhook" || !workflow.webhookEnabled || !workflow.webhookSecretEncrypted) throw notFound();
  let secret: string;
  try { secret = decryptSecret(workflow.webhookSecretEncrypted); }
  catch { throw new ServiceError("Webhook秘密鍵を復号できません。秘密鍵を再発行してください。", 503); }
  verifyWebhookSignature(secret, envelope, body);

  const actor = toActor(workflow.createdBy);
  const deliveryId = envelope.deliveryId;
  try {
    if (workflow.status !== "active") throw new ServiceError("ワークフローが有効ではありません。", 409);
    if (workflow.tenant.status !== "active" || workflow.app.tenantId !== workflow.tenantId || workflow.app.status === "archived" || workflow.createdBy.tenantId !== workflow.tenantId || workflow.createdBy.status !== "active") throw new ServiceError("Webhookの実行主体またはアプリが無効です。", 409);
    const payload = parseWebhookPayload(body);
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const previous = await findDelivery(workflow.id, deliveryId);
    if (previous) return await duplicateReceipt(workflow.tenantId, previous, payloadHash);

    await requirePermission(actor, "workflow:manage", { appId: workflow.appId });
    const scope = resolveWebhookTableScope(workflow.definitionJson, payload);
    const tableWhere = { tenantId: workflow.tenantId, appId: workflow.appId, ...(scope.tableId ? { id: scope.tableId } : {}), ...(scope.tableCode ? { code: scope.tableCode } : {}) };
    const base = { appId: workflow.appId, appCode: workflow.app.code, triggerTypes: ["webhook" as const], workflowIds: [workflow.id], eventKey: `webhook:${deliveryId}` };

    let commit: (transaction: Prisma.TransactionClient) => Promise<{ recordId: string; runIds: string[] }>;
    if (payload.recordId) {
      const record = await prisma.appRecord.findFirst({ where: { id: payload.recordId, tenantId: workflow.tenantId, appId: workflow.appId, deletedAt: null, table: tableWhere }, include: { table: { select: { id: true, code: true, name: true } } } });
      if (!record) throw new ServiceError("対象レコードが見つかりません。", 404);
      await requirePermission(actor, "record:write", { appId: workflow.appId, tableId: record.tableId });
      commit = async (transaction) => ({
        recordId: record.id,
        runIds: await enqueueWorkflowsForRecord(actor, { ...base, tableId: record.table.id, tableCode: record.table.code, tableName: record.table.name, recordId: record.id, recordTitle: titleOf(record) }, transaction),
      });
    } else {
      if (!scope.tableId && !scope.tableCode) throw new ServiceError("新規レコードを作成するにはtableIdまたはtableCodeを指定してください。", 400);
      const table = await prisma.appTable.findFirst({ where: tableWhere, select: { code: true } });
      if (!table) throw new ServiceError("対象テーブルが見つかりません。", 404);
      const prepared = await prepareRecordCreation(actor, workflow.app.code, table.code, { data: payload.data!, status: payload.status });
      commit = async (transaction) => {
        const created = await createPreparedRecord(actor, prepared, transaction);
        const webhookRunIds = await enqueueWorkflowsForRecord(actor, { ...base, tableId: prepared.table.id, tableCode: prepared.table.code, tableName: prepared.table.name, recordId: created.record.id, recordTitle: titleOf(created.record) }, transaction);
        return { recordId: created.record.id, runIds: [...new Set([...created.runIds, ...webhookRunIds])] };
      };
    }

    let saved: { recordId: string; runIds: string[] } | null = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      try {
        saved = await prisma.$transaction(async (transaction) => {
          // 先に受信記録を確定させ、同じ配信IDの同時受信はここで一意制約により直列化する。
          const event = await transaction.workflowWebhookEvent.create({ data: { tenantId: workflow.tenantId, workflowId: workflow.id, deliveryId, payloadHash, runIdsJson: [] } });
          const result = await commit(transaction);
          await transaction.workflowWebhookEvent.update({ where: { id: event.id }, data: { recordId: result.recordId, runIdsJson: result.runIds } });
          await recordAuditLog(actor, { actionType: "WORKFLOW_WEBHOOK_RECEIVE", resourceType: "workflow", resourceId: workflow.id, resourceName: workflow.name, detailJson: { appId: workflow.appId, deliveryId, recordId: result.recordId, created: !payload.recordId, runIds: result.runIds } }, transaction);
          return result;
        }, { timeout: 30000, maxWait: 10000 });
      } catch (error) {
        if (!isUniqueError(error)) throw error;
        const concurrent = await findDelivery(workflow.id, deliveryId);
        if (concurrent) return await duplicateReceipt(workflow.tenantId, concurrent, payloadHash);
        if (attempt === 2) throw new ServiceError("レコード番号を確保できませんでした。再送してください。", 409);
      }
    }
    if (!saved) throw new ServiceError("Webhookを登録できませんでした。", 500);

    if (process.env.WORKFLOW_INLINE_DISPATCH !== "false" && saved.runIds.length) {
      try { await dispatchWorkflowRunIds(actor, saved.runIds); } catch { /* 実行失敗は実行履歴に残り、workerが再試行する */ }
    }
    return { deliveryId, recordId: saved.recordId, runIds: saved.runIds, duplicate: false, dispatchPending: await pendingRunCount(workflow.tenantId, saved.runIds) > 0 };
  } catch (error) {
    // 署名検証を通過した送信だけを監査対象にし、未認証の大量送信で監査ログが溢れないようにする。
    await recordAuditFailure(actor, { actionType: "WORKFLOW_WEBHOOK_RECEIVE", resourceType: "workflow", resourceId: workflow.id, resourceName: workflow.name, detailJson: { appId: workflow.appId, deliveryId } }, error);
    throw error;
  }
}
