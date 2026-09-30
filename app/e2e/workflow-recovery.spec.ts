import { expect, test, type APIResponse } from "@playwright/test";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { getPostgresConnectionOptions } from "../src/server/db/connection.mjs";
import type { WorkflowDefinition, WorkflowRun } from "../src/types/workflow";

test.skip(process.env.PLAYWRIGHT_WORKFLOW_RECOVERY_TEST !== "true", "Requires an explicitly enabled local test database and CRON_SECRET.");

async function json<Result>(response: APIResponse): Promise<Result> {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return JSON.parse(body) as Result;
}

test("quarantines a crashed external step, then requires an explicit audited operator decision in the browser", async ({ page }) => {
  const connection = process.env.DATABASE_URL!;
  const database = new URL(connection);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/(stitch|lattice_e2e|lattice_test_[a-z0-9_]+)$/);
  expect(process.env.CRON_SECRET?.length).toBeGreaterThanOrEqual(32);
  await json(await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const app = await json<{ id: string; code: string }>(await page.request.post("/api/apps", { data: { name: `Recovery ${Date.now()}`, code: `recovery-${Date.now()}`, status: "published" } }));
  const client = new Client(getPostgresConnectionOptions(connection));
  await client.connect();
  try {
    const table = await json<{ id: string; code: string }>(await page.request.post(`/api/apps/${app.id}/tables`, { data: { name: "申請", code: "requests" } }));
    await json(await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, { data: { name: "件名", code: "title", fieldType: "text" } }));
    const record = await json<{ id: string }>(await page.request.post(`/api/run/${app.code}/${table.code}`, { data: { data: { title: "Process crash fixture" } } }));
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
        { id: "api", data: { label: "外部処理", nodeType: "api_call", config: { url: "https://workflow-test.invalid", failurePolicy: "fail" } } },
        { id: "done", data: { label: "後続処理", nodeType: "status_update", config: { status: "recovery_complete" } } },
      ], edges: [{ id: "01", source: "start", target: "api" }, { id: "02", source: "api", target: "done" }],
    };
    const workflow = await json<{ id: string }>(await page.request.post(`/api/apps/${app.id}/workflows`, { data: { name: "Recovery workflow", triggerType: "create", status: "active", definitionJson: graph } }));
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const context = { appId: app.id, appCode: app.code, tableId: table.id, tableCode: table.code, tableName: "申請", recordId: record.id, recordTitle: "Process crash fixture", triggerTypes: ["create"] };
    const state = { queue: [], executions: [{ nodeId: "start", nodeType: "trigger", status: "success", startedAt }, { nodeId: "api", nodeType: "api_call", status: "running", startedAt }] };
    await client.query(`INSERT INTO workflow_runs (id, tenant_id, app_id, record_id, workflow_id, workflow_name, actor_id, event_key, definition_json, context_json, state_json, status, lease_token, lease_expires_at, updated_at)
      SELECT $1, tenant_id, id, $2, $3, 'Recovery workflow', created_by_id, $1, $4::jsonb, $5::jsonb, $6::jsonb, 'running', 'crashed-test-worker', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP AT TIME ZONE 'UTC' FROM apps WHERE id = $7`,
    [runId, record.id, workflow.id, JSON.stringify(graph), JSON.stringify(context), JSON.stringify(state), app.id]);
    expect((await page.request.post("/api/internal/workflows/dispatch")).status()).toBe(401);
    await json(await page.request.post("/api/internal/workflows/dispatch?limit=50", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    const runs = await json<WorkflowRun[]>(await page.request.get(`/api/apps/${app.id}/workflow-runs?workflowId=${workflow.id}`));
    expect(runs.find((run) => run.id === runId)?.status).toBe("interrupted");
    await page.goto(`/apps/${app.id}/workflows`);
    const history = page.getByRole("region", { name: "ワークフロー実行履歴" });
    await expect(history.getByText(/結果確認が必要 ·/)).toBeVisible();
    await history.locator("summary").first().click();
    await expect(history.getByRole("button", { name: "失敗として終了", exact: true })).toBeDisabled();
    await history.getByLabel("復旧操作", { exact: true }).selectOption("skip");
    await history.getByLabel("復旧判断の理由", { exact: true }).fill("外部実行先で処理済みを確認したため後続へ進める");
    await expect(history.getByRole("button", { name: "処理済みとして次へ", exact: true })).toBeDisabled();
    await history.getByRole("checkbox", { name: "外部処理の結果と重複リスクを確認しました" }).check();
    await page.screenshot({ path: "test-results/workflow-recovery-confirmation.png", fullPage: true });
    page.once("dialog", (dialog) => dialog.accept());
    await history.getByRole("button", { name: "処理済みとして次へ", exact: true }).click();
    await expect(history.getByText("done: 成功", { exact: true })).toBeVisible();
    await expect(history.getByText("api: 未通過", { exact: true })).toBeVisible();
    expect(await json<{ status: string }>(await page.request.get(`/api/run/${app.code}/${table.code}/${record.id}`))).toMatchObject({ status: "recovery_complete" });
    const decisions = await json<Array<{ resourceId: string; actionType: string }>>(await page.request.get("/api/admin/audit-logs?actionType=WORKFLOW_RECOVERY_DECISION"));
    expect(decisions.some((entry) => entry.resourceId === runId)).toBe(true);
    const resumed = (await json<WorkflowRun[]>(await page.request.get(`/api/apps/${app.id}/workflow-runs?workflowId=${workflow.id}`))).find((run) => run.id === runId)!;
    expect(resumed.status).toBe("completed");
    expect((await page.request.post(`/api/apps/${app.id}/workflow-runs/${runId}/recover`, { data: { action: "retry", reason: "Duplicate decision", expectedUpdatedAt: runs[0].updatedAt, confirmExternalOutcome: true } })).status()).toBe(409);
  } finally {
    await client.end();
    await page.request.delete(`/api/apps/${app.id}`);
  }
});
