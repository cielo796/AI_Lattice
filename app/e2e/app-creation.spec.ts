import { expect, test, type Page } from "@playwright/test";
import { buildInitialViewsForTable } from "../src/lib/blueprint-views";
import type { GeneratedAppBlueprint } from "../src/types/ai";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires an explicitly enabled disposable local test database.");
test.use({ viewport: { width: 1440, height: 1100 } });
test.use({ actionTimeout: 15000 });

function fixture(): GeneratedAppBlueprint {
  return { name: "在庫管理", code: `creation-${Date.now()}`, description: "倉庫の在庫を管理", aiInsight: "在庫数と発注点を並べます。", tables: [{ name: "在庫品", code: "items", fields: [
    { name: "品目名", code: "item_name", fieldType: "text", required: true, reason: "品目を一覧で探すためです。" },
    { name: "在庫数", code: "stock", fieldType: "number", required: false, reason: "数量を集計します。" },
    { name: "発注点", code: "point", fieldType: "number", required: false },
    { name: "保管場所", code: "location", fieldType: "select", required: false, options: ["倉庫A", "倉庫B"] },
    { name: "入荷日", code: "received", fieldType: "date", required: false },
  ] }], layout: [{ cols: 1, items: ["item_name"] }, { cols: 2, items: ["stock", "point"] }, { cols: 2, items: ["location", "received"] }], suggestions: [{ name: "単価", code: "unit_price", fieldType: "number", reason: "在庫金額の集計に使います。" }] };
}

async function prepare(page: Page, blueprint = fixture()) {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  expect((await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } })).ok()).toBe(true);
  expect((await page.request.patch("/api/settings/display", { data: { preference: "navy" } })).ok()).toBe(true);
  let calls = 0;
  await page.route("**/api/apps/generate", async (route) => {
    if (route.request().method() === "GET") { await route.continue(); return; }
    calls++;
    const input = route.request().postDataJSON() as { blueprint?: GeneratedAppBlueprint };
    if (input.blueprint) {
      const adjusted = structuredClone(input.blueprint);
      adjusted.tables[0].fields[0].required = !adjusted.tables[0].fields[0].required;
      await route.fulfill({ json: adjusted });
    } else await route.fulfill({ json: blueprint });
  });
  await page.goto("/apps/new/ai");
  await expect(page.getByRole("heading", { name: "どんなアプリを作りますか？" })).toBeVisible();
  return { blueprint, count: () => calls };
}

async function generate(page: Page) {
  await page.getByLabel("作りたいアプリの説明").fill("倉庫の在庫を管理したい");
  await page.getByRole("button", { name: "設計案を生成", exact: true }).click();
  await expect(page.getByRole("heading", { name: "設計案を確認してください" })).toBeVisible();
}

async function dragTo(page: Page, sourceSelector: string, targetSelector: string, horizontal = 0.5, vertical = 0.5) {
  await page.locator(sourceSelector).scrollIntoViewIfNeeded();
  const source = await page.locator(sourceSelector).boundingBox();
  const target = await page.locator(targetSelector).boundingBox();
  expect(source).not.toBeNull(); expect(target).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width * horizontal, target!.y + target!.height * vertical, { steps: 12 });
  await page.mouse.up();
}

async function checkContrast(page: Page) {
  const ratios = await page.locator(".app-creation").evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (token: string) => {
      const hex = style.getPropertyValue(token).trim();
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (foreground: string, background: string) => {
      const light = luminance(foreground), dark = luminance(background);
      return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
    };
    return {
      text: ["--surface-page", "--surface-card", "--surface-sunken"].flatMap((surface) => ["--ink", "--ink-muted", "--ink-subtle"].map((ink) => ratio(ink, surface))),
      controls: ["--surface-page", "--surface-card", "--surface-sunken"].map((surface) => ratio("--border-control", surface)),
      primary: ratio("--on-brand", "--brand-strong"),
      state: [["--brand-ink", "--brand-tint"], ["--danger", "--danger-tint"], ["--success", "--success-tint"], ["--warning", "--warning-tint"]].map(([ink, surface]) => ratio(ink, surface)),
    };
  });
  for (const ratio of [...ratios.text, ratios.primary, ...ratios.state]) expect(ratio).toBeGreaterThanOrEqual(4.5);
  for (const ratio of ratios.controls) expect(ratio).toBeGreaterThanOrEqual(3);
}

