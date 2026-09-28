import { expect, test, type APIRequestContext } from "@playwright/test";

test.skip(process.env.PLAYWRIGHT_SETUP_TEST !== "true", "Requires a fresh database and DEMO_AUTO_SEED=false.");

async function login(request: APIRequestContext, email: string, password: string) {
  const response = await request.post("/api/auth/login", { data: { email, password, tenantCode: "onboarding-test" } });
  expect(response.status(), await response.text()).toBe(200);
}

test("onboards a real workspace, manages a user, and revokes changed credentials", async ({ page, playwright, baseURL }) => {
  const setupToken = process.env.SETUP_TOKEN;
  expect(setupToken?.length).toBeGreaterThanOrEqual(32);
  const adminEmail = "admin@onboarding.example";
  const adminPassword = "initial-admin-password-2026";
  const memberEmail = "member@onboarding.example";
  const memberPassword = "initial-member-password-2026";
  const newPassword = "changed-member-password-2026";

  await page.goto("/login");
  await expect(page.getByText("デモアカウント:", { exact: false })).toHaveCount(0);
  await page.getByRole("link", { name: /組織と管理者を登録/ }).click();
  await expect(page.getByRole("heading", { name: "組織の初期設定" })).toBeVisible();
  await page.getByLabel("初期設定トークン", { exact: true }).fill("incorrect-token-with-more-than-32-characters");
  await page.getByLabel("組織名", { exact: true }).fill("導入テスト組織");
  await page.getByLabel("組織コード", { exact: true }).fill("onboarding-test");
  await page.getByLabel("管理者の表示名").fill("導入テスト管理者");
  await page.getByLabel("管理者のメールアドレス").fill(adminEmail);
  await page.getByLabel("パスワード（12文字以上）", { exact: true }).fill(adminPassword);
  await page.getByLabel("パスワードの確認", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "組織と管理者を作成", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "トークンが正しくありません" })).toBeVisible();
  await page.getByLabel("初期設定トークン", { exact: true }).fill(setupToken!);
  await page.getByRole("button", { name: "組織と管理者を作成", exact: true }).click();
  await expect(page.getByRole("heading", { name: "組織を作成しました" })).toBeVisible();

  const repeated = await page.request.post("/api/setup", {
    data: { setupToken, organizationName: "Another", organizationCode: "another", name: "Another Admin", email: "other@example.com", password: adminPassword },
  });
  expect(repeated.status()).toBe(409);

  await page.getByRole("link", { name: "ログインへ進む" }).click();
  await page.getByLabel("メールアドレス", { exact: true }).fill(adminEmail);
  await page.getByLabel("パスワード", { exact: true }).fill(adminPassword);
  await page.getByRole("button", { name: "サインイン" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "ユーザーを追加", exact: true }).click();
  await page.getByLabel("表示名", { exact: true }).fill("テスト閲覧者");
  await page.getByLabel("メールアドレス", { exact: true }).fill(memberEmail);
  await page.getByLabel("初期パスワード（12文字以上）").fill(memberPassword);
  await expect(page.getByLabel("ロール（組織全体に適用）")).not.toHaveValue("");
  await page.getByRole("button", { name: "ユーザーを作成", exact: true }).click();
  await expect(page.getByText(memberEmail, { exact: true })).toBeVisible();

  const secondSession = await playwright.request.newContext({ baseURL });
  const memberBrowser = await page.context().browser()!.newContext({ baseURL });
  try {
    await login(secondSession, memberEmail, memberPassword);
    await login(memberBrowser.request, memberEmail, memberPassword);
    const forbidden = await secondSession.post("/api/admin/users", {
      data: { name: "Unauthorized", email: "unauthorized@example.com", password: memberPassword, roleId: "unknown" },
    });
    expect(forbidden.status()).toBe(403);

    const memberPage = await memberBrowser.newPage();
    await memberPage.goto("/settings/profile");
    await memberPage.getByLabel("現在のパスワード").fill(memberPassword);
    await memberPage.getByLabel("新しいパスワード（12文字以上）", { exact: true }).fill(newPassword);
    await memberPage.getByLabel("新しいパスワードの確認").fill(newPassword);
    await memberPage.getByRole("button", { name: "パスワードを変更してログアウト" }).click();
    await expect(memberPage).toHaveURL(/\/login$/);
    expect((await secondSession.get("/api/auth/me")).status()).toBe(401);
    expect((await secondSession.post("/api/auth/login", { data: { email: memberEmail, password: memberPassword } })).status()).toBe(401);
    await login(secondSession, memberEmail, newPassword);

    const usersResponse = await page.request.get("/api/admin/users");
    const users = await usersResponse.json() as Array<{ id: string; email: string }>;
    const member = users.find((user) => user.email === memberEmail)!;
    const disabled = await page.request.patch(`/api/admin/users/${member.id}`, { data: { status: "inactive" } });
    expect(disabled.status()).toBe(200);
    expect((await secondSession.get("/api/auth/me")).status()).toBe(401);
    expect((await secondSession.post("/api/auth/login", { data: { email: memberEmail, password: newPassword } })).status()).toBe(401);
  } finally {
    await secondSession.dispose();
    await memberBrowser.close();
  }

  const invalidSession = await page.context().browser()!.newContext({ baseURL });
  try {
    await invalidSession.addCookies([{ name: "stitch_session", value: "revoked-token", url: baseURL! }]);
    const invalidPage = await invalidSession.newPage();
    await invalidPage.goto("/home");
    await expect(invalidPage).toHaveURL(/\/login$/);
    await expect(invalidPage.getByRole("button", { name: "サインイン" })).toBeVisible();
  } finally {
    await invalidSession.close();
  }
});
