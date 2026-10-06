import { expect, test, type Page } from "@playwright/test";
import { serializeTableDesign, tableDesignDraft, type TableDesignSnapshot } from "../src/lib/table-design";
import type { App } from "../src/types/app";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires an explicitly enabled disposable local test database.");
test.use({ viewport: { width: 1440, height: 1300 }, actionTimeout: 15000 });

async function setup(page: Page, suffix: string) {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  expect((await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } })).ok()).toBe(true);
  const response = await page.request.post("/api/apps", { data: { name: "統合設計テスト", code: `designer-${Date.now()}-${suffix}`, status: "draft" } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<App>;
}

async function drag(page: Page, sourceSelector: string, targetSelector: string, horizontal = .5) {
  await page.locator(sourceSelector).scrollIntoViewIfNeeded();
  const source = await page.locator(sourceSelector).boundingBox();
  const target = await page.locator(targetSelector).boundingBox();
  expect(source).not.toBeNull(); expect(target).not.toBeNull();
  await page.mouse.move(source!.x + 25, source!.y + 24); await page.mouse.down();
  await page.mouse.move(target!.x + target!.width * horizontal, target!.y + target!.height * .5, { steps: 12 });
  await page.mouse.up();
}

test("manual table creation uses a type palette, canvas, property panel, atomic retry and persisted layouts", async ({ page }) => {
  const app = await setup(page, "desktop");
  try {
    await page.goto(`/apps/${app.id}/tables`);
    await expect(page.getByRole("heading", { name: "テーブルを設計", exact: true })).toBeVisible();
    await expect(page.locator("[data-design-type]")).toHaveCount(7);
    await expect(page.getByRole("button", { name: "テーブルを作成", exact: true })).toBeDisabled();
    await page.getByRole("link", { name: "キャンセル", exact: true }).click();
    await expect(page).toHaveURL(/\/home#my-apps$/);
    await expect(page.getByRole("heading", { name: "マイアプリ", exact: true })).toBeVisible();
    await page.goto(`/apps/${app.id}/tables`);
    await expect(page.locator("[data-design-type]")).toHaveCount(7);
    await page.getByLabel("テーブル名", { exact: true }).fill("在庫品");
    await page.getByLabel("テーブルコード", { exact: false }).fill("items");
    await drag(page, '[data-design-type="text"]', "[data-layout-end]");
    const properties = page.getByRole("region", { name: "項目の設定", exact: true });
    await expect(properties.getByLabel("表示名", { exact: true })).toBeFocused();
    await properties.getByLabel("表示名", { exact: true }).fill("品目名");
    await properties.getByLabel("フィールドコード", { exact: false }).fill("item_name");
    await properties.getByRole("checkbox", { name: "必須（テーブル）", exact: true }).check();
    await page.getByRole("button", { name: "数値を追加", exact: true }).click();
    await properties.getByLabel("表示名", { exact: true }).fill("在庫数");
    await properties.getByLabel("フィールドコード", { exact: false }).fill("stock");
    await page.getByRole("button", { name: "数値を追加", exact: true }).press("Enter");
    await properties.getByLabel("表示名", { exact: true }).fill("発注点");
    await properties.getByLabel("フィールドコード", { exact: false }).fill("point");
    const stock = page.locator("[data-layout-field]").filter({ hasText: "在庫数" });
    const point = page.locator("[data-layout-field]").filter({ hasText: "発注点" });
    const pointId = await point.getAttribute("data-layout-field");
    const stockId = await stock.getAttribute("data-layout-field");
    await drag(page, `[data-layout-field="${pointId}"]`, `[data-layout-field="${stockId}"]`, .95);
    await expect(page.locator('[data-layout-row="1"] [data-layout-field]')).toHaveCount(2);
    await page.getByRole("button", { name: "選択式を追加", exact: true }).click();
    await properties.getByLabel("表示名", { exact: true }).fill("保管場所");
    await properties.getByLabel("フィールドコード", { exact: false }).fill("location");
    await properties.getByRole("button", { name: "選択肢「選択肢A」を削除", exact: true }).click();
    await properties.getByRole("button", { name: "選択肢「選択肢B」を削除", exact: true }).click();
    await properties.getByLabel("選択肢", { exact: true }).fill("倉庫A、倉庫B");
    await expect(page.locator(".td-choices > span")).toHaveCount(2);
    await page.getByRole("button", { name: "長文を追加", exact: true }).click();
    await properties.getByLabel("表示名", { exact: true }).fill("備考");
    await properties.getByLabel("フィールドコード", { exact: false }).fill("notes");
    await properties.getByLabel("入力時の補足", { exact: true }).fill("任意のメモ");
    await properties.getByRole("button", { name: "複製", exact: true }).click();
    await expect(page.locator("[data-layout-field]")).toHaveCount(6);
    await properties.getByRole("button", { name: "削除", exact: true }).click();
    await expect(page.locator("[data-layout-field]")).toHaveCount(5);
    await page.getByRole("button", { name: "表", exact: true }).click();
    await expect(page.getByRole("table")).toContainText("item_name");
    await page.getByRole("button", { name: "フォーム", exact: true }).click();
    const endpoint = `/api/apps/${app.id}/designer`;
    await page.route(`**${endpoint}`, async (route) => {
      if (route.request().method() === "PUT") await route.fulfill({ status: 503, json: { message: "一時的に保存できません" } });
      else await route.continue();
    });
    await page.getByRole("button", { name: "テーブルを作成", exact: true }).click();
    await expect(page.locator(".td-error")).toContainText("一時的に保存できません");
    await expect(page.locator("[data-layout-field]")).toHaveCount(5);
    const empty = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    expect(empty.tables).toHaveLength(0);
    await page.unroute(`**${endpoint}`);
    const saved = page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "テーブルを作成", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    const snapshot = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    expect(snapshot.app.status).toBe("draft"); expect(snapshot.tables).toHaveLength(1); expect(snapshot.fields).toHaveLength(5); expect(snapshot.forms).toHaveLength(1); expect(snapshot.views).toHaveLength(1);
    expect(snapshot.forms[0].layoutJson.fields).toContainEqual({ fieldCode: "stock", visible: true, required: false, width: "half", rowIndex: 1 });
    expect(snapshot.forms[0].layoutJson.fields).toContainEqual({ fieldCode: "point", visible: true, required: false, width: "half", rowIndex: 1 });
    expect(snapshot.fields.find((field) => field.code === "location")?.settingsJson?.options).toEqual(["倉庫A", "倉庫B"]);
    await page.reload(); await expect(page.locator("[data-layout-field]")).toHaveCount(5);
    await expect(properties.getByLabel("フィールドコード", { exact: false })).toBeDisabled();
    await page.screenshot({ path: "test-results/table-design-desktop.png", fullPage: true });
    const display = await (await page.request.get("/api/settings/display")).json() as { preference: string };
    for (const preference of ["navy", "white", "dark"]) {
      expect((await page.request.patch("/api/settings/display", { data: { preference } })).ok()).toBe(true);
      await page.reload(); await expect(page.locator("[data-layout-field]")).toHaveCount(5);
      await expect(page.locator("html")).toHaveAttribute("data-theme", preference);
      await page.screenshot({ path: `test-results/table-design-${preference}.png`, fullPage: true });
    }
    expect((await page.request.patch("/api/settings/display", { data: { preference: display.preference } })).ok()).toBe(true);
    for (const width of [1280, 1024, 768, 639, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      const footer = await page.locator(".td-footer").boundingBox();
      const saveButton = await page.getByRole("button", { name: "設計を保存", exact: true }).boundingBox();
      expect(saveButton!.x).toBeGreaterThanOrEqual(footer!.x);
      expect(saveButton!.x + saveButton!.width).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1440, height: 1300 });
    const recordResponse = await page.request.post(`/api/run/${app.code}/items`, { data: { data: { item_name: "サンプル", stock: 120, point: 30, location: "倉庫A", notes: "維持するデータ" } } });
    expect(recordResponse.ok(), await recordResponse.text()).toBe(true);
    const record = await recordResponse.json() as { id: string };
    await page.locator("[data-layout-field]").filter({ hasText: "備考" }).press("Enter");
    await properties.getByRole("button", { name: "非表示", exact: true }).click();
    await expect(page.locator("[data-layout-field]")).toHaveCount(4);
    const updated = page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "設計を保存", exact: true }).click(); expect((await updated).ok()).toBe(true);
    const after = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    expect(after.fields.map((field) => field.code)).toEqual(snapshot.fields.map((field) => field.code));
    expect(after.forms[0].layoutJson.fields).toContainEqual({ fieldCode: "notes", visible: false, required: false, width: "full", helpText: "任意のメモ" });
    const preserved = await (await page.request.get(`/api/run/${app.code}/items/${record.id}`)).json() as { data: Record<string, unknown> };
    expect(preserved.data.notes).toBe("維持するデータ");
    await page.goto(`/run/${app.code}/items`); await expect(page.getByText("サンプル", { exact: true })).toBeVisible();
  } finally { expect((await page.request.delete(`/api/apps/${app.id}`)).ok()).toBe(true); }
});

