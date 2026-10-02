import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { Client } from "pg";
import { getPostgresConnectionOptions } from "../src/server/db/connection.mjs";
import type { App, AppField, AppForm, AppTable, AppVersionSummary, AppView } from "../src/types/app";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires an explicitly enabled disposable local test database.");
test.use({ actionTimeout: 15000 });

async function json<Result>(response: APIResponse): Promise<Result> {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return body ? JSON.parse(body) as Result : null as Result;
}

async function rejected(response: APIResponse) {
  expect(response.status(), await response.text()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);
}

async function fixture(request: APIRequestContext, label: string) {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  await json(await request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const suffix = `${Date.now()}-${label}`;
  const app = await json<App>(await request.post("/api/apps", { data: { name: `Audit ${suffix}`, code: `audit-${suffix}`, status: "draft" } }));
  return { app, tablesUrl: `/api/apps/${app.id}/tables` };
}

test("app metadata, typed records, five views, forms, publishing and cleanup", async ({ page }) => {
  const { app, tablesUrl } = await fixture(page.request, "lifecycle");
  const client = new Client(getPostgresConnectionOptions(process.env.DATABASE_URL!));
  await client.connect();
  try {
    await rejected(await page.request.post(`/api/apps/${app.id}/publish`));
    expect(await json(await page.request.get(`/api/apps/${app.id}`))).toMatchObject({ status: "draft" });
    const table = await json<AppTable>(await page.request.post(tablesUrl, { data: { name: "申請", code: "requests" } }));
    await rejected(await page.request.post(tablesUrl, { data: { name: "二つ目", code: "second" } }));
    const fieldsUrl = `${tablesUrl}/${table.id}/fields`;
    for (const field of [
      { name: "件名", code: "title", fieldType: "text", required: true, uniqueFlag: true },
      { name: "金額", code: "amount", fieldType: "number", required: true },
      { name: "区分", code: "stage", fieldType: "select", settingsJson: { options: ["Open", "Closed"] } },
      { name: "期限", code: "due", fieldType: "date" },
      { name: "有効", code: "enabled", fieldType: "boolean" },
    ]) await json(await page.request.post(fieldsUrl, { data: field }));
    await rejected(await page.request.post(fieldsUrl, { data: { name: "重複", code: "title", fieldType: "text" } }));
    const recordsUrl = `/api/run/${app.code}/${table.code}`;
    const valid = { title: "Alpha audit", amount: 10, stage: "Open", due: "2026-10-02", enabled: true };
    for (const invalid of [
      { ...valid, title: "" }, { ...valid, amount: "not-a-number" }, { ...valid, stage: "Unknown" },
      { ...valid, due: "not-a-date" }, { ...valid, enabled: "not-a-boolean" },
    ]) await rejected(await page.request.post(recordsUrl, { data: { data: invalid } }));
    expect(await json(await page.request.get(recordsUrl))).toEqual([]);
    const first = await json<{ id: string; data: Record<string, unknown>; recordNo: number }>(await page.request.post(recordsUrl, { data: { data: valid } }));
    await rejected(await page.request.post(recordsUrl, { data: { data: valid } }));
    const second = await json<{ id: string; recordNo: number }>(await page.request.post(recordsUrl, { data: { data: { ...valid, title: "Beta audit", amount: 20, stage: "Closed" } } }));
    expect(first.recordNo).toBe(1);
    expect(second.recordNo).toBe(2);
    await rejected(await page.request.put(`${recordsUrl}/${second.id}`, { data: { data: { title: valid.title } } }));
    const viewsUrl = `${tablesUrl}/${table.id}/views`;
    const views: AppView[] = [];
    for (const view of [
      { name: "Open audit", viewType: "list", settingsJson: { columns: ["title", "amount"], filters: [{ fieldCode: "stage", operator: "equals", value: "Open" }], sort: { fieldCode: "amount", direction: "desc" } } },
      { name: "Board audit", viewType: "kanban", settingsJson: { groupByFieldCode: "stage" } },
      { name: "Calendar audit", viewType: "calendar", settingsJson: { dateFieldCode: "due" } },
      { name: "Chart audit", viewType: "chart", settingsJson: { groupByFieldCode: "stage", metricFieldCode: "amount" } },
      { name: "Summary audit", viewType: "summary", settingsJson: { metricFieldCode: "amount" } },
    ]) views.push(await json<AppView>(await page.request.post(viewsUrl, { data: view })));
    await rejected(await page.request.post(viewsUrl, { data: { name: "Invalid audit", viewType: "list", settingsJson: { columns: ["missing"] } } }));
    const formsUrl = `${tablesUrl}/${table.id}/forms`;
    const form = await json<AppForm>(await page.request.post(formsUrl, { data: { name: "Audit form", layoutJson: { fields: [{ fieldCode: "title", visible: false, required: false, width: "full" }, { fieldCode: "amount", visible: true }] } } }));
    expect(form.layoutJson.fields).toEqual(expect.arrayContaining([expect.objectContaining({ fieldCode: "title", visible: true, required: true })]));
    await rejected(await page.request.post(formsUrl, { data: { name: "Invalid form", layoutJson: { fields: [{ fieldCode: "missing" }] } } }));
    const version = await json<AppVersionSummary>(await page.request.post(`/api/apps/${app.id}/publish`));
    expect(version).toMatchObject({ versionNo: 1, tableCount: 1, viewCount: 5 });
    const before = (await client.query("SELECT metadata_json FROM app_versions WHERE app_id = $1 AND version_no = 1", [app.id])).rows[0].metadata_json;
    await json(await page.request.put(`${viewsUrl}/${views[0].id}`, { data: { name: "Renamed audit" } }));
    await json(await page.request.put(`${formsUrl}/${form.id}`, { data: { name: "Renamed form" } }));
    expect(await json<AppVersionSummary>(await page.request.post(`/api/apps/${app.id}/publish`))).toMatchObject({ versionNo: 2 });
    expect((await client.query("SELECT metadata_json FROM app_versions WHERE app_id = $1 AND version_no = 1", [app.id])).rows[0].metadata_json).toEqual(before);
    expect(await json<AppVersionSummary[]>(await page.request.get(`/api/apps/${app.id}/versions`))).toEqual([expect.objectContaining({ versionNo: 2 }), expect.objectContaining({ versionNo: 1 })]);
    await page.goto(`/run/${app.code}/${table.code}`);
    await expect(page.getByPlaceholder("レコードを検索...")).toBeVisible();
    await expect(page.getByText("Alpha audit", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Beta audit", { exact: true })).toHaveCount(0);
    for (const view of views.slice(1)) {
      await page.getByTestId(`runtime-view-tab-${view.id}`).click();
      await expect(page.getByTestId(`runtime-view-tab-${view.id}`)).toBeVisible();
      await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
    }
    await page.getByTestId(`runtime-view-tab-${views[0].id}`).click();
    await page.getByPlaceholder("レコードを検索...").fill("does-not-match");
    await expect(page.getByText("Alpha audit", { exact: true })).toHaveCount(0);
    await json(await page.request.delete(`${formsUrl}/${form.id}`));
    for (const view of views) await json(await page.request.delete(`${viewsUrl}/${view.id}`));
    await json(await page.request.delete(`${recordsUrl}/${first.id}`));
    await rejected(await page.request.get(`${recordsUrl}/${first.id}`));
    expect(await json<Array<{ id: string }>>(await page.request.get(recordsUrl))).toEqual([expect.objectContaining({ id: second.id })]);
  } finally {
    await page.request.delete(`/api/apps/${app.id}`);
    await client.end();
  }
});

test("renaming a field preserves saved record values", async ({ request }) => {
  const { app, tablesUrl } = await fixture(request, "rename");
  const client = new Client(getPostgresConnectionOptions(process.env.DATABASE_URL!));
  await client.connect();
  try {
    const table = await json<AppTable>(await request.post(tablesUrl, { data: { name: "申請", code: "requests" } }));
    const field = await json<AppField>(await request.post(`${tablesUrl}/${table.id}/fields`, { data: { name: "件名", code: "title", fieldType: "text", required: true } }));
    const recordsUrl = `/api/run/${app.code}/${table.code}`;
    const record = await json<{ id: string }>(await request.post(recordsUrl, { data: { data: { title: "Preserve this value" } } }));
    const view = await json<AppView>(await request.post(`${tablesUrl}/${table.id}/views`, {
      data: {
        name: "Rename view", viewType: "list",
        settingsJson: { columns: ["title"], filters: [{ fieldCode: "title", operator: "contains", value: "Preserve" }], sort: { fieldCode: "title", direction: "asc" } },
      },
    }));
    const form = await json<AppForm>(await request.post(`${tablesUrl}/${table.id}/forms`, { data: { name: "Rename form", layoutJson: { fields: [{ fieldCode: "title" }] } } }));
    await json(await request.put(`${tablesUrl}/${table.id}/fields/${field.id}`, { data: { code: "subject" } }));
    expect(await json(await request.get(`${recordsUrl}/${record.id}`))).toMatchObject({ data: { subject: "Preserve this value" } });
    expect((await client.query("SELECT data_json FROM app_records WHERE id = $1", [record.id])).rows[0].data_json).not.toHaveProperty("title");
    expect((await json<AppView[]>(await request.get(`${tablesUrl}/${table.id}/views`))).find((item) => item.id === view.id)?.settingsJson).toMatchObject({ columns: ["subject"], filters: [{ fieldCode: "subject" }], sort: { fieldCode: "subject" } });
    expect((await json<AppForm[]>(await request.get(`${tablesUrl}/${table.id}/forms`))).find((item) => item.id === form.id)?.layoutJson.fields).toEqual(expect.arrayContaining([expect.objectContaining({ fieldCode: "subject" })]));
    await client.query("UPDATE app_records SET data_json = data_json || $2::jsonb WHERE id = $1", [record.id, JSON.stringify({ occupied: "Do not overwrite" })]);
    expect((await request.put(`${tablesUrl}/${table.id}/fields/${field.id}`, { data: { code: "occupied" } })).status()).toBe(409);
    expect((await json<AppField[]>(await request.get(`${tablesUrl}/${table.id}/fields`))).find((item) => item.id === field.id)?.code).toBe("subject");
    expect((await client.query("SELECT data_json FROM app_records WHERE id = $1", [record.id])).rows[0].data_json).toMatchObject({ subject: "Preserve this value", occupied: "Do not overwrite" });
  } finally {
    await request.delete(`/api/apps/${app.id}`);
    await client.end();
  }
});

test("field migration preserves JSON types, absent keys, deleted rows and app isolation", async ({ request }) => {
  const { app, tablesUrl } = await fixture(request, "json-rename");
  const other = await fixture(request, "json-other");
  const client = new Client(getPostgresConnectionOptions(process.env.DATABASE_URL!));
  await client.connect();
  try {
    const table = await json<AppTable>(await request.post(tablesUrl, { data: { name: "移行", code: "records" } }));
    const field = await json<AppField>(await request.post(`${tablesUrl}/${table.id}/fields`, { data: { name: "値", code: "legacy", fieldType: "text" } }));
    const recordsUrl = `/api/run/${app.code}/${table.code}`;
    const values = [null, false, 0, "", ["value", 2], { nested: true }];
    const recordIds: string[] = [];
    for (const value of values) {
      const record = await json<{ id: string }>(await request.post(recordsUrl, { data: { data: { legacy: "fixture" } } }));
      recordIds.push(record.id);
      await client.query("UPDATE app_records SET data_json = $2::jsonb WHERE id = $1", [record.id, JSON.stringify({ legacy: value, untouched: "keep" })]);
    }
    const missing = await json<{ id: string }>(await request.post(recordsUrl, { data: { data: {} } }));
    await json(await request.delete(`${recordsUrl}/${recordIds[0]}`));
    const otherTable = await json<AppTable>(await request.post(other.tablesUrl, { data: { name: "別アプリ", code: "records" } }));
    const otherRecord = await json<{ id: string }>(await request.post(`/api/run/${other.app.code}/${otherTable.code}`, { data: { data: { legacy: "Other app" } } }));
    await json(await request.put(`${tablesUrl}/${table.id}/fields/${field.id}`, { data: { code: "current" } }));
    for (const [index, recordId] of recordIds.entries()) {
      expect((await client.query("SELECT data_json FROM app_records WHERE id = $1", [recordId])).rows[0].data_json).toEqual({ current: values[index], untouched: "keep" });
    }
    expect((await client.query("SELECT data_json FROM app_records WHERE id = $1", [missing.id])).rows[0].data_json).not.toHaveProperty("current");
    expect((await client.query("SELECT deleted_at FROM app_records WHERE id = $1", [recordIds[0]])).rows[0].deleted_at).not.toBeNull();
    expect((await client.query("SELECT data_json FROM app_records WHERE id = $1", [otherRecord.id])).rows[0].data_json).toEqual({ legacy: "Other app" });
  } finally {
    await request.delete(`/api/apps/${app.id}`);
    await request.delete(`/api/apps/${other.app.id}`);
    await client.end();
  }
});

test("concurrent publication does not return server errors", async ({ request }) => {
  const { app, tablesUrl } = await fixture(request, "publish");
  try {
    await json(await request.post(tablesUrl, { data: { name: "申請", code: "requests" } }));
    const responses = await Promise.all(Array.from({ length: 4 }, () => request.post(`/api/apps/${app.id}/publish`)));
    expect(responses.map(response => response.status())).toEqual([201, 201, 201, 201]);
    expect((await json<AppVersionSummary[]>(await request.get(`/api/apps/${app.id}/versions`))).map((version) => version.versionNo)).toEqual([4, 3, 2, 1]);
  } finally {
    await request.delete(`/api/apps/${app.id}`);
  }
});

test("mobile runtime can create and display a record", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { app, tablesUrl } = await fixture(page.request, "mobile");
  try {
    const table = await json<AppTable>(await page.request.post(tablesUrl, { data: { name: "申請", code: "requests" } }));
    await json(await page.request.post(`${tablesUrl}/${table.id}/fields`, { data: { name: "件名", code: "title", fieldType: "text", required: true } }));
    await json(await page.request.post(`/api/apps/${app.id}/publish`));
    await page.goto(`/run/${app.code}/${table.code}`);
    await page.getByRole("button", { name: "操作メニュー", exact: true }).click();
    await page.getByRole("button", { name: /新規レコード/ }).click();
    await page.getByPlaceholder("件名を入力").fill("Mobile audit record");
    await page.getByRole("button", { name: "レコードを作成", exact: true }).click();
    await expect(page.getByText("レコードを作成しました")).toBeVisible();
    await expect(page.getByText("Mobile audit record", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: "test-results/audit-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
  } finally {
    await page.request.delete(`/api/apps/${app.id}`);
  }
});

test("responsive workflow actions remain usable for saving and activation", async ({ page }) => {
  const { app, tablesUrl } = await fixture(page.request, "mobile-workflow");
  try {
    const table = await json<AppTable>(await page.request.post(tablesUrl, { data: { name: "申請", code: "requests" } }));
    const workflow = await json<{ id: string }>(await page.request.post(`/api/apps/${app.id}/workflows`, {
      data: {
        name: "Mobile workflow", triggerType: "create", status: "draft",
        definitionJson: {
          nodes: [
            { id: "start", data: { label: "開始", nodeType: "trigger", config: { tableId: table.id } } },
            { id: "done", data: { label: "完了", nodeType: "status_update", config: { status: "complete" } } },
          ],
          edges: [{ id: "start-done", source: "start", target: "done" }],
        },
      },
    }));
    await page.goto(`/apps/${app.id}/workflows`);
    await expect(page.getByLabel("ワークフロー名", { exact: true })).toHaveValue("Mobile workflow");
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(async () => (await page.locator('[data-guide="workflow-canvas"] .react-flow').boundingBox())?.height ?? 0).toBeGreaterThan(200);
      const menu = page.getByRole("button", { name: "操作メニュー", exact: true });
      if (width < 1024) await menu.click();
      await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "有効化", exact: true })).toBeVisible();
      const bounds = await page.locator('[data-guide="topbar-actions"]').boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width < 1024) {
        await page.keyboard.press("Escape");
        await expect(menu).toHaveAttribute("aria-expanded", "false");
        await expect(menu).toBeFocused();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel("ワークフロー名", { exact: true }).fill("Mobile workflow saved");
    await page.getByRole("button", { name: "操作メニュー", exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ワークフローを下書き保存しました。" })).toBeVisible();
    expect(await json(await page.request.get(`/api/apps/${app.id}/workflows/${workflow.id}`))).toMatchObject({ name: "Mobile workflow saved", status: "draft" });
    await page.getByRole("button", { name: "操作メニュー", exact: true }).click();
    await page.getByRole("button", { name: "有効化", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ワークフローを有効な状態で保存しました。" })).toBeVisible();
    expect(await json(await page.request.get(`/api/apps/${app.id}/workflows/${workflow.id}`))).toMatchObject({ status: "active" });
    await page.getByRole("button", { name: "操作メニュー", exact: true }).click();
    await page.screenshot({ path: "test-results/fix-mobile-workflow.png", fullPage: true });
  } finally {
    await page.request.delete(`/api/apps/${app.id}`);
  }
});
