import { expect, test, type APIResponse, type Page } from "@playwright/test";
import type { Workflow } from "../src/types/workflow";

test.use({ viewport: { width: 1920, height: 1080 }, actionTimeout: 15000 });

async function json<Result>(response: APIResponse): Promise<Result> {
  const body = await response.text();
  expect(response.ok(), body).toBe(true);
  return JSON.parse(body) as Result;
}

async function addNode(page: Page, label: string) {
  await page.getByRole("button", { name: "ノード追加", exact: true }).click();
  await page.getByRole("button", { name: `追加: ${label}`, exact: true }).click();
  await expect(page.getByRole("group", { name: "ノード設定", exact: true })).toBeVisible();
}

async function selectNode(page: Page, label: string) {
  await page.getByRole("button", { name: `ノード: ${label}`, exact: true }).click();
}

async function connect(page: Page, source: string, target: string, branch?: string) {
  const form = page.getByRole("group", { name: "接続を追加", exact: true });
  await form.getByLabel("接続元", { exact: true }).selectOption({ label: source });
  await form.getByLabel("接続先", { exact: true }).selectOption({ label: target });
  if (branch !== undefined) await form.getByLabel("接続する分岐", { exact: true }).selectOption(branch);
  await form.getByRole("button", { name: "接続を作成", exact: true }).click();
}

