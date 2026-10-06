import { describe, expect, it } from "vitest";
import { hitTestDrop, moveFieldByKeyboard, normalizeBlueprintLayout, placeField, setFieldColumns, toBlueprintFormLayout, type FormRow } from "@/lib/blueprint-layout";

const rows: FormRow[] = [{ cols: 1, items: ["name"] }, { cols: 2, items: ["stock", "point"] }, { cols: 1, items: ["date"] }];
const geometry = rows.map((row, index) => ({ rect: { left: 0, right: 400, top: index * 110, bottom: index * 110 + 100 }, cells: row.items.map((id, column) => ({ id, rect: { left: column * 200, right: row.cols === 1 ? 400 : (column + 1) * 200, top: index * 110, bottom: index * 110 + 100 } })) }));
const bounds = { left: 0, right: 400, top: 0, bottom: 420 };

describe("blueprint layout compatibility", () => {
  it.each([undefined, null, [], [{ cols: 3, items: ["name", "stock", "point"] }], [{ cols: 1, items: ["unknown"] }], [{ cols: 2, items: ["name", "name"] }], [{ cols: 1, items: ["name"] }]])("falls back for missing, duplicate, incomplete or invalid layout %j", (input) => {
    expect(normalizeBlueprintLayout(input, ["name", "stock", "point", "date"])).toEqual(["name", "stock", "point", "date"].map((code) => ({ cols: 1, items: [code] })));
  });
  it("preserves valid two-column rows including empty slots", () => {
    const input: FormRow[] = [{ cols: 2, items: ["name"] }, { cols: 2, items: ["stock", "point"] }, { cols: 1, items: ["date"] }];
    expect(normalizeBlueprintLayout(input, ["name", "stock", "point", "date"])).toEqual(input);
  });
});

describe("pointer placement", () => {
  it("inserts before and after rows without mutating the source", () => {
    expect(placeField(rows, "extra", { row: 1, position: "before" })[1]).toEqual({ cols: 1, items: ["extra"] });
    expect(placeField(rows, "extra", { row: 1, position: "after" })[2]).toEqual({ cols: 1, items: ["extra"] });
    expect(rows).toHaveLength(3);
  });
  it.each(["left", "right"] as const)("places %s beside a full-width field", (position) => {
    const next = placeField(rows, "date", { row: 0, position });
    expect(next[0]).toEqual({ cols: 2, items: position === "left" ? ["date", "name"] : ["name", "date"] });
    expect(next).toHaveLength(2);
  });
  it("leaves an empty half-width slot when moving out of a pair", () => {
    const next = placeField(rows, "stock", { row: 3, position: "end" });
    expect(next[1]).toEqual({ cols: 2, items: ["point"] });
    expect(placeField(next, "name", { row: 1, position: "slot", index: 1 })[0]).toEqual({ cols: 2, items: ["point", "name"] });
  });
  it("never allows three fields in one row", () => {
    expect(placeField(rows, "extra", { row: 1, position: "right" })).toBe(rows);
  });
  it("dropping on itself is unchanged, including its original half slot", () => {
    expect(placeField(rows, "name", { row: 0, position: "self" })).toBe(rows);
    expect(placeField(rows, "point", { row: 1, position: "slot", index: 1 })).toEqual(rows);
  });
  it("removes an empty source row before keeping the correct destination order", () => {
    expect(placeField(rows, "name", { row: 2, position: "after" }).map((row) => row.items)).toEqual([["stock", "point"], ["date"], ["name"]]);
  });
  it.each([[1, "left"], [399, "right"], [200, "before"]] as const)("hit tests the 24%% card edges at x=%i", (x, position) => {
    expect(hitTestDrop(rows, geometry, bounds, x, 20)?.position).toBe(position);
  });
  it("rejects a horizontal placement in an already full pair", () => {
    expect(hitTestDrop(rows, geometry, bounds, 1, 130)?.position).toBe("before");
  });
  it("detects an empty slot and a two-column dragged card's original slot", () => {
    const half: FormRow[] = [{ cols: 2, items: ["name"] }];
    const measured = [{ rect: geometry[0].rect, cells: [{ id: "name", rect: { ...geometry[0].rect, right: 190 } }, { rect: { ...geometry[0].rect, left: 200 } }] }];
    expect(hitTestDrop(half, measured, bounds, 250, 40)).toMatchObject({ position: "slot", index: 1 });
    expect(hitTestDrop(rows, geometry, bounds, 250, 140, "point")).toMatchObject({ position: "slot", index: 1 });
  });
  it("detects self, row gaps, the end and out-of-bounds cancellation", () => {
    expect(hitTestDrop(rows, geometry, bounds, 100, 50, "name")?.position).toBe("self");
    expect(hitTestDrop(rows, geometry, bounds, 100, 105)).toMatchObject({ row: 1, position: "before" });
    expect(hitTestDrop(rows, geometry, bounds, 100, 380)?.position).toBe("end");
    expect(hitTestDrop(rows, geometry, bounds, 425, 40)).toBeNull();
  });
  it("hit tests vertically stacked two-column cards on small screens", () => {
    const paired: FormRow[] = [{ cols: 2, items: ["name", "point"] }];
    const measured = [{ rect: { left: 0, right: 400, top: 0, bottom: 210 }, cells: [{ id: "name", rect: { left: 0, right: 400, top: 0, bottom: 100 } }, { id: "point", rect: { left: 0, right: 400, top: 110, bottom: 210 } }] }];
    expect(hitTestDrop(paired, measured, bounds, 200, 150, "point")).toMatchObject({ position: "slot", index: 1 });
  });
});

describe("column and keyboard operations", () => {
  it("creates a half-width slot and collapses it", () => {
    const half = setFieldColumns(rows, "name", 2);
    expect(half[0]).toEqual({ cols: 2, items: ["name"] });
    expect(setFieldColumns(half, "name", 1)).toEqual(rows);
  });
  it.each(["stock", "point"])("splits %s from a pair in left-to-right order", (id) => {
    expect(setFieldColumns(rows, id, 1).slice(1, 3)).toEqual([{ cols: 1, items: ["stock"] }, { cols: 1, items: ["point"] }]);
  });
  it("moves pairs out to standalone rows and swaps left/right", () => {
    expect(moveFieldByKeyboard(rows, "point", "ArrowUp")[1].items).toEqual(["point"]);
    expect(moveFieldByKeyboard(rows, "stock", "ArrowDown")[2].items).toEqual(["stock"]);
    expect(moveFieldByKeyboard(rows, "stock", "ArrowRight")[1].items).toEqual(["point", "stock"]);
  });
  it("joins the following single-field row or opens a half slot", () => {
    expect(moveFieldByKeyboard([{ cols: 1, items: ["name"] }, { cols: 1, items: ["date"] }], "name", "ArrowRight")).toEqual([{ cols: 2, items: ["name", "date"] }]);
    expect(moveFieldByKeyboard(rows, "name", "ArrowRight")[0].cols).toBe(2);
  });
  it("persists the real full/half units and explicit rows", () => {
    expect(toBlueprintFormLayout(rows, [{ code: "name", required: true }]).fields).toEqual([
      { fieldCode: "name", visible: true, required: true, width: "full", rowIndex: 0 },
      { fieldCode: "stock", visible: true, required: false, width: "half", rowIndex: 1 },
      { fieldCode: "point", visible: true, required: false, width: "half", rowIndex: 1 },
      { fieldCode: "date", visible: true, required: false, width: "full", rowIndex: 2 },
    ]);
  });
});