test("examples only insert, model is server resolved, 1000-character limit, keyboard generation and abort", async ({ page }) => {
  const prepared = await prepare(page);
  await expect(page.getByRole("button", { name: "設計案を生成", exact: true })).toBeDisabled();
  await expect(page.locator(".ac-model")).toContainText("管理画面の既定モデル");
  const info = await (await page.request.get("/api/apps/generate")).json() as { model: string };
  await expect(page.locator(".ac-model")).toContainText(info.model);
  await page.screenshot({ path: "test-results/creation-describe-light.png", fullPage: true });
  await page.getByRole("button", { name: /^在庫管理/ }).click();
  expect(prepared.count()).toBe(0);
  await expect(page.getByLabel("作りたいアプリの説明")).toHaveValue(/倉庫の在庫/);
  await page.getByRole("button", { name: /^問い合わせ管理/ }).click();
  await expect(page.getByRole("dialog", { name: "説明を置き換えますか？" })).toBeVisible();
  await page.getByRole("button", { name: "置き換える", exact: true }).click();
  expect(prepared.count()).toBe(0);
  await page.getByLabel("作りたいアプリの説明").fill("x".repeat(1100));
  await expect(page.getByLabel("作りたいアプリの説明")).toHaveValue("x".repeat(1000));
  await page.getByLabel("作りたいアプリの説明").press("Control+Enter");
  await expect(page.getByRole("heading", { name: "設計案を確認してください" })).toBeVisible();
  expect(prepared.count()).toBe(1);
  await page.getByRole("button", { name: "説明を直す" }).click();
  await page.route("**/api/apps/generate", async (route) => { if (route.request().method() === "GET") await route.continue(); else { await new Promise((resolve) => setTimeout(resolve, 1600)); await route.fulfill({ json: prepared.blueprint }).catch(() => undefined); } });
  await page.getByRole("button", { name: "設計案を生成", exact: true }).click();
  await expect(page.getByRole("button", { name: "生成をやめる" })).toBeVisible();
  await page.getByRole("button", { name: "生成をやめる" }).click();
  await page.waitForTimeout(1800);
  await expect(page.getByLabel("作りたいアプリの説明")).toBeVisible();
  await expect(page.getByRole("heading", { name: "設計案を確認してください" })).toHaveCount(0);
});

