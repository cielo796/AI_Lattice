import { expect, test, type APIResponse } from "@playwright/test";
import { Client } from "pg";
import { getPostgresConnectionOptions } from "../src/server/db/connection.mjs";
import type { App, AppField, AppTable, AppView } from "../src/types/app";
import type { AppRecord } from "../src/types/record";

test.skip(process.env.PLAYWRIGHT_PERFORMANCE_TEST !== "true", "Requires an explicitly enabled disposable local database.");
test.use({ actionTimeout: 15000 });

async function json<Result>(response: APIResponse): Promise<Result> {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return body ? JSON.parse(body) as Result : null as Result;
}

test("5,000 records stay bounded while paging, searching and aggregating on desktop and mobile", async ({ page }) => {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  await json(await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const suffix = Date.now();
  const app = await json<App>(await page.request.post("/api/apps", { data: { name: `Performance ${suffix}`, code: `performance-${suffix}`, status: "published" } }));
  const client = new Client(getPostgresConnectionOptions(process.env.DATABASE_URL!));
  try {
    await client.connect();
    const table = await json<AppTable>(await page.request.post(`/api/apps/${app.id}/tables`, { data: { name: "Records", code: "records" } }));
    for (const field of [
      { name: "件名", code: "title", fieldType: "text" },
      { name: "金額", code: "amount", fieldType: "number" },
      { name: "分類", code: "category", fieldType: "select", settingsJson: { options: ["A", "B"] } },
      { name: "日付", code: "due", fieldType: "date" },
    ]) await json<AppField>(await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, { data: field }));
    const views: AppView[] = [];
    for (const view of [
      { name: "List", viewType: "list", settingsJson: { columns: ["title", "amount"], sort: { fieldCode: "amount", direction: "asc" } } },
      { name: "Board", viewType: "kanban", settingsJson: { groupByFieldCode: "category" } },
      { name: "Calendar", viewType: "calendar", settingsJson: { dateFieldCode: "due" } },
      { name: "Chart", viewType: "chart", settingsJson: { groupByFieldCode: "category", metricFieldCode: "amount" } },
      { name: "Summary", viewType: "summary", settingsJson: { metricFieldCode: "amount" } },
    ]) views.push(await json<AppView>(await page.request.post(`/api/apps/${app.id}/tables/${table.id}/views`, { data: view })));
    await client.query(`INSERT INTO app_records (id, tenant_id, app_id, table_id, record_no, status, data_json, created_by_id, updated_by_id, updated_at)
      SELECT 'performance-' || gen_random_uuid()::text, tenant_id, id, $2, series, 'active',
      jsonb_build_object('title', 'Perf ' || lpad(series::text, 5, '0'), 'amount', series, 'category', CASE WHEN series % 2 = 0 THEN 'A' ELSE 'B' END)
        || CASE WHEN series > 100 THEN jsonb_build_object('due', '2026-10-06') ELSE '{}'::jsonb END,
      created_by_id, created_by_id, CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
      FROM apps CROSS JOIN generate_series(1, 5000) AS series WHERE id = $1`, [app.id, table.id]);
    const records = await json<AppRecord[]>(await page.request.get(`/api/run/${app.code}/${table.code}`));
    expect(records).toHaveLength(5000);
    const target = records.find((record) => record.data.title === "Perf 05000")!;
    const rowSelector = '[data-testid^="record-row-"]';

    await page.goto(`/run/${app.code}/${table.code}`);
    await expect(page.locator(rowSelector)).toHaveCount(50);
    await expect(page.getByText("Perf 00001", { exact: true })).toBeVisible();
    await expect(page.getByText("Perf 05000", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "レコード一覧の次のページ", exact: true }).click();
    await expect(page.getByText("Perf 00051", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "レコード一覧のページ切替" })).toContainText("51〜100 / 5000件");
    await page.getByPlaceholder("レコードを検索...").fill("Perf 05000");
    await expect(page.locator(rowSelector)).toHaveCount(1);
    await expect(page.getByTestId(`record-row-${target.id}`)).toBeVisible();
    await page.getByPlaceholder("レコードを検索...").fill("");
    await expect(page.locator(rowSelector)).toHaveCount(50);
    await expect(page.getByText("Perf 00001", { exact: true })).toBeVisible();

    await page.getByTestId(`runtime-view-tab-${views[1].id}`).click();
    await expect(page.getByTestId("runtime-kanban-view").locator(rowSelector)).toHaveCount(100);
    await page.getByRole("button", { name: "Aのレコードの次のページ", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Aのレコードのページ切替" })).toContainText("51〜100 / 2500件");
    await page.getByTestId(`runtime-view-tab-${views[2].id}`).click();
    await expect(page.getByTestId("runtime-calendar-view").locator(rowSelector)).toHaveCount(50);
    await page.getByRole("button", { name: "日付なしのレコードの次のページ", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "日付なしのレコードのページ切替" })).toContainText("51〜100 / 100件");
    await page.getByTestId(`runtime-view-tab-${views[3].id}`).click();
    await expect(page.getByTestId("runtime-chart-view")).toContainText("5000");
    await page.getByTestId(`runtime-view-tab-${views[4].id}`).click();
    await expect(page.getByTestId("runtime-summary-view")).toContainText("12,502,500");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/m/${app.code}/${table.code}`);
    const mobileSelector = '[data-testid^="mobile-record-card-"]';
    await expect(page.locator(mobileSelector)).toHaveCount(50);
    await page.getByRole("button", { name: "レコード一覧の次のページ", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "レコード一覧のページ切替" })).toContainText("51〜100 / 5000件");
    await page.getByPlaceholder("レコードを検索...").fill("Perf 05000");
    await expect(page.locator(mobileSelector)).toHaveCount(1);
    await expect(page.getByTestId(`mobile-record-card-${target.id}`)).toBeVisible();
    await page.getByPlaceholder("レコードを検索...").fill("");
    await expect(page.locator(mobileSelector)).toHaveCount(50);
    await page.getByTestId(`mobile-runtime-view-tab-${views[1].id}`).click();
    await expect(page.getByTestId("mobile-runtime-kanban-view").locator(mobileSelector)).toHaveCount(100);
    await page.getByTestId(`mobile-runtime-view-tab-${views[4].id}`).click();
    await expect(page.getByTestId("mobile-runtime-summary-view")).toContainText("12,502,500");
  } finally {
    await client.end();
    await json(await page.request.delete(`/api/apps/${app.id}`));
    await page.request.post("/api/auth/logout");
  }
});