test("table designer rolls back partial creation, rejects conflicts and preserves extended field settings", async ({ page }) => {
  const app = await setup(page, "atomic");
  try {
    const endpoint = `/api/apps/${app.id}/designer`;
    const empty = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    const input = { revision: empty.revision, appName: app.name, table: { name: "在庫品", code: "items" }, fields: [{ name: "品目名", code: "name", fieldType: "text", required: false }], form: { name: "入力", layoutJson: { fields: [{ fieldCode: "unknown", width: "full" }] } } };
    expect((await page.request.put(endpoint, { data: input })).status()).toBe(400);
    const rolledBack = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    expect(rolledBack.tables).toHaveLength(0); expect(rolledBack.fields).toHaveLength(0); expect(rolledBack.revision).toBe(empty.revision);
    input.form.layoutJson.fields[0].fieldCode = "name";
    expect((await page.request.put(endpoint, { data: input })).ok()).toBe(true);
    expect((await page.request.put(endpoint, { data: input })).status()).toBe(409);
    const created = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    const base = `/api/apps/${app.id}/tables/${created.tables[0].id}`;
    expect((await page.request.post(`${base}/fields`, { data: { name: "添付", code: "attachment", fieldType: "file", uniqueFlag: true, defaultValue: [], settingsJson: { allowedTypes: ["image/png"], custom: "retain" } } })).ok()).toBe(true);
    const withFile = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    const edit = serializeTableDesign(tableDesignDraft(withFile), withFile.revision);
    edit.fields[0].name = "品目";
    expect((await page.request.put(endpoint, { data: edit })).ok()).toBe(true);
    const saved = await (await page.request.get(endpoint)).json() as TableDesignSnapshot;
    expect(saved.fields.find((field) => field.code === "attachment")).toMatchObject({ fieldType: "file", uniqueFlag: true, defaultValue: [], settingsJson: { allowedTypes: ["image/png"], custom: "retain" } });
    const invalid = serializeTableDesign(tableDesignDraft(saved), saved.revision); invalid.fields[0].fieldType = "number";
    expect((await page.request.put(endpoint, { data: invalid })).status()).toBe(400);
  } finally { expect((await page.request.delete(`/api/apps/${app.id}`)).ok()).toBe(true); }
});

