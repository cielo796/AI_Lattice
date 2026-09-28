import { expect, test, type APIResponse } from "@playwright/test";
import type { WorkflowDefinition, WorkflowRun } from "../src/types/workflow";

async function json<Result>(response: APIResponse): Promise<Result> {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return JSON.parse(body) as Result;
}

test("record-triggered graph branches, waits for two decisions and exposes execution history", async ({ page }) => {
  await json(await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const suffix = Date.now();
  const app = await json<{ id: string; code: string }>(await page.request.post("/api/apps", { data: { name: `Graph ${suffix}`, code: `graph-${suffix}`, status: "published" } }));
  try {
    const table = await json<{ id: string; code: string }>(await page.request.post(`/api/apps/${app.id}/tables`, { data: { name: "申請", code: "requests" } }));
    await json(await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, { data: { name: "件名", code: "title", fieldType: "text", required: true } }));
    const graph: WorkflowDefinition = {
      nodes: [
        { id: "done", data: { label: "完了処理", nodeType: "status_update", config: { status: "complete" } } },
        { id: "second", data: { label: "二次承認", nodeType: "approval", config: { titleTemplate: "二次承認", policy: "override" } } },
        { id: "first", data: { label: "一次承認", nodeType: "approval", config: { titleTemplate: "一次承認", policy: "override" } } },
        { id: "automatic", data: { label: "自動処理", nodeType: "status_update", config: { status: "automatic" } } },
        { id: "condition", data: { label: "条件", nodeType: "condition", config: { fieldCode: "title", value: "review" } } },
        { id: "start", data: { label: "開始", nodeType: "trigger" } },
      ].map((node, index) => ({ ...node, position: { x: index * 300, y: 100 } })) as WorkflowDefinition["nodes"],
      edges: [
        { id: "01", source: "start", target: "condition" },
        { id: "02", source: "condition", target: "first", label: "yes" },
        { id: "03", source: "condition", target: "automatic", label: "no" },
        { id: "04", source: "first", target: "second", label: "approved" },
        { id: "05", source: "second", target: "done", label: "approved" },
      ],
    };
    const workflow = await json<{ id: string }>(await page.request.post(`/api/apps/${app.id}/workflows`, { data: { name: "Graph approval", triggerType: "create", status: "active", definitionJson: graph } }));
    const automatic = await json<{ status: string }>(await page.request.post(`/api/run/${app.code}/${table.code}`, { data: { data: { title: "automatic" } } }));
    expect(automatic.status).toBe("automatic");
    const record = await json<{ id: string; status: string }>(await page.request.post(`/api/run/${app.code}/${table.code}`, { data: { data: { title: "review" } } }));
    expect(record.status).toBe("pending_approval");
    await page.goto(`/run/${app.code}/approvals`);
    await expect(page.getByRole("heading", { name: "一次承認", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "承認", exact: true }).click();
    await expect(page.getByRole("heading", { name: "二次承認", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "承認", exact: true }).click();
    await expect(page.getByText("対象の承認はありません。", { exact: true })).toBeVisible();
    expect(await json<{ status: string }>(await page.request.get(`/api/run/${app.code}/${table.code}/${record.id}`))).toMatchObject({ status: "complete" });
    const runs = await json<WorkflowRun[]>(await page.request.get(`/api/apps/${app.id}/workflow-runs?workflowId=${workflow.id}`));
    expect(runs).toHaveLength(2);
    expect(runs.every((run) => run.status === "completed")).toBe(true);
    const review = runs.find((run) => run.recordId === record.id)!;
    expect(review.state.executions.filter((step) => step.approvalId)).toHaveLength(2);
    await page.goto(`/apps/${app.id}/workflows`);
    const history = page.getByRole("region", { name: "ワークフロー実行履歴" });
    await expect(history).toBeVisible();
    await expect(history.locator("details")).toHaveCount(2);
    await history.locator("summary").first().click();
    await expect(history.getByText("done: 成功", { exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/apps/${app.id}`);
  }
});
