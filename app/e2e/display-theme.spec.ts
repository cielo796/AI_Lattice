import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires a disposable local test database.");
test.use({ viewport: { width: 1440, height: 1000 } });

async function login(request: APIRequestContext, email = "marcus.chen@acme.com") {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  expect((await request.post("/api/auth/login", { data: { email, password: "demo" } })).ok()).toBe(true);
}
async function reset(page: Page) {
  await page.request.patch("/api/settings/display", { data: { defaultTheme: "navy", allowUserTheme: true } });
  await page.request.patch("/api/settings/display", { data: { preference: null } });
}

test("three global themes, account persistence, server HTML and OS preference", async ({ page, browser }) => {
  await login(page.request);
  await reset(page);
  try {
    await page.goto("/settings/display");
    for (const theme of ["dark", "white", "navy"]) {
      await page.locator(`input[name="display-theme"][value="${theme}"]`).check();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("status")).toContainText("表示設定を保存しました");
      const settings = await (await page.request.get("/api/settings/display")).json();
      expect(settings.preference).toBe(theme);
      await page.goto("/home");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const expectedSidebar = theme === "dark" ? "rgb(21, 26, 33)" : theme === "white" ? "rgb(255, 255, 255)" : "rgb(20, 40, 74)";
      await expect(page.locator('aside[data-guide="app-sidebar"]')).toHaveCSS("background-color", expectedSidebar);
      await page.goto("/apps/new/ai");
      await expect(page.locator(".app-creation")).toHaveCSS("background-color", theme === "dark" ? "rgb(17, 21, 27)" : "rgb(244, 246, 248)");
      await page.goto("/settings/display");
    }
    await page.locator('input[name="display-theme"][value="dark"]').check();
    await expect(page.getByRole("status")).toContainText("表示設定を保存しました");
    const otherDevice = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
    try {
      await login(otherDevice.request);
      const response = await otherDevice.request.get("/home");
      expect(await response.text()).toMatch(/<html[^>]+data-theme="dark"/);
      const otherPage = await otherDevice.newPage();
      await otherPage.goto("/home");
      await expect(otherPage.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(otherPage.locator("body")).toHaveCSS("background-color", "rgb(17, 21, 27)");
      await otherPage.goto("/settings/display");
      await expect(otherPage.locator('input[name="display-theme"][value="white"]')).toBeDisabled();
      await otherPage.goto("/apps/new/ai");
      await expect(otherPage.getByLabel("作りたいアプリの説明")).toBeDisabled();
      await expect(otherPage.getByRole("button", { name: /^在庫管理/ })).toBeDisabled();
      await otherPage.goto("/apps/new/manual");
      await expect(otherPage.getByLabel("アプリ名", { exact: true })).toBeDisabled();
      await expect(otherPage.getByLabel("アプリコード", { exact: false })).toBeDisabled();
    } finally { await otherDevice.close(); }
    await page.locator('input[name="display-theme"][value="system"]').check();
    await expect(page.getByRole("status")).toContainText("表示設定を保存しました");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "navy");
    await page.request.patch("/api/settings/display", { data: { defaultTheme: "white" } });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "white");
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally { await reset(page); }
});

test("tenant locking hides personal choices, rejects writes and preserves account preference", async ({ page, browser }) => {
  await login(page.request);
  await reset(page);
  const member = await browser.newContext();
  try {
    await login(member.request, "alex.rivera@acme.com");
    expect((await member.request.patch("/api/settings/display", { data: { defaultTheme: "white" } })).status()).toBe(403);
    expect((await member.request.patch("/api/settings/display", { data: { preference: "dark" } })).ok()).toBe(true);
    await page.goto("/settings/display");
    await page.locator('input[name="tenant-theme"]').nth(1).check();
    await expect(page.getByRole("status")).toContainText("表示設定を保存しました");
    await page.getByRole("switch", { name: "ユーザーが表示を変更できる" }).uncheck();
    await expect(page.locator('input[name="display-theme"]')).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "white");
    const memberPage = await member.newPage();
    await memberPage.goto("/settings/display");
    await expect(memberPage.locator("html")).toHaveAttribute("data-theme", "white");
    await expect(memberPage.locator('input[name="display-theme"]')).toHaveCount(0);
    await expect(memberPage.getByText("管理者によりホワイトに固定されています。")).toBeVisible();
    expect((await member.request.patch("/api/settings/display", { data: { preference: "navy" } })).status()).toBe(403);
    expect((await page.request.patch("/api/settings/display", { data: { defaultTheme: "dark" } })).status()).toBe(400);
    await page.getByRole("switch", { name: "ユーザーが表示を変更できる" }).check();
    await expect(page.getByRole("status")).toContainText("表示設定を保存しました");
    await memberPage.reload();
    await expect(memberPage.locator("html")).toHaveAttribute("data-theme", "dark");
  } finally {
    await reset(page);
    await member.request.patch("/api/settings/display", { data: { preference: null } });
    await member.close();
  }
});

test("home defaults to table, monochrome app tiles, overflow actions, search and empty-app creation", async ({ page }) => {
  await login(page.request);
  await reset(page);
  let createdId: string | undefined;
  try {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "マイアプリ一覧" })).toBeVisible();
    await expect(page.getByRole("button", { name: "表", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "業務の状況" })).toHaveCount(1);
    await expect(page.locator('[data-guide="home-stats"]')).toHaveCount(1);
    const firstRow = page.locator('tbody tr[data-testid^="app-card-"]').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.getByRole("button", { name: "削除", exact: true })).not.toBeVisible();
    await firstRow.getByRole("button", { name: /その他の操作/ }).click();
    await expect(page.getByRole("button", { name: "削除", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "削除", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "カード", exact: true }).click();
    await expect(page.getByRole("table", { name: "マイアプリ一覧" })).toHaveCount(0);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "アプリを検索", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "アプリ名・コード・説明で検索" }).fill("unlikely-missing-app-design-audit");
    await expect(page.getByText("該当するアプリはありません。")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "空のアプリ", exact: true }).click();
    await page.getByLabel("アプリ名", { exact: true }).fill("Design audit empty app");
    await page.getByLabel("アプリコード", { exact: false }).fill(`design-empty-${Date.now()}`);
    const response = page.waitForResponse((item) => item.url().endsWith("/api/apps") && item.request().method() === "POST");
    await page.getByRole("button", { name: "下書きとして作成", exact: true }).click();
    const saved = await response;
    expect(saved.status()).toBe(201);
    const app = await saved.json();
    createdId = app.id;
    expect(app.status).toBe("draft");
    await expect(page).toHaveURL(new RegExp(`/apps/${createdId}/tables$`));
    await page.goto("/home");
    const createdRow = page.getByTestId(`app-card-${createdId}`);
    await expect(createdRow).toContainText("下書き");
    await expect(createdRow).toContainText("未作成");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "表", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const tableScroll = page.locator('[data-guide="home-app-grid"]');
    expect(await tableScroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await page.getByRole("button", { name: "ナビゲーションを開く" }).click();
    await expect(page.getByRole("link", { name: "表示設定", exact: true }).last()).toBeVisible();
  } finally {
    if (createdId) expect((await page.request.delete(`/api/apps/${createdId}`)).ok()).toBe(true);
    await reset(page);
  }
});