test("narrow table design supports drawer editing and touch creation", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 1500 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const app = await setup(page, "touch");
  try {
    await page.goto(`/apps/${app.id}/tables`);
    await expect(page.locator("[data-design-type]")).toHaveCount(7);
    await page.locator('[data-design-type="text"]').scrollIntoViewIfNeeded();
    const source = await page.locator('[data-design-type="text"]').boundingBox();
    const target = await page.locator("[data-layout-end]").boundingBox();
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: source!.x + 20, y: source!.y + 20 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target!.x + target!.width * .5, y: target!.y + target!.height * .5 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await session.detach();
    const dialog = page.getByRole("dialog", { name: "項目の設定", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("表示名", { exact: true }).fill("名前");
    await dialog.getByLabel("フィールドコード", { exact: false }).fill("name");
    await dialog.getByRole("button", { name: "2列（半分）", exact: true }).click();
    await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-layout-slot]")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.screenshot({ path: "test-results/table-design-mobile.png", fullPage: true });
    const saved = page.waitForResponse((response) => response.url().endsWith(`/apps/${app.id}/designer`) && response.request().method() === "PUT");
    await page.getByRole("button", { name: "テーブルを作成", exact: true }).click(); expect((await saved).ok()).toBe(true);
    await page.reload(); await expect(page.locator("[data-layout-slot]")).toHaveCount(1);
    await page.getByRole("button", { name: "項目の設定", exact: true }).click();
    await expect(dialog.getByLabel("表示名", { exact: true })).toHaveValue("名前");
    await expect(dialog.getByLabel("フィールドコード", { exact: false })).toBeDisabled();
    await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  } finally { expect((await page.request.delete(`/api/apps/${app.id}`)).ok()).toBe(true); await context.close(); }
});
