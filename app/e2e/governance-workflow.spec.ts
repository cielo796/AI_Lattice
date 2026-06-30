import { expect, test, type APIResponse, type Page } from "@playwright/test";

interface AppSummary {
  id: string;
  code: string;
}

interface AppTable {
  id: string;
  code: string;
}

interface AppRecord {
  id: string;
  status: string;
}

interface Workflow {
  id: string;
}

const EXPECT_TIMEOUT = 30000;

async function expectJson<T>(response: APIResponse) {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return body ? (JSON.parse(body) as T) : (null as T);
}

async function login(page: Page) {
  await expectJson(
    await page.request.post("/api/auth/login", {
      data: { email: "marcus.chen@acme.com", password: "demo" },
    })
  );
  await page.goto("/home");
  await expect(page).toHaveURL(/\/home$/);
}

test("admin governance pages and non-approval workflow execution", async ({ page }) => {
  const suffix = `${Date.now()}`;
  let appId: string | null = null;

  await login(page);

  await page.goto("/admin/roles");
  await expect(page.getByRole("heading", { name: "ロール管理" })).toBeVisible();

  await page.goto("/admin/tenant");
  await expect(page.getByRole("heading", { name: "テナント設定" })).toBeVisible();

  await page.goto("/admin/prompt-templates");
  await expect(page.getByRole("heading", { name: "Prompt Template" })).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "通知" })).toBeVisible();

  try {
    const app = await expectJson<AppSummary>(
      await page.request.post("/api/apps", {
        data: {
          name: `E2E Workflow ${suffix}`,
          code: `e2e-workflow-${suffix}`,
          status: "published",
          icon: "account_tree",
        },
      })
    );
    appId = app.id;

    const table = await expectJson<AppTable>(
      await page.request.post(`/api/apps/${app.id}/tables`, {
        data: { name: "Cases", code: "cases" },
      })
    );
    await expectJson(
      await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, {
        data: {
          name: "件名",
          code: "title",
          fieldType: "text",
          required: true,
        },
      })
    );

    const record = await expectJson<AppRecord>(
      await page.request.post(`/api/run/${app.code}/${table.code}`, {
        data: {
          status: "active",
          data: { title: `E2E workflow record ${suffix}` },
        },
      })
    );

    await page.goto(`/run/${app.code}`);
    await expect(page.getByRole("main").getByRole("heading", { name: `E2E Workflow ${suffix}` })).toBeVisible();

    await page.goto(`/run/${app.code}/dashboard`);
    await expect(page.getByRole("banner").getByRole("heading", { name: "ダッシュボード" })).toBeVisible();

    await page.goto(`/run/${app.code}/approvals`);
    await expect(page.getByRole("main").getByRole("heading", { name: "承認待ち一覧" })).toBeVisible();

    await page.goto(`/apps/${app.id}/permissions`);
    await expect(
      page.getByRole("main").getByRole("heading", {
        name: `E2E Workflow ${suffix} の権限`,
      })
    ).toBeVisible({ timeout: EXPECT_TIMEOUT });

    await page.goto("/tenants");
    await expect(page.getByRole("main").getByRole("heading", { name: "テナント" })).toBeVisible();

    await page.goto("/settings/profile");
    await expect(page.getByRole("main").getByRole("heading", { name: "プロフィール" })).toBeVisible();

    const workflow = await expectJson<Workflow>(
      await page.request.post(`/api/apps/${app.id}/workflows`, {
        data: {
          name: `E2E status workflow ${suffix}`,
          triggerType: "webhook",
          status: "active",
          definitionJson: {
            nodes: [
              {
                id: "trigger",
                type: "triggerNode",
                data: { label: "Webhook", nodeType: "trigger" },
              },
              {
                id: "status",
                type: "notificationNode",
                data: {
                  label: "Triage",
                  nodeType: "status_update",
                  config: { status: "triage" },
                },
              },
            ],
            edges: [{ id: "edge", source: "trigger", target: "status" }],
          },
        },
      })
    );

    await expectJson(
      await page.request.post(`/api/apps/${app.id}/workflows/${workflow.id}/run`, {
        data: { tableId: table.id, recordId: record.id },
      })
    );

    const updatedRecord = await expectJson<AppRecord>(
      await page.request.get(`/api/run/${app.code}/${table.code}/${record.id}`)
    );
    expect(updatedRecord.status).toBe("triage");
  } finally {
    if (appId) {
      await page.request.delete(`/api/apps/${appId}`).catch(() => undefined);
    }
  }
});