test("editor creates, configures, connects, duplicates, moves, deletes and reloads executable graphs", async ({ page }) => {
  await json(await page.request.post("/api/auth/login", { data: { email: "marcus.chen@acme.com", password: "demo" } }));
  const suffix = Date.now();
  const app = await json<{ id: string; code: string }>(await page.request.post("/api/apps", { data: { name: `Editor ${suffix}`, code: `editor-${suffix}`, status: "published" } }));
  try {
    const table = await json<{ id: string; code: string }>(await page.request.post(`/api/apps/${app.id}/tables`, { data: { name: "申請", code: "requests" } }));
    for (const field of [{ name: "件名", code: "title", fieldType: "text" }, { name: "金額", code: "amount", fieldType: "number" }]) await json(await page.request.post(`/api/apps/${app.id}/tables/${table.id}/fields`, { data: field }));
    await page.goto(`/apps/${app.id}/workflows`);
    await expect(page.getByRole("button", { name: "新規ワークフロー", exact: true })).toBeEnabled();
    await page.getByLabel("新規テンプレート", { exact: true }).selectOption("blank");
    await page.getByRole("button", { name: "新規ワークフロー", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ワークフローを作成しました。" })).toBeVisible();
    await page.getByLabel("ワークフロー名", { exact: true }).fill(`編集テスト ${suffix}`);
    await page.getByLabel("トリガー種別", { exact: true }).selectOption("create");
    await selectNode(page, "トリガー");
    await page.getByLabel("対象テーブル", { exact: true }).selectOption(table.id);
    await page.getByLabel("X座標", { exact: true }).fill("100");
    await page.getByLabel("Y座標", { exact: true }).fill("120");

    await addNode(page, "条件分岐");
    await page.getByLabel("比較フィールド", { exact: true }).selectOption("amount");
    await page.getByLabel("演算子", { exact: true }).selectOption("greater_than");
    await page.getByLabel("比較値", { exact: true }).fill("10");
    await page.getByLabel("X座標", { exact: true }).fill("420");
    await page.getByLabel("Y座標", { exact: true }).fill("120");

    await addNode(page, "承認");
    await page.getByLabel("承認ポリシー", { exact: true }).selectOption("override");
    await page.getByLabel("依頼タイトル", { exact: true }).fill("{{recordTitle}} の確認");
    await page.getByLabel("承認後ステータス", { exact: true }).fill("reviewed");
    await addNode(page, "通知");
    await page.getByLabel("通知タイトル", { exact: true }).fill("{{recordTitle}} の処理結果");
    await page.getByLabel("通知本文", { exact: true }).fill("{{tableName}} の確認が終わりました。");
    await page.getByLabel("X座標", { exact: true }).fill("1100");
    await page.getByLabel("Y座標", { exact: true }).fill("360");
    await addNode(page, "ステータス更新");
    await page.getByLabel("更新先ステータス", { exact: true }).fill("complete");
    await page.getByLabel("X座標", { exact: true }).fill("780");
    await page.getByLabel("Y座標", { exact: true }).fill("120");
    await page.getByRole("button", { name: "ノードを複製", exact: true }).click();
    await page.getByLabel("ノード名", { exact: true }).fill("少額処理");
    await page.getByLabel("更新先ステータス", { exact: true }).fill("automatic");
    await page.getByLabel("X座標", { exact: true }).fill("780");
    await page.getByLabel("Y座標", { exact: true }).fill("360");
    await addNode(page, "API呼び出し");
    await page.getByLabel("送信先URL", { exact: true }).fill("https://example.com/records");
    await page.getByLabel("HTTPメソッド", { exact: true }).selectOption("PATCH");
    await page.getByLabel("ヘッダーJSON", { exact: true }).fill('{"X-Record":"{{recordId}}"}');
    await page.getByLabel("本文JSONテンプレート", { exact: true }).fill('{"title":"{{recordTitle}}"}');
    await page.getByLabel("タイムアウト（ミリ秒）", { exact: true }).fill("1500");
    await addNode(page, "AIアクション");
    await page.getByLabel("AI処理", { exact: true }).selectOption("reply_draft");
    await page.getByLabel("出力先", { exact: true }).selectOption("field");
    await page.getByLabel("出力先フィールド", { exact: true }).selectOption("title");

    await page.getByRole("button", { name: "有効化", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "開始トリガーから接続されていません" })).toBeVisible();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ワークフローを下書き保存しました。" })).toBeVisible();
    const saved = (await json<Workflow[]>(await page.request.get(`/api/apps/${app.id}/workflows`))).find((workflow) => workflow.name === `編集テスト ${suffix}`)!;
    expect(saved.definitionJson.nodes).toHaveLength(8);
    expect(saved.triggerType).toBe("create");
    expect(saved.definitionJson.nodes.find((node) => node.data.nodeType === "api_call")?.data.config).toMatchObject({ method: "PATCH", timeoutMs: 1500 });
    expect(saved.definitionJson.nodes.find((node) => node.data.nodeType === "ai_action")?.data.config).toMatchObject({ action: "reply_draft", output: "field", outputFieldCode: "title" });
    await page.reload();
    await expect(page.getByLabel("ワークフロー名", { exact: true })).toHaveValue(`編集テスト ${suffix}`);
    for (const label of ["API呼び出し", "AIアクション", "承認"]) { await selectNode(page, label); await page.getByRole("button", { name: "ノードを削除", exact: true }).click(); }

    await page.getByRole("button", { name: "全体表示", exact: true }).click();
    const source = page.getByLabel("トリガーの出力", { exact: true });
    const target = page.getByLabel("条件分岐の入力", { exact: true });
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "接続: トリガー → 条件分岐", exact: true })).toBeVisible();
    await connect(page, "条件分岐", "ステータス更新", "yes");
    await connect(page, "条件分岐", "少額処理", "no");
    await connect(page, "少額処理", "通知");
    await page.getByLabel("接続ラベル", { exact: true }).fill("処理完了");
    await page.getByRole("button", { name: "接続を削除", exact: true }).click();
    await connect(page, "少額処理", "通知");
    await page.getByLabel("接続ラベル", { exact: true }).fill("処理完了");

    await page.getByRole("button", { name: "全体表示", exact: true }).click();
    await selectNode(page, "ステータス更新");
    const nodeView = page.locator(".react-flow__node").filter({ hasText: "ステータス更新" }).first();
    const beforeMove = await nodeView.boundingBox();
    await page.mouse.move(beforeMove!.x + 60, beforeMove!.y + 30);
    await page.mouse.down();
    await page.mouse.move(beforeMove!.x + 110, beforeMove!.y + 70, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByLabel("X座標", { exact: true })).not.toHaveValue("780");
    await page.getByRole("button", { name: "有効化", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "ワークフローを有効な状態で保存しました。" })).toBeVisible();
    const activated = await json<Workflow>(await page.request.get(`/api/apps/${app.id}/workflows/${saved.id}`));
    expect(activated.status).toBe("active");
    expect(activated.definitionJson.edges).toHaveLength(4);
    expect(activated.definitionJson.edges.some((edge) => edge.label === "処理完了")).toBe(true);
    await page.reload();
    await expect(page.getByLabel("保存する状態", { exact: true })).toHaveValue("active");
    const reloaded = await json<Workflow>(await page.request.get(`/api/apps/${app.id}/workflows/${saved.id}`));
    expect(reloaded.definitionJson).toEqual(activated.definitionJson);
    for (const [amount, expectedStatus] of [[20, "complete"], [5, "automatic"]] as const) {
      const record = await json<{ status: string }>(await page.request.post(`/api/run/${app.code}/${table.code}`, { data: { data: { title: `申請 ${amount}`, amount } } }));
      expect(record.status).toBe(expectedStatus);
    }
    await page.getByRole("button", { name: "全体表示", exact: true }).click();
    await page.screenshot({ path: "test-results/workflow-editor-completed.png", fullPage: true });
    await page.getByLabel("新規テンプレート", { exact: true }).selectOption("approval");
    await page.getByRole("button", { name: "新規ワークフロー", exact: true }).click();
    await expect(page.getByRole("button", { name: "ノード: 承認", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "接続: 承認 → 通知 (approved)", exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/apps/${app.id}`);
  }
});