test("pointer placement, empty slots, keyboard, table, tags, differences and real atomic draft save", async ({ page }) => {
  await prepare(page); await generate(page);
  await page.screenshot({ path: "test-results/creation-review-light.png", fullPage: true });
  await dragTo(page, '[aria-label="長文を追加"]', '[data-form-row="0"]', 0.5, 0.15);
  await expect(page.locator(".ac-count")).toHaveText("6 / 10");
  await expect(page.getByLabel("表示名", { exact: true })).toBeFocused();
  await page.getByLabel("表示名", { exact: true }).fill("備考");
  await dragTo(page, '[aria-label="テキストを追加"]', '[data-form-row="1"] .ac-field-card', 0.98, 0.5);
  await expect(page.locator('[data-form-row="1"] .ac-field-card')).toHaveCount(2);
  await expect(page.locator(".ac-count")).toHaveText("7 / 10");
  await dragTo(page, '[data-form-row="1"] .ac-field-card:last-child', '[data-endzone]');
  await expect(page.locator('[data-form-row="1"] [data-empty-slot]')).toBeVisible();
  await dragTo(page, '[aria-label="真偽値を追加"]', '[data-form-row="1"] [data-empty-slot]');
  await expect(page.locator('[data-form-row="1"] .ac-field-card')).toHaveCount(2);
  await page.locator('[data-form-row="0"] .ac-field-card').focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.locator('.ac-sr-only')).toContainText("移動しました");
  await page.getByRole("group", { name: "表示切替" }).getByRole("button", { name: "表", exact: true }).click();
  await dragTo(page, '[aria-label="備考を並べ替え"]', '.ac-fields-table tbody tr:first-child', 0.5, 0.1);
  await page.getByLabel("保管場所の表示名").fill("倉庫");
  await page.getByRole("group", { name: "表示切替" }).getByRole("button", { name: "フォーム", exact: true }).click();
  const choice = page.getByRole("listitem", { name: /^倉庫、/ });
  await choice.click();
  await page.getByPlaceholder("入力してEnterで追加").fill("倉庫C、倉庫D,");
  await expect(page.getByRole("button", { name: "選択肢「倉庫C」を削除" })).toBeVisible();
  await page.getByPlaceholder("入力してEnterで追加").fill("倉庫A");
  await page.getByPlaceholder("入力してEnterで追加").press("Enter");
  await expect(page.getByRole("status")).toContainText("すでにあります");
  await page.getByLabel("フィールドコード", { exact: false }).fill("1-invalid");
  await expect(page.getByRole("button", { name: "下書きとして作成", exact: true })).toBeDisabled();
  await page.getByLabel("フィールドコード", { exact: false }).fill("location");
  await page.getByLabel("AIで調整", { exact: true }).fill("先頭項目の必須を切り替える");
  await page.getByRole("button", { name: "差分を確認", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "AIによる調整の差分" })).toContainText("変更");
  await page.getByRole("button", { name: "破棄", exact: true }).click();
  await page.getByRole("button", { name: "差分を確認", exact: true }).click();
  await page.getByRole("button", { name: "適用する", exact: true }).click();
  await expect(page.locator(".ac-field-card.is-changed")).toHaveCount(1);
  let saved: GeneratedAppBlueprint | undefined;
  page.on("request", (request) => { if (request.url().endsWith("/api/apps/blueprints")) saved = request.postDataJSON() as GeneratedAppBlueprint; });
  const response = page.waitForResponse((item) => item.url().endsWith("/api/apps/blueprints") && item.request().method() === "POST", { timeout: 15000 });
  await page.getByRole("button", { name: "下書きとして作成", exact: true }).click();
  const savedResponse = await response;
  expect(savedResponse.status(), await savedResponse.text()).toBe(201);
  const app = await savedResponse.json() as { id: string; status: string; code: string };
  try {
    await expect(page).toHaveURL(new RegExp(`/apps/${app.id}/tables\\?created=1`));
    expect(app.status).toBe("draft");
    const tables = await (await page.request.get(`/api/apps/${app.id}/tables`)).json() as Array<{ id: string; code: string }>;
    const base = `/api/apps/${app.id}/tables/${tables[0].id}`;
    const fields = await (await page.request.get(`${base}/fields`)).json() as Array<{ code: string }>;
    expect(fields.map((field) => field.code)).toEqual(saved!.layout!.flatMap((row) => row.items));
    expect(saved!.tables[0].fields.find((field) => field.code === "location")?.options).toBe("倉庫A,倉庫B,倉庫C,倉庫D");
    const forms = await (await page.request.get(`${base}/forms`)).json() as Array<{ layoutJson: { fields: Array<{ fieldCode: string; width: string; rowIndex: number }> } }>;
    expect(forms[0].layoutJson.fields.map((field) => field.width)).toEqual(saved!.layout!.flatMap((row) => row.items.map(() => row.cols === 1 ? "full" : "half")));
    const views = await (await page.request.get(`${base}/views`)).json() as Array<{ viewType: string }>;
    expect(views.map((view) => view.viewType)).toEqual(buildInitialViewsForTable(saved!.tables[0]).map((view) => view.viewType));
    const records = await (await page.request.get(`/api/run/${app.code}/${tables[0].code}`)).json() as unknown[];
    expect(records).toHaveLength(3);
  } finally { await page.request.delete(`/api/apps/${app.id}`); }
});

