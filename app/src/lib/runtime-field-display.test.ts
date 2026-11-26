import { describe, expect, it } from "vitest";
import { getRecordTableColumns, getRuntimeFieldText, spansDetailColumns } from "@/lib/runtime-field-display";

describe("getRecordTableColumns", () => {
  it("excludes only the highest-priority title field defined on the table", () => {
    const fields = [{ code: "title" }, { code: "priority" }, { code: "subject" }];
    expect(getRecordTableColumns(fields, ["title", "subject", "priority"])).toEqual([
      { code: "title" }, { code: "priority" },
    ]);
  });

  it("uses title priority independently of the view columns", () => {
    const fields = [{ code: "requester_name" }, { code: "applicant_name" }, { code: "item_name" }];
    expect(getRecordTableColumns(fields, ["requester_name", "applicant_name"])).toEqual([
      { code: "requester_name" }, { code: "applicant_name" },
    ]);
    expect(getRecordTableColumns(fields, ["item_name", "requester_name"])).toEqual([
      { code: "requester_name" },
    ]);
  });

  it("keeps distinct known columns in view order when no title field is defined", () => {
    const fields = [{ code: "priority" }, { code: "quantity" }];
    expect(getRecordTableColumns(fields, ["quantity", "unknown", "quantity", "priority"])).toEqual([
      { code: "quantity" }, { code: "priority" },
    ]);
  });
});

describe("getRuntimeFieldText", () => {
  it("formats numeric fields and preserves legacy nonnumeric values", () => {
    expect(getRuntimeFieldText(1234.5678, "number")).toBe("1,234.5678");
    expect(getRuntimeFieldText("12000", "number")).toBe("12,000");
    expect(getRuntimeFieldText("12000", "text")).toBe("12000");
    expect(getRuntimeFieldText("旧データ", "number")).toBe("旧データ");
  });

  it("distinguishes empty values from zero and false", () => {
    for (const value of [undefined, null, [], "", "  "]) {
      expect(getRuntimeFieldText(value)).toBe("");
    }
    expect(getRuntimeFieldText(0, "number")).toBe("0");
    expect(getRuntimeFieldText(false, "boolean")).toBe("false");
  });
});

describe("spansDetailColumns", () => {
  it("spans textarea, multiline, and values of more than forty characters", () => {
    expect(spansDetailColumns("", "textarea")).toBe(true);
    expect(spansDetailColumns("短い\n複数行")).toBe(true);
    expect(spansDetailColumns("𠮷".repeat(40))).toBe(false);
    expect(spansDetailColumns("𠮷".repeat(41))).toBe(true);
  });
});
