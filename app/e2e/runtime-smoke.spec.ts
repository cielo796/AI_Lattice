import { expect, test, type APIResponse, type Page } from "@playwright/test";

interface AppSummary {
  id: string;
  name: string;
  code: string;
}

interface AppTable {
  id: string;
  name: string;
  code: string;
}

interface AppRecord {
  id: string;
  data: Record<string, unknown>;
}

const mojibakePattern =
  /[\uFFFD\uF8FF\u7E67\u7E5D\u7E3A\u8373\u8C7A]|[\uFF66-\uFF9F]{3,}/u;

async function expectJson<T>(response: APIResponse) {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return body ? (JSON.parse(body) as T) : (null as T);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /サインイン/ }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("heading", { name: /おかえりなさい/ })
  ).toBeVisible();
}

async function expectNoMojibake(page: Page) {
  await expect.poll(async () => page.locator("body").innerText()).not.toMatch(
    mojibakePattern
  );
}

async function createRuntimeApp(page: Page, suffix: string) {
  const app = await expectJson<AppSummary>(
    await page.request.post("/api/apps", {
      data: {
        name: `E2E Runtime ${suffix}`,
        code: `e2e-runtime-${suffix}`,
        description: "Playwright smoke test app",
        status: "published",
        icon: "task",
      },
    })
  );

  const table = await expectJson<AppTable>(
    await page.request.post(`/api/apps/${app.id}/tables`, {
      data: {
        name: "E2E Tickets",
        code: "tickets",
      },
    })
  );

  await expectJson(
    await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, {
      data: {
        name: "件名",
        code: "title",
        fieldType: "text",
        required: true,
        sortOrder: 0,
      },
    })
  );
  await expectJson(
    await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, {
      data: {
        name: "内容",
        code: "description",
        fieldType: "textarea",
        required: false,
        sortOrder: 1,
      },
    })
  );
  await expectJson(
    await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, {
      data: {
        name: "ステータス",
        code: "status",
        fieldType: "select",
        required: true,
        settingsJson: { options: ["Open", "Closed"] },
        defaultValue: "Open",
        sortOrder: 2,
      },
    })
  );

  return { app, table };
}

test("runtime user flow creates, edits, deletes records and deletes the app", async ({
  page,
}) => {
  const suffix = `${Date.now()}`;
  const createdTitle = `E2E 作成 ${suffix}`;
  const updatedTitle = `E2E 更新 ${suffix}`;
  const commentText = `E2E コメント ${suffix}`;
  let appId: string | null = null;
  let appDeleted = false;

  await login(page);

  try {
    const { app, table } = await createRuntimeApp(page, suffix);
    appId = app.id;

    await page.goto("/home");
    const appCard = page.getByTestId(`app-card-${app.id}`);
    await expect(appCard).toBeVisible();
    await appCard.getByRole("link", { name: "開く" }).click();
    await expect(page).toHaveURL(new RegExp(`/run/${app.code}/${table.code}`));
    await expectNoMojibake(page);

    await page.getByRole("button", { name: /新規レコード/ }).click();
    await page.getByPlaceholder("件名を入力").fill(createdTitle);
    await page.getByPlaceholder("内容を入力").fill("E2E smoke test description");
    await page.getByRole("main").getByRole("combobox").selectOption("Open");
    await page.getByRole("button", { name: "レコードを作成" }).click();

    await expect(page.getByText("レコードを作成しました")).toBeVisible();
    await expect(page.getByText(createdTitle).first()).toBeVisible();
    await expectNoMojibake(page);

    const records = await expectJson<AppRecord[]>(
      await page.request.get(`/api/run/${app.code}/${table.code}`)
    );
    const createdRecord = records.find((record) =>
      record.data.title === createdTitle
    );
    expect(createdRecord).toBeDefined();
    await expect(page.getByTestId(`record-row-${createdRecord!.id}`)).toBeVisible();

    await page.getByRole("button", { name: "編集" }).click();
    await page.getByPlaceholder("件名を入力").fill(updatedTitle);
    await page.getByRole("button", { name: "変更を保存" }).click();
    await expect(page.getByText("レコードを更新しました")).toBeVisible();
    await expect(page.getByText(updatedTitle).first()).toBeVisible();

    await page.getByPlaceholder("コメントを追加...").fill(commentText);
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText("コメントを追加しました")).toBeVisible();
    await expect(page.getByText(commentText)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Playwright attachment smoke test"),
    });
    await expect(page.getByText("添付ファイルを追加しました")).toBeVisible();
    await expect(page.getByText("e2e-note.txt")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("delete-record-button").click();
    await expect(page.getByText("レコードを削除しました")).toBeVisible();
    await expect(page.getByText(updatedTitle)).toHaveCount(0);
    await expectNoMojibake(page);

    await page.goto("/home");
    const deleteCard = page.getByTestId(`app-card-${app.id}`);
    await expect(deleteCard).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await deleteCard.getByTestId(`delete-app-${app.id}`).click();
    await expect(page.getByText("アプリを削除しました")).toBeVisible();
    await expect(page.getByTestId(`app-card-${app.id}`)).toHaveCount(0);
    appDeleted = true;
  } finally {
    if (appId && !appDeleted) {
      await page.request.delete(`/api/apps/${appId}`).catch(() => undefined);
    }
  }
});
