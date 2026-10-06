import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustBlueprintFromInstruction, createAppFromBlueprint, generateBlueprintFromPrompt, getBlueprintModelInfo, normalizeGeneratedAppBlueprint } from "@/server/apps/blueprints";
import type { GeneratedAppBlueprint } from "@/types/ai";

const { resolveActivePromptTemplateVersion, getTenantAIModel } = vi.hoisted(() => ({ resolveActivePromptTemplateVersion: vi.fn(), getTenantAIModel: vi.fn() }));
vi.mock("@/server/admin/prompt-templates", () => ({ resolveActivePromptTemplateVersion }));
vi.mock("@/server/ai/model-settings", () => ({ getTenantAIModel }));
vi.mock("@/server/apps/bootstrap", () => ({ ensureDemoBuilderData: vi.fn() }));
vi.mock("@/server/audit/service", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/server/db/prisma", () => ({ getPrismaClient: () => ({ aiExecutionLog: { create: vi.fn() } }) }));

const user = { id: "user", tenantId: "tenant", name: "Builder", email: "builder@example.com", status: "active" as const, createdAt: "2026-01-01" };
const blueprint: GeneratedAppBlueprint = { name: "在庫", code: "inventory", description: "倉庫の在庫", aiInsight: "数量と期限を管理", tables: [{ name: "在庫品", code: "items", fields: [
  { name: "品目", code: "name", fieldType: "text", required: true, reason: "検索するため。" },
  { name: "状態", code: "status", fieldType: "select", required: false, options: ["入荷", "出荷"] },
  { name: "数量", code: "amount", fieldType: "number", required: false },
] }], layout: [{ cols: 2, items: ["amount", "status"] }, { cols: 1, items: ["name"] }], suggestions: [{ name: "期限", code: "due", fieldType: "date", reason: "日付で追跡。" }] };

beforeEach(() => { vi.clearAllMocks(); resolveActivePromptTemplateVersion.mockResolvedValue(null); getTenantAIModel.mockResolvedValue("tenant-model"); });

describe("creation server contracts", () => {
  it("previews the same tenant model used for generation", async () => {
    expect(await getBlueprintModelInfo(user)).toEqual({ model: "tenant-model", source: "tenant" });
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(blueprint) }) } };
    await generateBlueprintFromPrompt("在庫管理", user, client);
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ model: "tenant-model" }));
  });
  it("previews the active template model and extends its legacy schema without changing its model", async () => {
    resolveActivePromptTemplateVersion.mockResolvedValue({ id: "version", key: "builder", name: "在庫用", version: 1, modelName: "template-model", instructions: "Custom design instructions.", responseSchemaJson: { type: "object" } });
    expect(await getBlueprintModelInfo(user)).toEqual({ model: "template-model", source: "template", templateName: "在庫用" });
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(blueprint) }) } };
    await generateBlueprintFromPrompt("在庫管理", user, client);
    const params = client.responses.create.mock.calls[0][0];
    expect(params.model).toBe("template-model");
    expect(params.instructions).toContain("Custom design instructions.");
    expect(params.text.format.schema.properties.layout).toBeDefined();
    expect(params.text.format.schema.properties.suggestions).toBeDefined();
    expect(getTenantAIModel).not.toHaveBeenCalled();
  });
  it("normalizes invalid layout to full rows while keeping reasons and valid suggestions", () => {
    const normalized = normalizeGeneratedAppBlueprint({ ...blueprint, layout: [{ cols: 2, items: ["name", "missing"] }], suggestions: [...blueprint.suggestions!, { name: "重複", code: "name", fieldType: "text" }, { name: "無効", code: "bad", fieldType: "file" }] });
    expect(normalized.layout).toEqual(["name", "status", "amount"].map((code) => ({ cols: 1, items: [code] })));
    expect(normalized.suggestions).toEqual(blueprint.suggestions);
    expect(normalized.tables[0].fields[0].reason).toBe("検索するため。");
  });
  it("accepts comma-separated choices on save while preserving existing JSON array storage", () => {
    const payload = structuredClone(blueprint) as unknown as { tables: Array<{ fields: Array<{ options?: unknown }> }> };
    payload.tables[0].fields[1].options = " 入荷, 出荷 ";
    expect(normalizeGeneratedAppBlueprint(payload).tables[0].fields[1].options).toEqual(["入荷", "出荷"]);
  });
  it("sends the current unsaved blueprint and an abort signal when adjusting", async () => {
    const client = { responses: { create: vi.fn().mockResolvedValue({ output_text: JSON.stringify(blueprint) }) } };
    const controller = new AbortController();
    await adjustBlueprintFromInstruction("数量を必須に", blueprint, user, client, controller.signal);
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ input: expect.stringContaining("数量を必須に") }), { signal: controller.signal });
    expect(client.responses.create.mock.calls[0][0].input).toContain('"code":"amount"');
  });
  it("rejects descriptions and adjustment instructions over 1000 characters", async () => {
    await expect(generateBlueprintFromPrompt("x".repeat(1001), user)).rejects.toMatchObject({ status: 400 });
    await expect(adjustBlueprintFromInstruction("x".repeat(1001), blueprint, user)).rejects.toMatchObject({ status: 400 });
  });
  it("saves the flattened order, exact form widths, sample count and shared views atomically", async () => {
    const tx = {
      app: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "app", tenantId: "tenant", name: "在庫", code: "inventory", description: "説明", status: "draft", icon: "auto_awesome", createdById: "user", createdAt: new Date(), updatedAt: new Date() }) },
      appTable: { create: vi.fn() }, appField: { create: vi.fn() }, appView: { create: vi.fn() }, appForm: { create: vi.fn() }, appRecord: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (inner: typeof tx) => Promise<unknown>) => callback(tx)) };
    await createAppFromBlueprint(user, blueprint, prisma as never);
    expect(tx.appField.create.mock.calls.map((call) => call[0].data.code)).toEqual(["amount", "status", "name"]);
    expect(tx.appForm.create.mock.calls[0][0].data.layoutJson.fields).toEqual([
      { fieldCode: "amount", visible: true, required: false, width: "half", rowIndex: 0 },
      { fieldCode: "status", visible: true, required: false, width: "half", rowIndex: 0 },
      { fieldCode: "name", visible: true, required: true, width: "full", rowIndex: 1 },
    ]);
    expect(tx.appRecord.create).toHaveBeenCalledTimes(3);
    expect(tx.appView.create.mock.calls.map((call) => call[0].data.viewType)).toEqual(["list", "kanban", "chart", "summary"]);
  });
});
