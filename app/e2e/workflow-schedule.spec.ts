import { expect, test, type APIResponse } from "@playwright/test";
import type { WorkflowDefinition, WorkflowRun } from "../src/types/workflow";

test.skip(process.env.PLAYWRIGHT_WORKFLOW_SCHEDULE_TEST !== "true", "Requires an explicitly enabled loopback test database and CRON_SECRET.");

async function json<Result>(response: APIResponse): Promise<Result> {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return JSON.parse(body) as Result;
}

test("configures a schedule in the editor, queues a durable cycle once and dispatches it independently", async ({ page }) => {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/(stitch|lattice_e2e|lattice_test_[a-z0-9_]+)$/);
  expect(process.env.CRON_SECRET?.length).toBeGreaterThanOrEqual(32);
  const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
  await json(await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const suffix = Date.now();
  const app = await json<{ id: string; code: string }>(await page.request.post("/api/apps", { data: { name: `Schedule ${suffix}`, code: `schedule-${suffix}`, status: "published" } }));
  try {
    const table = await json<{ id: string; code: string }>(await page.request.post(`/api/apps/${app.id}/tables`, { data: { name: "申請", code: "requests" } }));
    await json(await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, { data: { name: "件名", code: "title", fieldType: "text" } }));
    const records: string[] = [];
    for (let index = 0; index < 2; index += 1) records.push((await json<{ id: string }>(await page.request.post(`/api/run/${app.code}/${table.code}`, { data: { status: "draft", data: { title: `定期処理 ${index}` } } }))).id);
    const graph: WorkflowDefinition = {
      nodes: [{ id: "start", data: { label: "定期登録", nodeType: "trigger", config: { tableId: table.id } } }, { id: "done", data: { label: "完了", nodeType: "status_update", config: { status: "schedule_complete" } } }],
      edges: [{ id: "edge", source: "start", target: "done" }],
    };
    const workflow = await json<{ id: string }>(await page.request.post(`/api/apps/${app.id}/workflows`, { data: { name: "定期ワークフロー", triggerType: "schedule", status: "draft", definitionJson: graph } }));
    await page.goto(`/apps/${app.id}/workflows`);
    await page.getByRole("button", { name: "ノード: 定期登録", exact: true }).click();
    await expect(page.getByLabel("スケジュール間隔（分）", { exact: true })).toHaveValue("60");
    await page.getByLabel("スケジュール間隔（分）", { exact: true }).fill("17");
    await page.getByRole("button", { name: "有効化", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ワークフローを有効な状態で保存しました。" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "ノード: 定期登録", exact: true }).click();
    await expect(page.getByLabel("スケジュール間隔（分）", { exact: true })).toHaveValue("17");
    const state = page.getByRole("region", { name: "スケジュール実行状態" });
    await expect(state.getByText("まだ定期登録されていません", { exact: true })).toBeVisible();
    expect((await page.request.post("/api/internal/workflows/schedules/run")).status()).toBe(401);
    for (const value of ["0", "501", "1.5", "10junk"]) expect((await page.request.post(`/api/internal/workflows/schedules/run?limit=${value}`, { headers })).status()).toBe(400);
    expect(await json(await page.request.post("/api/internal/workflows/schedules/run?limit=1", { headers }))).toMatchObject({ recordCount: 1, queuedRunCount: 1 });
    await state.getByRole("button", { name: "状態を更新", exact: true }).click();
    await expect(state.getByText("対象レコードの登録途中", { exact: true })).toBeVisible();
    const initial = await json<WorkflowRun[]>(await page.request.get(`/api/apps/${app.id}/workflow-runs?workflowId=${workflow.id}`));
    expect(initial).toHaveLength(1);
    expect(initial[0].status).toBe("ready");
    for (const recordId of records) expect(await json(await page.request.get(`/api/run/${app.code}/${table.code}/${recordId}`))).toMatchObject({ status: "draft" });
    expect(await json(await page.request.post("/api/internal/workflows/schedules/run?limit=1", { headers }))).toMatchObject({ recordCount: 1, queuedRunCount: 1, completedCycleCount: 1 });
    expect(await json(await page.request.post("/api/internal/workflows/schedules/run?limit=50", { headers }))).toMatchObject({ recordCount: 0, queuedRunCount: 0 });
    await state.getByRole("button", { name: "状態を更新", exact: true }).click();
    await expect(state.getByText("次の周期を待機中", { exact: true })).toBeVisible();
    await json(await page.request.post("/api/internal/workflows/dispatch?limit=50", { headers }));
    const completed = await json<WorkflowRun[]>(await page.request.get(`/api/apps/${app.id}/workflow-runs?workflowId=${workflow.id}`));
    expect(completed).toHaveLength(2);
    expect(completed.every((run) => run.status === "completed")).toBe(true);
    for (const recordId of records) expect(await json(await page.request.get(`/api/run/${app.code}/${table.code}/${recordId}`))).toMatchObject({ status: "schedule_complete" });
    const history = page.getByRole("region", { name: "ワークフロー実行履歴" });
    await history.getByRole("button", { name: "更新", exact: true }).click();
    await expect(history.locator("summary")).toHaveCount(2);
    await expect(history.getByText(/完了 ·/)).toHaveCount(2);
    await page.screenshot({ path: "test-results/workflow-schedule.png", fullPage: true });
    const logs = await json<Array<{ resourceId: string; actionType: string }>>(await page.request.get("/api/admin/audit-logs?actionType=WORKFLOW_SCHEDULE_BATCH"));
    expect(logs.filter((log) => log.resourceId === workflow.id)).toHaveLength(2);
  } finally {
    await page.request.delete(`/api/apps/${app.id}`);
  }
});
