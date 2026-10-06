import { describe, expect, it } from "vitest";
import { automaticCode, blueprintDiff, blueprintFromDraft, draftCodeError, draftErrors, draftFromAdjustedBlueprint, draftFromBlueprint, fieldCodeError, newDraftField, orderedFields, preserveEditedDraft, splitChoices, uniqueFieldCode } from "@/lib/app-creation";
import { buildInitialViewsForTable } from "@/lib/blueprint-views";
import type { GeneratedAppBlueprint } from "@/types/ai";

const blueprint: GeneratedAppBlueprint = {
  name: "在庫", code: "inventory", description: "倉庫の在庫を管理", aiInsight: "在庫と発注点を並べます。",
  tables: [{ name: "在庫品", code: "items", fields: [
    { name: "品目", code: "name", fieldType: "text", required: true, reason: "品目を探すため。" },
    { name: "在庫数", code: "stock", fieldType: "number", required: false },
    { name: "発注点", code: "point", fieldType: "number", required: false },
  ] }], layout: [{ cols: 1, items: ["name"] }, { cols: 2, items: ["point", "stock"] }],
};

describe("app creation draft", () => {
  it("round-trips generated metadata, reasons, layout order and arrays", () => {
    const saved = blueprintFromDraft(draftFromBlueprint(blueprint));
    expect(saved.tables[0].fields.map((field) => field.code)).toEqual(["name", "point", "stock"]);
    expect(saved.layout).toEqual(blueprint.layout);
    expect(saved.tables[0].fields[0].reason).toBe("品目を探すため。");
  });
  it("supports legacy generation without reasons, layout or suggestions", () => {
    const draft = draftFromBlueprint({ ...blueprint, layout: undefined });
    expect(draft.layout.every((row) => row.cols === 1)).toBe(true);
    expect(draft.suggestions).toEqual([]);
    expect(draftErrors(draft)).toEqual([]);
  });
  it("adds a new optional select with defaults and a unique automatic code", () => {
    const draft = draftFromBlueprint(blueprint);
    const field = newDraftField(draft, "select");
    expect(field).toMatchObject({ name: "新しい選択式", codeAuto: true, required: false, options: ["選択肢A", "選択肢B"], source: "user" });
    expect(uniqueFieldCode("name", orderedFields(draft))).toBe("name_2");
  });
  it("validates code formats and collisions immediately", () => {
    const fields = orderedFields(draftFromBlueprint(blueprint));
    expect(fieldCodeError({ ...fields[1], code: "name" }, fields)).toContain("既に");
    expect(fieldCodeError({ ...fields[1], code: "1Bad" }, fields)).toContain("英小文字");
    expect(automaticCode("New field", "field_1")).toBe("new_field");
    expect(automaticCode("日本語", "field_1")).toBe("field_1");
  });
  it.each(["inventory", "inventory-items", "app2"])("accepts the existing app/table code format %s", (code) => {
    expect(draftCodeError(code)).toBe("");
  });
  it.each(["", "1app", "App", "inventory_items", "app code", "日本語"])("shares inline and save validation for invalid codes %s", (code) => {
    expect(draftCodeError(code)).toContain("英小文字");
    expect(draftErrors({ ...draftFromBlueprint(blueprint), code })).toContain("アプリ／テーブルコードは英小文字で始め、英小文字・数字・ハイフンで入力してください。");
  });
  it("splits pasted Japanese and ASCII delimiters, trims and rejects duplicates", () => {
    expect(splitChoices(" 倉庫A、倉庫B\n倉庫C,倉庫B， ", ["倉庫A"])).toEqual({ choices: ["倉庫A", "倉庫B", "倉庫C"], duplicates: ["倉庫A", "倉庫B"] });
  });
  it("shows additions, changes and removals without applying them", () => {
    const updated = structuredClone(blueprint);
    updated.tables[0].fields[0].required = false;
    updated.tables[0].fields.pop();
    updated.tables[0].fields.push({ name: "期限", code: "due", fieldType: "date", required: false });
    expect(blueprintDiff(blueprint, updated).map((change) => change.kind)).toEqual(["変更", "追加", "削除"]);
    expect(blueprint.tables[0].fields[0].required).toBe(true);
  });
  it("includes design explanations and recommendation-only changes in the review", () => {
    const updated = { ...blueprint, aiInsight: "配置を見直しました。", suggestions: [{ name: "単価", code: "unit_price", fieldType: "number" as const, reason: "金額を集計します。" }] };
    const changes = blueprintDiff(blueprint, updated);
    expect(changes.map((change) => change.name)).toEqual(["AIの設計説明", "AIのおすすめ"]);
    expect(changes[1].detail).toContain("単価（数値）");
    expect(blueprintDiff({ ...blueprint, suggestions: [] }, blueprint)).toEqual([]);
  });
  it("preserves manual edits and layout during regeneration", () => {
    const current = draftFromBlueprint(blueprint);
    const first = orderedFields(current)[0];
    current.fields[first.id] = { ...first, name: "手で変更", codeAuto: false, edited: true };
    const incoming = draftFromBlueprint(blueprint);
    const merged = preserveEditedDraft(current, incoming);
    expect(orderedFields(merged)[0].name).toBe("手で変更");
    expect(blueprintFromDraft(merged).layout).toEqual(blueprint.layout);
  });
  it("retains stable IDs, manual codes and accepted changes across adjustment and regeneration", () => {
    const current = draftFromBlueprint(blueprint);
    const first = orderedFields(current)[0];
    current.fields[first.id] = { ...first, codeAuto: false, source: "user", edited: true };
    const adjusted = structuredClone(blueprint);
    adjusted.tables[0].fields[0].required = false;
    const next = draftFromAdjustedBlueprint(current, adjusted, ["name"]);
    expect(next.fields[first.id]).toMatchObject({ codeAuto: false, source: "user", edited: true, required: false });
    expect(orderedFields(preserveEditedDraft(next, draftFromBlueprint(blueprint)))[0].required).toBe(false);
  });
});

describe("shared initial view rules", () => {
  it("does not incorrectly create a chart just because there is a number", () => {
    expect(buildInitialViewsForTable(blueprint.tables[0]).map((view) => view.viewType)).toEqual(["list", "summary"]);
  });
  it("preserves grouping-code precedence over select types", () => {
    const table = { ...blueprint.tables[0], fields: [...blueprint.tables[0].fields, { name: "場所", code: "location", fieldType: "select" as const, required: false }, { name: "状態", code: "status", fieldType: "text" as const, required: false }, { name: "日時", code: "created", fieldType: "datetime" as const, required: false }] };
    const views = buildInitialViewsForTable(table);
    expect(views.map((view) => view.viewType)).toEqual(["list", "kanban", "calendar", "chart", "summary"]);
    expect(views[1].settingsJson.groupByFieldCode).toBe("status");
    expect(views[1].reason).toContain("状態");
  });
});
