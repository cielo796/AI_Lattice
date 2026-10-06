import { expect, test, type Page } from "@playwright/test";
import type { App, AppField, AppForm, AppTable } from "../src/types/app";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires an explicitly enabled disposable local test database.");
test.use({ viewport: { width: 1440, height: 1300 }, actionTimeout: 15000 });

async function setup(page: Page, minimal = false) {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  expect((await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } })).ok()).toBe(true);
  const response = await page.request.post("/api/apps", { data: { name: "配置テスト", code: `layout-${Date.now()}-${minimal ? "touch" : "desktop"}` } });
  expect(response.ok()).toBe(true);
  const app = await response.json() as App;
  const tableResponse = await page.request.post(`/api/apps/${app.id}/tables`, { data: { name: "在庫品", code: "items" } });
  expect(tableResponse.ok()).toBe(true);
  const table = await tableResponse.json() as AppTable;
  const base = `/api/apps/${app.id}/tables/${table.id}`;
  const definitions = [
    { name: "品目名", code: "name", fieldType: "text", required: true },
    { name: "在庫数", code: "stock", fieldType: "number" },
    ...minimal ? [] : [
      { name: "発注点", code: "point", fieldType: "number" },
      { name: "入荷日", code: "date", fieldType: "date" },
      { name: "備考", code: "notes", fieldType: "textarea" },
      { name: "添付", code: "attachment", fieldType: "file" },
    ],
  ];
  for (const definition of definitions) expect((await page.request.post(`${base}/fields`, { data: definition })).ok()).toBe(true);
  const fieldConfigurations = minimal ? [
    { fieldCode: "name", visible: true, required: true, width: "full" },
    { fieldCode: "stock", visible: true, width: "full" },
  ] : [
    { fieldCode: "name", visible: true, required: true, width: "full", rowIndex: 0 },
    { fieldCode: "stock", visible: true, width: "half", rowIndex: 1 },
    { fieldCode: "point", visible: true, width: "half", rowIndex: 1 },
    { fieldCode: "date", visible: true, width: "full", rowIndex: 2 },
    { fieldCode: "notes", visible: true, width: "full", rowIndex: 3 },
    { fieldCode: "attachment", visible: false, width: "full", helpText: "任意の添付" },
  ];
  const formResponse = await page.request.post(`${base}/forms`, { data: { name: "配置フォーム", layoutJson: { fields: fieldConfigurations } } });
  expect(formResponse.ok()).toBe(true);
  const form = await formResponse.json() as AppForm;
  await page.goto(`/apps/${app.id}/tables`);
  await page.getByRole("button", { name: "詳細設定", exact: true }).click();
  await page.getByRole("button", { name: "フォーム配置を編集", exact: true }).click();
  await expect(page.getByLabel("フォーム名", { exact: true })).toHaveValue("配置フォーム");
  return { app, table, base, form };
}

async function drag(page: Page, sourceSelector: string, targetSelector: string, horizontal: number, vertical: number) {
  await page.locator(".fl-canvas").scrollIntoViewIfNeeded();
  const source = await page.locator(sourceSelector).boundingBox();
  const target = await page.locator(targetSelector).boundingBox();
  expect(source).not.toBeNull(); expect(target).not.toBeNull();
  await page.mouse.move(source!.x + 20, source!.y + 22); await page.mouse.down();
  await page.mouse.move(target!.x + target!.width * horizontal, target!.y + target!.height * vertical, { steps: 12 });
  await page.mouse.up();
}

