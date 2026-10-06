import { describe, expect, it } from "vitest";
import { alignFormFields, applyFormRows, buildFormLayout, formRowsFromFields, getDefaultFormField, getFormFields, isFormRowIndex, type FormLayoutField } from "@/lib/form-layout";
import { placeField, setFieldColumns } from "@/lib/blueprint-layout";
import type { AppField } from "@/types/app";

const fields = [
  { code: "name", name: "品目名", required: true, fieldType: "text" },
  { code: "stock", name: "在庫数", required: false, fieldType: "number" },
  { code: "point", name: "発注点", required: false, fieldType: "number" },
  { code: "notes", name: "備考", required: false, fieldType: "textarea" },
] as AppField[];
const configuration = (fieldCode: string, patch: Partial<FormLayoutField> = {}): FormLayoutField => ({ fieldCode, visible: true, required: false, width: "half", helpText: "", ...patch });

describe("saved form layout", () => {
  it.each([-1, 0.5, "0", undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("ignores invalid row positions %s", (value) => expect(isFormRowIndex(value)).toBe(false));
  it("accepts zero-based integer rows", () => { expect(isFormRowIndex(0)).toBe(true); expect(isFormRowIndex(20)).toBe(true); });
  it("preserves saved order, half-width gaps, help and field-required constraints", () => {
    const form = { layoutJson: { fields: [configuration("stock", { rowIndex: 0, helpText: "数量" }), configuration("name", { rowIndex: 1, visible: false }), configuration("point", { rowIndex: 2 }), configuration("notes", { rowIndex: 3, width: "full" })] } };
    const result = getFormFields(form, fields);
    expect(result[1]).toMatchObject({ fieldCode: "name", visible: true, required: true, rowIndex: 1 });
    expect(formRowsFromFields(result)).toEqual([{ cols: 2, items: ["stock"] }, { cols: 2, items: ["name"] }, { cols: 2, items: ["point"] }, { cols: 1, items: ["notes"] }]);
    expect(buildFormLayout({ fields: result }).fields[0]).toMatchObject({ helpText: "数量", rowIndex: 0 });
  });
  it("packs legacy half widths without inventing gaps", () => {
    expect(formRowsFromFields(fields.map(getDefaultFormField))).toEqual([{ cols: 2, items: ["name", "stock"] }, { cols: 2, items: ["point"] }, { cols: 1, items: ["notes"] }]);
  });
  it("ignores malformed, unknown and duplicate entries and appends new fields", () => {
    const form = { layoutJson: { fields: [null, "bad", { fieldCode: "unknown" }, configuration("stock", { visible: false }), configuration("stock")] } };
    const result = getFormFields(form, fields);
    expect(result.map((field) => field.fieldCode)).toEqual(["stock", "name", "point", "notes"]);
    expect(result[0].visible).toBe(false);
    expect(alignFormFields(result, fields.slice(1)).map((field) => field.fieldCode)).toEqual(["stock", "point", "notes"]);
  });
  it("splits invalid collisions rather than overlapping three fields", () => {
    expect(formRowsFromFields([configuration("name", { rowIndex: 2 }), configuration("stock", { rowIndex: 2 }), configuration("point", { rowIndex: 2 }), configuration("notes", { rowIndex: 2, width: "full" })])).toEqual([{ cols: 2, items: ["name", "stock"] }, { cols: 2, items: ["point"] }, { cols: 1, items: ["notes"] }]);
  });
  it("appends fields without row positions after explicitly positioned rows", () => {
    expect(formRowsFromFields([configuration("notes"), configuration("stock", { rowIndex: 2 }), configuration("name", { rowIndex: 0, width: "full" })])).toEqual([{ cols: 1, items: ["name"] }, { cols: 2, items: ["stock"] }, { cols: 2, items: ["notes"] }]);
  });
  it("round-trips movement with an empty slot and does not mutate the original", () => {
    const original = fields.map(getDefaultFormField);
    original[1].helpText = " 在庫の実数 ";
    const rows = placeField(formRowsFromFields(original), "stock", { row: 3, position: "end" });
    const updated = applyFormRows(rows, original);
    expect(updated.map((field) => field.fieldCode)).toEqual(["name", "point", "notes", "stock"]);
    expect(formRowsFromFields(updated)).toEqual(rows);
    expect(buildFormLayout({ fields: updated }).fields.at(-1)).toMatchObject({ helpText: "在庫の実数", width: "full", rowIndex: 3 });
    expect(original[1].rowIndex).toBeUndefined();
    expect(formRowsFromFields(applyFormRows(setFieldColumns(rows, "name", 1), updated))[0]).toEqual({ cols: 1, items: ["name"] });
  });
  it("keeps hidden fields and their help without showing them in the canvas", () => {
    const hidden = configuration("notes", { visible: false, helpText: "任意" });
    const result = applyFormRows([{ cols: 1, items: ["name"] }], [configuration("name", { required: true }), hidden]);
    expect(result[1]).toEqual(hidden);
    expect(formRowsFromFields(result)).toEqual([{ cols: 1, items: ["name"] }]);
  });
  it("does not impose the AI creation ten-field limit", () => {
    const configurations = Array.from({ length: 24 }, (_, index) => configuration(`field_${index}`));
    expect(applyFormRows(formRowsFromFields(configurations), configurations)).toHaveLength(24);
  });
});
