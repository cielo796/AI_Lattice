import { describe, expect, it } from "vitest";
import { newDesignField, patchDesignField, serializeTableDesign, tableDesignDraft, tableDesignErrors, type TableDesignSnapshot } from "@/lib/table-design";

const snapshot: TableDesignSnapshot = {
  revision: "revision", app: { id: "app", tenantId: "tenant", name: "在庫", code: "inventory", status: "draft", icon: "apps", createdBy: "user", createdAt: "2026-10-06", updatedAt: "2026-10-06" },
  tables: [{ id: "table", appId: "app", tenantId: "tenant", name: "在庫品", code: "items", isSystem: false, sortOrder: 0, createdAt: "2026-10-06" }],
  fields: [{ id: "name", appId: "app", tenantId: "tenant", tableId: "table", name: "品目名", code: "item_name", fieldType: "text", required: true, uniqueFlag: true, sortOrder: 0, createdAt: "2026-10-06" }, { id: "file", appId: "app", tenantId: "tenant", tableId: "table", name: "添付", code: "attachment", fieldType: "file", required: false, uniqueFlag: false, sortOrder: 1, createdAt: "2026-10-06" }],
  forms: [{ id: "form", appId: "app", tenantId: "tenant", tableId: "table", name: "入力", sortOrder: 0, createdAt: "2026-10-06", updatedAt: "2026-10-06", layoutJson: { fields: [{ fieldCode: "item_name", visible: true, required: true, width: "half", rowIndex: 0 }, { fieldCode: "attachment", visible: false, helpText: "添付は任意", width: "full" }] } }], views: [],
};

describe("table design draft", () => {
  it("creates a usable empty-table draft without persisting anything", () => {
    const draft = tableDesignDraft({ ...snapshot, tables: [], fields: [], forms: [] });
    expect(draft.tableId).toBeUndefined(); expect(draft.tableCode).toBe("items");
    expect(tableDesignErrors(draft)).toContain("部品を追加して、少なくとも1項目をフォームに配置してください。");
    const field = newDesignField(draft, "text");
    expect(tableDesignErrors({ ...draft, fields: [field], rows: [{ cols: 1, items: [field.id] }] })).toEqual([]);
  });
  it("retains an empty half slot, hidden fields, required flags and non-AI types", () => {
    const draft = tableDesignDraft(snapshot);
    expect(draft.rows).toEqual([{ cols: 2, items: ["name"] }]);
    expect(draft.fields[1]).toMatchObject({ fieldType: "file", visible: false, helpText: "添付は任意" });
    expect(serializeTableDesign(draft, snapshot.revision).form.layoutJson.fields).toEqual([{ fieldCode: "item_name", visible: true, required: true, width: "half", rowIndex: 0 }, { fieldCode: "attachment", visible: false, required: false, width: "full", helpText: "添付は任意" }]);
  });
  it("does not permit accidental persisted code or type changes", () => {
    const draft = patchDesignField(tableDesignDraft(snapshot), "name", { code: "changed", fieldType: "number", name: "名称" });
    expect(draft.fields[0]).toMatchObject({ code: "item_name", fieldType: "text", name: "名称" });
  });
  it("keeps new-field identity stable while automatic and manual codes change", () => {
    const draft = tableDesignDraft(snapshot);
    const field = newDesignField(draft, "text");
    const added = { ...draft, fields: [...draft.fields, field], rows: [...draft.rows, { cols: 1 as const, items: [field.id] }] };
    const named = patchDesignField(added, field.id, { name: "Product name" });
    expect(named.fields[2].code).toBe("product_name");
    expect(named.rows[1].items).toEqual([field.id]);
    const manual = patchDesignField(named, field.id, { code: "custom" });
    expect(patchDesignField(manual, field.id, { name: "Changed" }).fields[2].code).toBe("custom");
    expect(serializeTableDesign(named, "revision").form.layoutJson.fields).toContainEqual({ fieldCode: "product_name", visible: true, required: false, width: "full", rowIndex: 1 });
  });
  it("allocates unique field codes and supplies select choices", () => {
    const draft = tableDesignDraft(snapshot);
    const first = newDesignField(draft, "select");
    const next = newDesignField({ ...draft, fields: [...draft.fields, first] }, "select");
    expect(next.code).not.toBe(first.code); expect(next.options).toEqual(["選択肢A", "選択肢B"]);
  });
  it("required fields return to the canvas and require input", () => {
    const draft = patchDesignField(tableDesignDraft(snapshot), "file", { required: true });
    expect(draft.rows[1]).toEqual({ cols: 1, items: ["file"] });
    expect(draft.fields[1]).toMatchObject({ visible: true, formRequired: true });
  });
  it("does not impose the AI generator's ten-field limit", () => {
    let draft = tableDesignDraft(snapshot);
    for (let count = 0; count < 24; count++) {
      const field = newDesignField(draft, "number");
      draft = { ...draft, fields: [...draft.fields, field], rows: [...draft.rows, { cols: 1, items: [field.id] }] };
    }
    expect(tableDesignErrors(draft)).toEqual([]); expect(serializeTableDesign(draft, "revision").fields).toHaveLength(26);
  });
  it("validates new fields but accepts unchanged legacy identifiers", () => {
    const draft = tableDesignDraft(snapshot);
    draft.tableCode = "legacy_table"; draft.fields[0].code = "legacy-code";
    expect(tableDesignErrors(draft)).toEqual([]);
    const field = { ...newDesignField(draft, "text"), code: "legacy-code" };
    expect(tableDesignErrors({ ...draft, fields: [...draft.fields, field] })).toHaveLength(2);
  });
  it("selects a requested form or creates a new full-width form", () => {
    const draft = tableDesignDraft(snapshot, "table", "new");
    expect(draft.formId).toBeUndefined(); expect(draft.rows).toEqual([{ cols: 1, items: ["name"] }, { cols: 1, items: ["file"] }]);
    expect(tableDesignDraft(snapshot, "table", "form").formId).toBe("form");
  });
});