test("saved table forms support pointer layout, gaps, keyboard, retry and runtime persistence without changing table fields", async ({ page }) => {
  const fixture = await setup(page);
  try {
    await expect(page.locator("[data-layout-field]")).toHaveCount(5);
    await expect(page.locator('[data-layout-row="1"] [data-layout-field]')).toHaveCount(2);
    await page.locator(".fl-canvas").scrollIntoViewIfNeeded();
    const notes = await page.locator('[data-layout-field="notes"]').boundingBox();
    await page.mouse.move(notes!.x + 20, notes!.y + 22); await page.mouse.down();
    await page.mouse.move(notes!.x + 45, notes!.y + 22); await page.keyboard.press("Escape"); await page.mouse.up();
    await expect(page.getByRole("status")).toContainText("ドラッグを取り消しました");
    await expect(page.locator('[data-layout-row="3"]')).toContainText("備考");
    await drag(page, '[data-layout-field="notes"]', '[data-layout-field="name"]', .95, .5);
    await expect(page.locator('[data-layout-row="0"] [data-layout-field]')).toHaveCount(2);
    const stock = page.locator('[data-layout-field="stock"]');
    await stock.focus(); await page.keyboard.press("Alt+ArrowDown");
    await expect(stock).toBeFocused(); await page.keyboard.press("Alt+ArrowDown");
    await expect(page.locator('[data-layout-row="1"] [data-layout-slot]')).toHaveCount(1);
    await page.getByRole("button", { name: "添付を配置", exact: true }).press("Enter");
    await expect(page.locator('[data-layout-field="attachment"]')).toContainText("ファイルを追加");
    await page.getByRole("button", { name: "添付を非表示にする", exact: true }).click();
    await expect(page.locator('[data-layout-field="attachment"]')).toHaveCount(0);
    await stock.press("Enter");
    await expect(page.locator('[data-layout-row="3"]')).toContainText("在庫数");
    await page.getByRole("region", { name: "在庫数のフォーム設定" }).getByLabel("入力時の補足").fill("実在庫を入力");
    await page.getByRole("region", { name: "在庫数のフォーム設定" }).getByRole("checkbox", { name: "フォームで必須", exact: true }).check();
    await expect(page.getByRole("button", { name: "品目名を非表示にする", exact: true })).toBeDisabled();
    await page.route(`**/forms/${fixture.form.id}`, async (route) => {
      if (route.request().method() === "PUT") await route.fulfill({ status: 503, json: { message: "保存を再試行してください" } });
      else await route.continue();
    });
    await page.getByRole("button", { name: "フォームを更新", exact: true }).click();
    await expect(page.getByText("保存を再試行してください", { exact: true })).toBeVisible();
    await expect(page.locator('[data-layout-row="3"]')).toContainText("実在庫を入力");
    await page.unroute(`**/forms/${fixture.form.id}`);
    const savedResponse = page.waitForResponse((response) => response.url().endsWith(`/forms/${fixture.form.id}`) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "フォームを更新", exact: true }).click();
    expect((await savedResponse).ok()).toBe(true);
    const forms = await (await page.request.get(`${fixture.base}/forms`)).json() as AppForm[];
    expect(forms[0].layoutJson.fields).toEqual([
      { fieldCode: "name", visible: true, required: true, width: "half", rowIndex: 0 },
      { fieldCode: "notes", visible: true, required: false, width: "half", rowIndex: 0 },
      { fieldCode: "point", visible: true, required: false, width: "half", rowIndex: 1 },
      { fieldCode: "date", visible: true, required: false, width: "full", rowIndex: 2 },
      { fieldCode: "stock", visible: true, required: true, width: "full", rowIndex: 3, helpText: "実在庫を入力" },
      { fieldCode: "attachment", visible: false, required: false, width: "full", helpText: "任意の添付" },
    ]);
    const fields = await (await page.request.get(`${fixture.base}/fields`)).json() as AppField[];
    expect(fields.map((field) => field.code)).toEqual(["name", "stock", "point", "date", "notes", "attachment"]);
    expect(fields.find((field) => field.code === "stock")?.required).toBe(false);
    await page.reload(); await page.getByRole("button", { name: "詳細設定", exact: true }).click(); await page.getByRole("button", { name: "フォーム配置を編集", exact: true }).click();
    await expect(page.locator('[data-layout-row="1"] [data-layout-slot]')).toHaveCount(1);
    await page.locator(".form-layout-builder").screenshot({ path: "test-results/table-form-layout-desktop.png" });
    await page.goto(`/run/${fixture.app.code}/${fixture.table.code}`);
    await page.getByRole("button", { name: "新規レコード", exact: true }).click();
    const runtimeForm = page.locator("form").filter({ has: page.getByRole("button", { name: "レコードを作成", exact: true }) });
    const runtimeRows = await runtimeForm.evaluate((element) => Array.from(element.querySelectorAll<HTMLElement>("[style*='--form-row']")).map((field) => ({ name: field.querySelector("label")?.textContent?.trim(), row: getComputedStyle(field).gridRowStart })));
    expect(runtimeRows).toEqual([{ name: "品目名", row: "1" }, { name: "備考", row: "1" }, { name: "発注点", row: "2" }, { name: "入荷日", row: "3" }, { name: "在庫数", row: "4" }]);
    await expect(runtimeForm.getByText("実在庫を入力", { exact: true })).toBeVisible();
    await expect(runtimeForm.getByText("添付", { exact: true })).toHaveCount(0);
  } finally { expect((await page.request.delete(`/api/apps/${fixture.app.id}`)).ok()).toBe(true); }
});

test("legacy forms allow real touch movement, visibility and full-width changes on a narrow screen", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const fixture = await setup(page, true);
  try {
    await page.locator(".fl-canvas").scrollIntoViewIfNeeded();
    const source = await page.locator('[data-layout-field="stock"]').boundingBox();
    const target = await page.locator('[data-layout-field="name"]').boundingBox();
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: source!.x + 20, y: source!.y + 20 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target!.x + target!.width * .5, y: target!.y + 10 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
    await expect(page.locator('[data-layout-row="0"]')).toContainText("在庫数");
    await page.getByRole("button", { name: "在庫数を2列にする", exact: true }).click();
    await expect(page.locator('[data-layout-row="0"] [data-layout-slot]')).toHaveCount(1);
    await page.locator('[data-layout-field="stock"]').focus(); await page.keyboard.press("Delete");
    await expect(page.locator('[data-layout-field="stock"]')).toHaveCount(0);
    await page.getByRole("button", { name: "在庫数を配置", exact: true }).press("Enter");
    await expect(page.locator('[data-layout-field="stock"]')).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("追加しました");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.locator(".form-layout-builder").screenshot({ path: "test-results/table-form-layout-mobile.png" });
    const saved = page.waitForResponse((response) => response.url().endsWith(`/forms/${fixture.form.id}`) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "フォームを更新", exact: true }).click(); expect((await saved).ok()).toBe(true);
    await page.reload(); await page.getByRole("button", { name: "詳細設定", exact: true }).click(); await page.getByRole("button", { name: "フォーム配置を編集", exact: true }).click();
    await expect(page.locator('[data-layout-row="1"]')).toContainText("在庫数");
  } finally { await page.request.delete(`/api/apps/${fixture.app.id}`); await context.close(); }
});