test("limits, keyboard cancellation, regeneration confirmation, dark contrast and mobile drawer", async ({ page }) => {
  await prepare(page); await generate(page);
  await checkContrast(page);
  const palette = await page.getByRole("button", { name: "数値を追加", exact: true }).boundingBox();
  const card = await page.locator('[data-form-row="0"]').boundingBox();
  await page.mouse.move(palette!.x + 30, palette!.y + 20); await page.mouse.down();
  await page.mouse.move(card!.x + 20, card!.y + 20, { steps: 8 });
  await page.keyboard.press("Escape"); await page.mouse.up();
  await expect(page.locator(".ac-count")).toHaveText("5 / 10");
  await expect(page.locator(".ac-sr-only")).toContainText("取り消しました");
  for (let index = 0; index < 5; index++) await page.getByRole("button", { name: "テキストを追加", exact: true }).press("Enter");
  await expect(page.locator(".ac-count")).toHaveText("10 / 10");
  await page.getByRole("button", { name: "数値を追加", exact: true }).press("Space");
  await expect(page.getByRole("status")).toContainText("フィールドは10個までです");
  await expect(page.getByRole("button", { name: "数値を追加", exact: true })).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("表示名", { exact: true }).fill("手で追加した項目");
  await page.getByRole("button", { name: "AIで再生成", exact: false }).click();
  await page.getByRole("button", { name: "編集を残して再生成", exact: true }).click();
  await expect(page.locator(".ac-count")).toHaveText("10 / 10");
  await expect(page.getByRole("listitem", { name: /^手で追加した項目、/ })).toBeVisible();
  await page.getByRole("button", { name: "AIで再生成", exact: false }).click();
  await expect(page.getByRole("dialog", { name: "編集内容を残して再生成しますか？" })).toBeVisible();
  await page.getByRole("button", { name: "全体を作り直す", exact: true }).click();
  await expect(page.locator(".ac-count")).toHaveText("5 / 10");
  expect((await page.request.patch("/api/settings/display", { data: { preference: "dark" } })).ok()).toBe(true);
  await page.reload();
  await generate(page);
  await expect(page.locator(".app-creation")).toHaveCSS("background-color", "rgb(17, 21, 27)");
  await checkContrast(page);
  await page.screenshot({ path: "test-results/creation-review-dark.png", fullPage: true });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole("listitem", { name: /^品目名、/ }).click();
  await expect(page.getByRole("dialog", { name: "項目の設定と作成内容" })).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-guide="page-content"]')).toHaveCSS("margin-left", "0px");
  await expect(page.locator('.ac-form-row.cols-2').first()).toHaveCSS("grid-template-columns", /\d+px$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/creation-mobile.png", fullPage: true });
});

test("legacy layout fallback, last-field guard and actual touch pointer placement", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1024, height: 1400 }, hasTouch: true });
  const page = await context.newPage();
  try {
    const blueprint = fixture(); delete blueprint.layout; delete blueprint.suggestions;
    await prepare(page, blueprint); await generate(page);
    await expect(page.locator(".ac-form-row.cols-1")).toHaveCount(5);
    const source = await page.getByRole("button", { name: "日時を追加", exact: true }).boundingBox();
    const target = await page.locator('[data-form-row="0"]').boundingBox();
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: source!.x + 30, y: source!.y + 20 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target!.x + target!.width / 2, y: target!.y + 10 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(".ac-count")).toHaveText("6 / 10");
    await expect(page.getByRole("dialog", { name: "項目の設定と作成内容" })).toBeVisible();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    for (let remaining = 6; remaining > 1; remaining--) { await page.locator(".ac-field-card").last().focus(); await page.keyboard.press("Delete"); }
    await expect(page.locator(".ac-count")).toHaveText("1 / 10");
    await page.locator(".ac-field-card").focus(); await page.keyboard.press("Delete");
    await expect(page.locator(".ac-count")).toHaveText("1 / 10");
    await expect(page.getByRole("status")).toContainText("最後の1項目");
  } finally { await context.close(); }
});
