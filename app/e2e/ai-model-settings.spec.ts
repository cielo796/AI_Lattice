import { expect, test } from "@playwright/test";
import { AI_MODEL_OPTIONS } from "../src/lib/ai-models";

test.skip(process.env.PLAYWRIGHT_APP_AUDIT_TEST !== "true", "Requires an explicitly enabled disposable local test database.");

test("model selection persists independently of credentials and rejects invalid bodies", async ({ page }) => {
  const database = new URL(process.env.DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname);
  expect(database.pathname).toMatch(/^\/lattice_test_[a-z0-9_]+$/);
  expect((await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } })).ok()).toBe(true);
  const path = "/api/admin/ai-model-settings";
  const original = await (await page.request.get(path)).json() as { defaultModel: string };
  const keyStatus = await (await page.request.get("/api/admin/openai-settings")).json();
  try {
    await page.goto("/admin/openai");
    const selector = page.getByLabel("既定AIモデル", { exact: true });
    await expect(selector).toHaveValue(original.defaultModel);
    for (const model of AI_MODEL_OPTIONS) {
      await selector.selectOption(model.id);
      await page.getByRole("button", { name: "モデルを保存", exact: true }).click();
      await expect(page.getByText("AIモデル設定を保存しました。", { exact: true })).toBeVisible();
      await page.reload();
      await expect(selector).toHaveValue(model.id);
      const persisted = await page.request.get(path);
      expect(persisted.ok()).toBe(true);
      expect(await persisted.json()).toMatchObject({ defaultModel: model.id, source: "tenant" });
    }
    for (const data of [null, [], {}, { defaultModel: "not-a-model" }, { defaultModel: 42 }]) {
      const response = await page.request.put(path, { data: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
      expect(response.status(), await response.text()).toBe(400);
    }
    expect(await (await page.request.get("/api/admin/openai-settings")).json()).toEqual(keyStatus);
    await page.goto("/admin/prompt-templates");
    const templateModel = page.getByRole("combobox", { name: "新規テンプレートのモデル", exact: true });
    await expect(templateModel).toHaveValue("gpt-6-luna");
    await templateModel.selectOption("gpt-6-astra");
    await expect(templateModel).toHaveValue("gpt-6-astra");
  } finally {
    expect((await page.request.put(path, { data: { defaultModel: original.defaultModel } })).ok()).toBe(true);
  }
});
